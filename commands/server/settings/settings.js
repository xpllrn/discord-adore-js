const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

// SHARED LOGIC: View config
async function viewConfigShared(context, guildService) {
  const guild = context.guild;
  const user = context.user || context.author;
  const isInteraction = !!context.user;

  const guildData = await guildService.ensureGuildData(guild.id);

  // Get prefix
  const prefix = guildData.Prefix || ',';

  // Check modules status
  const antinukeEnabled = guildData.Antinuke?.enabled || false;
  const starboardEnabled = guildData.StarboardChannel ? true : false;
  const reactionRolesCount = guildData.ReactionRoles?.length || 0;
  const buttonRolesCount = guildData.ButtonRoles?.length || 0;
  const levelSystemEnabled = guildData.LevelSystem?.enabled || false;
  const ticketSystemEnabled = guildData.TicketSystem?.enabled || false;
  const nsfwBypassEnabled = guildData.NSFWBypass || false;

  // Get counts
  const welcomeMessagesCount = guildData.WelcomeMessages?.length || 0;
  const goodbyeMessagesCount = guildData.LeaveMessages?.length || 0;
  const boostMessagesCount = guildData.BoostMessages?.length || 0;
  const autoRolesCount = guildData.AutoRoles?.length || 0;
  const autoReactCount = guildData.AutoReact?.length || 0;
  const autoResponderCount = guildData.AutoResponder?.length || 0;

  // Get channels and roles
  const jailRole = guildData.JailRoleID ? `<@&${guildData.JailRoleID}>` : 'None';
  const jailChannel = guildData.JailChannelID ? `<#${guildData.JailChannelID}>` : 'None';
  const starboardChannel = guildData.StarboardChannel ? `<#${guildData.StarboardChannel}>` : 'None';
  const baseRole = guildData.BoosterRoleSystem?.baseRoleId ? `<@&${guildData.BoosterRoleSystem.baseRoleId}>` : 'None';
  const levelUpChannel = guildData.LevelSystem?.levelUpChannel ? `<#${guildData.LevelSystem.levelUpChannel}>` : 'None';
  const ticketCategory = guildData.TicketSystem?.categoryId ? `<#${guildData.TicketSystem.categoryId}>` : 'None';
  const supportRole = guildData.TicketSystem?.supportRoleId ? `<@&${guildData.TicketSystem.supportRoleId}>` : 'None';

  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setAuthor({ 
      name: user.username, 
      iconURL: user.displayAvatarURL({ dynamic: true }) 
    })
    .addFields(
      {
        name: 'Prefix',
        value: `Prefix for your server is \`${prefix}\``,
        inline: false
      },
      {
        name: 'Modules',
        value: [
          `Antinuke: ${antinukeEnabled ? config.emojis.success : config.emojis.error}`,
          `Starboard: ${starboardEnabled ? config.emojis.success : config.emojis.error}`,
          `Reaction Roles: ${reactionRolesCount > 0 ? config.emojis.success : config.emojis.error}`,
          `Button Roles: ${buttonRolesCount > 0 ? config.emojis.success : config.emojis.error}`,
          `Level System: ${levelSystemEnabled ? config.emojis.success : config.emojis.error}`,
          `Ticket System: ${ticketSystemEnabled ? config.emojis.success : config.emojis.error}`,
          `NSFW Bypass: ${nsfwBypassEnabled ? config.emojis.success : config.emojis.error}`
        ].join('\n'),
        inline: true
      },
      {
        name: 'General',
        value: [
          `Welcome Messages: ${welcomeMessagesCount}`,
          `Goodbye Messages: ${goodbyeMessagesCount}`,
          `Boost Messages: ${boostMessagesCount}`,
          `Auto Roles: ${autoRolesCount}`,
          `Auto React: ${autoReactCount}`,
          `Auto Responder: ${autoResponderCount}`
        ].join('\n'),
        inline: true
      },
      {
        name: 'Channels & Roles',
        value: [
          `Jail Role: ${jailRole}`,
          `Jail Channel: ${jailChannel}`,
          `Starboard: ${starboardChannel}`,
          `Base Role: ${baseRole}`,
          `Level Up Channel: ${levelUpChannel}`,
          `Ticket Category: ${ticketCategory}`,
          `Support Role: ${supportRole}`
        ].join('\n'),
        inline: true
      }
    )
    .setFooter({ text: `Guild ID: ${guild.id}` });

  if (isInteraction) {
    return context.reply({ embeds: [embed] });
  } else {
    return context.channel.send({ embeds: [embed] });
  }
}

