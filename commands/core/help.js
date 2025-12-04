const { MessageFlags, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js')
const config = require('../../config/setup')
const { embeds } = require('../../core/embeds')
const { createParentCommandPage, createSubcommandPage, createTraditionalEmbed, addPaginationButtons, addFooter } = require('../../utils/embeds/helpEmbedBuilder')
const { createPagination } = require('../../core/buttons')

// ============================================================================
// SUBCOMMAND HELPERS
// ============================================================================

/**
 * Detects if a command has subcommands by checking isGroupCommand flag
 */
function hasSubcommands(command) {
  return command.isGroupCommand === true;
}

// ============================================================================
// SHARED HELP LOGIC - Works for both prefix and slash commands
// ============================================================================

async function showHelpShared(context, client, commandQuery) {
  const message = context.message || context; // For backward compatibility
  const isInteraction = !!context.user;

  // Get guild prefix with multiple fallback methods for reliability
  let guildprefix = config.bot.defaultPrefix; // Default fallback

  try {
    // Check if database is ready first
    const { isDatabaseReady } = require('../../database');
    const dbStatus = isDatabaseReady();

    if (dbStatus.local || dbStatus.global) {
      // Try service layer approach first
      const { getService } = require('@services');
      const guildService = getService('guild');
      const cachedPrefix = await guildService.getPrefix(context.guild.id);
      if (cachedPrefix) {
        guildprefix = cachedPrefix;
      }
    }
  } catch (cacheError) {
    // guildprefix is already set to default
  }

  const command = client.commands.get(commandQuery) || client.commands.get(client.aliases.get(commandQuery))

  // Check if command is a developer command and user is not the dev
  if (command && (command.permission === 'developer' || command.permission === 'dev')) {
    const userId = isInteraction ? context.user.id : message.author.id;
    const setupConfig = require('../../config/setup');
    
    // Only show dev commands to the actual dev (DEV_ID)
    if (userId !== setupConfig.bot.ownerId) {
      // Pretend the command doesn't exist for non-devs
      return embeds.warn(isInteraction ? context : message, `Command \`${commandQuery}\` does not exist`, false);
    }
  }

  if (command) {
    // Check if this is a group command with subcommands
    if (hasSubcommands(command)) {
      try {
        // Check if command has explicit subcommands object (new format)
        if (!command.subcommands) {
          // No subcommands object - fall back to traditional embed
          const container = createTraditionalEmbed(command, guildprefix);
          if (isInteraction) {
            if (context.deferred || context.replied) {
              return context.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            return context.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          } else {
            return context.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
          }
        }

        // Support both array and object formats
        const subcommandsList = Array.isArray(command.subcommands) 
          ? command.subcommands 
          : Object.values(command.subcommands);
        
        const subcommands = subcommandsList.map(sub => ({
          ...sub,
          fullCommand: `${command.name} ${sub.name}`,
          syntax: sub.syntax ? sub.syntax.replace(/\{guildprefix\}/g, guildprefix) : '',
          example: sub.example ? sub.example.replace(/\{guildprefix\}/g, guildprefix) : ''
        }));

        if (subcommands.length === 0) {
          // Fall back to traditional embed
          const container = createTraditionalEmbed(command, guildprefix);
          if (isInteraction) {
            if (context.deferred || context.replied) {
              return context.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            return context.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          } else {
            return context.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
          }
        }

        // Create page array: parent page + subcommand pages
        const pages = [];
        const totalPages = subcommands.length + 1;

        // Page 1: Parent command overview
        const parentPage = createParentCommandPage(command, guildprefix, subcommands.length);
        pages.push(parentPage);

        // Pages 2+: Individual subcommand pages
        subcommands.forEach((subcommand, index) => {
          const pageNumber = index + 2; // +2 because page 1 is parent
          pages.push(createSubcommandPage(command, subcommand, pageNumber, totalPages));
        });

        // Create a function to build pages with buttons and footer
        const buildPage = (pageIndex, currentPage, totalPages, disabled = false) => {
          const container = pages[pageIndex];
          // Clone the container to avoid modifying the original
          const newContainer = new (require('discord.js').ContainerBuilder)()
            .setAccentColor(parseInt(config.colors.embed.replace('#', ''), 16));
          
          // Copy all components from original container
          container.components.forEach(comp => {
            newContainer.components.push(comp);
          });
          
          // Add pagination buttons
          addPaginationButtons(newContainer, currentPage, totalPages, disabled);
          // Add footer
          addFooter(newContainer, currentPage, totalPages, subcommands.length, command.name);
          return newContainer;
        };

        // Display paginated help with buttons inside containers
        return createPagination(
          isInteraction ? context : message,
          pages,
          (currentPage, totalPages) => buildPage(currentPage - 1, currentPage, totalPages),
          1, // 1 item per page (each item is already a full container)
          command.name,
          MessageFlags.IsComponentsV2 // Pass V2 flag for containers
        );

      } catch (error) {
        // Fall back to traditional embed on error
        console.error('[HELP ERROR] Error in group command help:', error);
        console.error('[HELP ERROR] Stack:', error.stack);
        const container = createTraditionalEmbed(command, guildprefix);
        if (isInteraction) {
          if (context.deferred || context.replied) {
            return context.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          }
          return context.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } else {
          return context.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
      }
    } else {
      // Traditional single-embed help for commands without subcommands
      const container = createTraditionalEmbed(command, guildprefix);
      if (isInteraction) {
        if (context.deferred || context.replied) {
          return context.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        return context.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      } else {
        return context.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }
    }

  } else if (commandQuery) {
    return embeds.warn(isInteraction ? context : message, `Command \`${commandQuery}\` does not exist`, false);

  } else {
    const helpMessage = `Use https://adore.rest/ for command list and <https://adore.rest/server> for server information`;
    if (isInteraction) {
      if (context.deferred || context.replied) {
        return context.editReply({ content: helpMessage });
      }
      return context.reply({ content: helpMessage });
    } else {
      return context.channel.send({ content: helpMessage });
    }
  }
}

// ============================================================================

module.exports = {
  name: "help",
  aliases: ['h', 'command'],
  description: `View extended help for commands`,
  syntax: 'help (command)',
  example: 'help crash',
  global: true,

  // PREFIX COMMAND
  run: async (client, message, args) => {
    // Check if user is asking for a specific subcommand (e.g., "h ar add")
    if (args.length >= 2) {
      const commandName = args[0];
      const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));

      // Check if command is a developer command and user is not the dev
      if (command && (command.permission === 'developer' || command.permission === 'dev')) {
        const setupConfig = require('../../config/setup');
        if (message.author.id !== setupConfig.bot.ownerId) {
          return embeds.warn(message, `Command \`${commandName}\` does not exist`, false);
        }
      }

      if (command && hasSubcommands(command)) {
        try {
          // Check if command has subcommands object (new format)
          if (!command.subcommands) {
            return embeds.warn(message, `Command \`${commandName}\` does not have subcommands`, false);
          }

          // Get guild prefix
          let guildprefix = config.bot.defaultPrefix;
          try {
            const { isDatabaseReady } = require('../../database');
            const dbStatus = isDatabaseReady();
            if (dbStatus.local || dbStatus.global) {
              const { getService } = require('@services');
              const guildService = getService('guild');
              const cachedPrefix = await guildService.getPrefix(message.guild.id);
              if (cachedPrefix) {
                guildprefix = cachedPrefix;
              }
            }
          } catch (e) { }

          // Get subcommands from the command object
          const subcommandsList = Array.isArray(command.subcommands) 
            ? command.subcommands 
            : Object.values(command.subcommands);
          
          const subcommands = subcommandsList.map(sub => ({
            ...sub,
            fullCommand: `${command.name} ${sub.name}`,
            syntax: sub.syntax ? sub.syntax.replace(/\{guildprefix\}/g, guildprefix) : '',
            example: sub.example ? sub.example.replace(/\{guildprefix\}/g, guildprefix) : ''
          }));

          const requestedSubcommand = args[1].toLowerCase();

          // Find the matching subcommand (check both name and aliases)
          const matchedSubcommand = subcommands.find(sub =>
            sub.name.toLowerCase() === requestedSubcommand ||
            (sub.aliases && sub.aliases.some(alias => alias.toLowerCase() === requestedSubcommand))
          );

          if (matchedSubcommand) {
            // Show ONLY this subcommand's info (no pagination, no buttons)
            const singleSubcommandEmbed = createSubcommandPage(command, matchedSubcommand, 1, 1);
            return message.channel.send({ components: [singleSubcommandEmbed], flags: MessageFlags.IsComponentsV2 });
          } else {
            // Subcommand not found - show error
            return embeds.warn(message, `Subcommand \`${commandName} ${requestedSubcommand}\` does not exist`, false);
          }
        } catch (e) {
          // Error processing subcommands - show error
          console.error('[HELP] Error processing subcommands:', e);
          return embeds.warn(message, `Subcommand \`${commandName} ${requestedSubcommand}\` does not exist`, false);
        }
      } else if (command) {
        // Command exists but has no subcommands - show error
        return embeds.warn(message, `Command \`${commandName}\` does not have subcommands`, false);
      }
    }

    return showHelpShared(message, client, args[0]);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View extended help for commands')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('The command to get help for')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const commandQuery = interaction.options.getString('command');
    return showHelpShared(interaction, interaction.client, commandQuery);
  }
}
