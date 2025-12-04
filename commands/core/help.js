const { MessageFlags, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js')
const path = require('path')
const fs = require('fs')
const config = require('../../config/setup')
const { embeds } = require('../../core/embeds')
const { createParentCommandPage, createSubcommandPage, createTraditionalEmbed, addPaginationButtons, addFooter } = require('../../utils/embeds/helpEmbedBuilder')
const { createPagination } = require('../../core/buttons')

// ============================================================================
// SUBCOMMAND PARSER - Integrated into help.js
// ============================================================================

/**
 * Detects if a command has subcommands by checking isGroupCommand flag
 */
function hasSubcommands(command) {
  return command.isGroupCommand === true;
}

/**
 * Parses command file to extract subcommands in order
 * Strategy: Find if/else-if/case blocks, extract subcommand names from conditions,
 * then find the matching subcommandInfo inside each block
 */
function parseSubcommands(commandFilePath, commandName, guildPrefix) {
  try {
    const fileContent = fs.readFileSync(commandFilePath, 'utf8');
    const subcommands = [];
    const seenNames = new Set();

    // Step 1: Find all if/else-if conditions and switch cases to get subcommand names IN ORDER
    const conditionPatterns = [
      // Matches: if (args[0] === 'add' || args[0] === 'create')
      /(?:if|else\s+if)\s*\(\s*args\[0\]\s*===\s*['"](\w+)['"]/g,
      // Matches: case 'add':
      /case\s+['"](\w+)['"]\s*:/g
    ];

    const orderedSubcommandNames = [];
    
    for (const pattern of conditionPatterns) {
      let match;
      while ((match = pattern.exec(fileContent)) !== null) {
        const subcommandName = match[1];
        if (!seenNames.has(subcommandName)) {
          seenNames.add(subcommandName);
          orderedSubcommandNames.push(subcommandName);
        }
      }
    }

    // Step 2: For each subcommand name, find its subcommandInfo block
    for (const subcommandName of orderedSubcommandNames) {
      // Find the subcommandInfo block that contains name: 'subcommandName'
      // Match: const subcommandInfo = { ... name: 'add' ... };
      const subcommandInfoRegex = /const\s+subcommandInfo\s*=\s*\{([\s\S]*?)\};/g;
      
      let match;
      let foundInfo = null;
      
      // Search through all subcommandInfo blocks
      while ((match = subcommandInfoRegex.exec(fileContent)) !== null) {
        const blockContent = match[1];
        
        // Check if this block has the matching name field
        const nameMatch = blockContent.match(/name:\s*['"`](\w+)['"`]/);
        if (nameMatch && nameMatch[1] === subcommandName) {
          foundInfo = blockContent;
          break;
        }
      }
      
      if (foundInfo) {
        const subcommandData = parseSubcommandInfo(foundInfo, subcommandName, commandName, guildPrefix);
        console.log(`[HELP DEBUG] Found subcommandInfo with name field for: ${subcommandName}`);
        console.log(`[HELP DEBUG] Parsed data:`, subcommandData);
        subcommands.push(subcommandData);
      } else {
        // No subcommandInfo with name field found
        // Try to find ANY subcommandInfo in the if/else block for this subcommand
        const blockRegex = new RegExp(
          `(?:if|else\\s+if)\\s*\\(\\s*args\\[0\\]\\s*===\\s*['"]${subcommandName}['"][\\s\\S]*?const\\s+subcommandInfo\\s*=\\s*\\{([\\s\\S]*?)\\};`,
          'i'
        );
        
        const blockMatch = blockRegex.exec(fileContent);
        
        if (blockMatch) {
          // Found subcommandInfo without name field - parse it
          console.log(`[HELP DEBUG] Found subcommandInfo in block for: ${subcommandName}`);
          console.log(`[HELP DEBUG] Block content:`, blockMatch[1].substring(0, 200));
          const subcommandData = parseSubcommandInfo(blockMatch[1], subcommandName, commandName, guildPrefix);
          console.log(`[HELP DEBUG] Parsed data:`, subcommandData);
          subcommands.push(subcommandData);
        } else {
          // No subcommandInfo found at all, create basic entry
          console.log(`[HELP DEBUG] No subcommandInfo found for: ${subcommandName}, creating basic entry`);
          subcommands.push({
            name: subcommandName,
            fullCommand: `${commandName} ${subcommandName}`,
            description: `${subcommandName} subcommand`,
            aliases: [],
            parameters: [],
            syntax: `{guildprefix}${commandName} ${subcommandName}`.replace(/\{guildprefix\}/g, guildPrefix),
            example: `{guildprefix}${commandName} ${subcommandName}`.replace(/\{guildprefix\}/g, guildPrefix)
          });
        }
      }
    }

    return subcommands;
  } catch (error) {
    console.error(`Error parsing subcommands from ${commandFilePath}:`, error.message);
    return [];
  }
}

/**
 * Extracts aliases from conditional block
 */
function extractAliasesFromConditional(conditional) {
  const aliases = [];
  const aliasRegex = /(?:args\[0\]|subcommand)\s*===\s*['"](\w+)['"]/g;
  let match;

  while ((match = aliasRegex.exec(conditional)) !== null) {
    aliases.push(match[1]);
  }

  return aliases.slice(1); // Remove first one (main subcommand name)
}

/**
 * Extracts aliases from switch case statements
 */
function extractAliasesFromSwitchCases(caseBlock) {
  const aliases = [];
  const caseRegex = /case\s+['"](\w+)['"]\s*:/g;
  let match;

  while ((match = caseRegex.exec(caseBlock)) !== null) {
    aliases.push(match[1]);
  }

  return aliases.slice(1); // Remove first one (main subcommand name)
}

/**
 * Parses subcommandInfo object literal from code
 */
function parseSubcommandInfo(objectContent, subcommandName, commandName, guildPrefix) {
  const subcommandData = {
    name: subcommandName,
    fullCommand: `${commandName} ${subcommandName}`,
    description: '',
    aliases: [],
    parameters: [],
    syntax: '',
    example: ''
  };

  // Extract description
  const descMatch = objectContent.match(/description:\s*[`'"]([^`'"]*)[`'"]/);
  if (descMatch) {
    subcommandData.description = descMatch[1];
  }

  // Extract usage/syntax
  const usageMatch = objectContent.match(/syntax:\s*[`'"]([^`'"]*)[`'"]/);
  if (usageMatch) {
    let usage = usageMatch[1].replace(/\{guildprefix\}/g, guildPrefix);
    subcommandData.syntax = usage;
  }

  // Extract aliases array
  const aliasesMatch = objectContent.match(/aliases:\s*\[(.*?)\]/s);
  if (aliasesMatch) {
    const aliasesStr = aliasesMatch[1];
    const aliases = aliasesStr.match(/['"](\w+)['"]/g);
    if (aliases) {
      subcommandData.aliases = aliases.map(a => a.replace(/['"]/g, ''));
    }
  }

  // Extract parameters array
  const paramsMatch = objectContent.match(/parameters:\s*\[(.*?)\]/s);
  if (paramsMatch) {
    const paramsStr = paramsMatch[1];
    const params = paramsStr.match(/['"]([^'"]+)['"]/g);
    if (params) {
      subcommandData.parameters = params.map(p => p.replace(/['"]/g, ''));
    }
  }

  // Extract example
  const exampleMatch = objectContent.match(/example:\s*[`'"]([^`'"]*)[`'"]/);
  if (exampleMatch) {
    subcommandData.example = exampleMatch[1].replace(/\{guildprefix\}/g, guildPrefix);
  }

  return subcommandData;
}

/**
 * Gets the file path for a command
 */
function getCommandFilePath(commandName, commandsDir) {
  try {
    function searchDirectory(dir) {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const result = searchDirectory(fullPath);
          if (result) return result;
        } else if (file === `${commandName}.js`) {
          return fullPath;
        }
      }

      return null;
    }

    return searchDirectory(commandsDir);
  } catch (error) {
    console.error(`Error finding command file for ${commandName}:`, error.message);
    return null;
  }
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
        let subcommands = [];

        // PRIORITY 1: Check if command has explicit subcommands array
        if (command.subcommands && Array.isArray(command.subcommands)) {
          // Use the declarative subcommands array (preferred method)
          subcommands = command.subcommands.map(sub => ({
            ...sub,
            fullCommand: `${command.name} ${sub.name}`,
            syntax: sub.syntax ? sub.syntax.replace(/\{guildprefix\}/g, guildprefix) : '',
            example: sub.example ? sub.example.replace(/\{guildprefix\}/g, guildprefix) : ''
          }));
        } else {
          // PRIORITY 2: Fall back to parsing the file (legacy method)
          const commandsDir = path.join(__dirname, '..');
          const commandFilePath = getCommandFilePath(command.name, commandsDir);

          if (!commandFilePath) {
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

          // Parse subcommands from the file
          subcommands = parseSubcommands(commandFilePath, command.name, guildprefix);
        }

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

        // Note: Subcommand filtering (args[1]) is handled by prefix command only
        // Slash commands would need a separate option for this if needed

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
          (pageItems, currentPage, totalPages) => buildPage(currentPage - 1, currentPage, totalPages),
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

          // Get the command file path and parse subcommands
          const commandsDir = path.join(__dirname, '..');
          const commandFilePath = getCommandFilePath(command.name, commandsDir);

          if (commandFilePath) {
            const subcommands = parseSubcommands(commandFilePath, command.name, guildprefix);
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
              // Subcommand not found - show error instead of falling through
              return embeds.warn(message, `Subcommand \`${commandName} ${requestedSubcommand}\` does not exist`, false);
            }
          } else {
            // Command file not found - show error
            return embeds.warn(message, `Subcommand \`${commandName} ${requestedSubcommand}\` does not exist`, false);
          }
        } catch (e) {
          // Error parsing subcommands - show error instead of falling through
          console.error('[HELP] Error parsing subcommands:', e);
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