// SHARED LOGIC: Set/view base role
async function handleBaseRoleShared(context, role, guildService) {
  const guild = context.guild;

  // If no role provided, show current
  if (!role) {
    const baseRoleId = await guildService.getBoosterRoleBaseRole(guild.id);
    if (!baseRoleId) {
      return embeds.info(context, 'No base role is currently set for the booster role system', false);
    }

    const baseRole = guild.roles.cache.get(baseRoleId);
    if (!baseRole) {
      // Base role was deleted, disable system
      await guildService.setBoosterRoleSystem(guild.id, null, false);
      return embeds.warn(context, 'The base role was deleted. Booster role system has been disabled.', false);
    }

    return embeds.info(context, `Current base role: ${baseRole}\n\nAll booster roles will be positioned below this role.`, false);
  }

  // Check if role is manageable by bot
  if (role.position >= guild.members.me.roles.highest.position) {
    return embeds.deny(context, `I cannot manage ${role} because it's higher than or equal to my highest role`, false);
  }

  // Set the base role
  await guildService.setBoosterRoleBaseRole(guild.id, role.id);

  return embeds.success(context, `Set ${role} as the **Base role**`, false);
}

// SHARED LOGIC: Toggle NSFW bypass
async function handleNSFWBypassShared(context, guildService) {
  const guild = context.guild;

  const guildData = await guildService.ensureGuildData(guild.id);
  const currentStatus = guildData.NSFWBypass || false;

  // Toggle the setting
  await guildService.updateGuildData(guild.id, {
    NSFWBypass: !currentStatus
  });

  if (!currentStatus) {
    return embeds.success(context, 'NSFW bypass **enabled**.', false);
  } else {
    return embeds.success(context, 'NSFW bypass **disabled**.', false);
  }
}

module.exports = {
  // PREFIX COMMAND
  name: "settings",
  aliases: [],
  description: `View and manage server settings`,
  syntax: 'settings [subcommand] (parameters)',
  example: 'settings config',
  permission: 'manage_guild',
  isGroupCommand: true,

  subcommands: {
    config: {
      name: 'config',
      aliases: [],
      description: 'View all server configuration settings',
      syntax: '{guildprefix}settings config',
      parameters: [],
      example: '{guildprefix}settings config',

      handler: async (client, message, args, guildService) => {
        return await viewConfigShared(message, guildService);
      }
    },

    baserole: {
      name: 'baserole',
      aliases: [],
      description: 'Set base role for booster role positioning',
      syntax: '{guildprefix}settings baserole [@role]',
      parameters: ['role'],
      example: '{guildprefix}settings baserole @Booster',

      handler: async (client, message, args, guildService) => {
        let role = null;
        if (args[0]) {
          const roleResult = findRole(message.guild, args.join(' '));
          if (!roleResult.found) {
            return embeds.deny(message, roleResult.error, false);
          }
          role = roleResult.role;
        }
        return await handleBaseRoleShared(message, role, guildService);
      }
    },

    bypass: {
      name: 'bypass',
      aliases: [],
      description: 'Toggle NSFW bypass to allow NSFW commands in non-NSFW channels',
      syntax: '{guildprefix}settings bypass nsfw',
      parameters: ['nsfw'],
      example: '{guildprefix}settings bypass nsfw',

      handler: async (client, message, args, guildService) => {
        if (args[0] === 'nsfw') {
          return await handleNSFWBypassShared(message, guildService);
        } else {
          return embeds.deny(message, 'Invalid bypass option. Use: `settings bypass nsfw`', false);
        }
      }
    }
  },

  run: async (client, message, args) => {
    try {
      const guildService = getService('guild');

      if (!args[0]) {
        return runHelpCommand(message, 'settings');
      }

      const sub = args[0].toLowerCase();

      // Find matching subcommand
      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), guildService);
      }

      return runHelpCommand(message, 'settings');
    } catch (error) {
      logger.webhook.error(error, message);

      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Settings Command', {
          command: 'settings',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }

      return embeds.deny(message, 'An error occurred while executing the settings command.', false);
    }
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View and manage server settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('View all server configuration settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('baserole')
        .setDescription('Set or view base role for booster role positioning')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The base role for booster role positioning')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bypass')
        .setDescription('Toggle bypass settings for various features')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('The type of bypass to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'NSFW', value: 'nsfw' }
              // More bypass types can be added here later
            )
        )
    ),

  async execute(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(interaction, 'You need **Manage Guild** permission to use this command', false);
      }

      const guildService = getService('guild');
      const subcommand = interaction.options.getSubcommand();

      // CONFIG subcommand
      if (subcommand === 'config') {
        return await viewConfigShared(interaction, guildService);
      }

      // BASEROLE subcommand
      if (subcommand === 'baserole') {
        const role = interaction.options.getRole('role');
        return await handleBaseRoleShared(interaction, role, guildService);
      }

      // BYPASS subcommand
      if (subcommand === 'bypass') {
        const bypassType = interaction.options.getString('type');
        
        if (bypassType === 'nsfw') {
          return await handleNSFWBypassShared(interaction, guildService);
        }
        // More bypass types can be handled here later
      }

    } catch (error) {
      logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });

      if (interaction.client?.errorLogger) {
        interaction.client.errorLogger.log(error, 'Slash Settings Command', {
          command: '/settings',
          subcommand: interaction.options.getSubcommand(),
          user: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel
        });
      }

      return embeds.deny(interaction, 'An error occurred while executing the command.', false).catch(() => {});
    }
  }
};
