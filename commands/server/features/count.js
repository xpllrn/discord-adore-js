const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

// SHARED LOGIC: View counting config
async function viewCountingConfigShared(context) {
  const guildService = getService('guild');
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (countingData.channelId) {
    const strictMode = countingData.strict !== false ? 'on' : 'off';
    const status = countingData.enabled !== false ? 'enabled' : 'disabled';
    return embeds.info(context, `The counting channel is <#${countingData.channelId}>\nStatus: **${status}**\nStrict mode: **${strictMode}**\nCurrent count: **${countingData.currentCount}**`);
  } else {
    return embeds.info(context, `There is no counting channel set`);
  }
}

// SHARED LOGIC: Set counting channel
async function setCountingChannelShared(context, channel) {
  const guildService = getService('guild');
  
  await guildService.setCounting(context.guild.id, {
    channelId: channel.id,
    currentCount: 0,
    lastCounterId: null,
    strict: true,
    enabled: true
  });

  return embeds.success(context, `Counting channel has been **set** to ${channel} and **enabled**. Start counting from **1**!`);
}

// SHARED LOGIC: Toggle strict mode
async function toggleStrictModeShared(context, mode) {
  const guildService = getService('guild');
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (!countingData.channelId) {
    return embeds.warn(context, 'Please set a counting channel first using `/count channel #channel`');
  }

  if (mode === 'on') {
    countingData.strict = true;
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, '**Strict mode** has been **enabled**. Wrong counts will reset the game');
  } else if (mode === 'off') {
    countingData.strict = false;
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, '**Strict mode** has been **disabled**. Wrong counts will be ignored but the game continues');
  }
}

// SHARED LOGIC: Toggle blacklist user
async function toggleBlacklistUserShared(context, user) {
  const guildService = getService('guild');
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (!countingData.channelId) {
    return embeds.warn(context, 'Please set a counting channel first using `/count channel #channel`');
  }

  if (!countingData.ignoredUsers) {
    countingData.ignoredUsers = [];
  }

  if (countingData.ignoredUsers.includes(user.id)) {
    countingData.ignoredUsers = countingData.ignoredUsers.filter(id => id !== user.id);
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, `**${user.tag}** is no longer **blacklisted** in the counting system`);
  } else {
    countingData.ignoredUsers.push(user.id);
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, `**${user.tag}** is now **blacklisted** in the counting system`);
  }
}

// SHARED LOGIC: View blacklisted users
async function viewBlacklistedUsersShared(context) {
  const guildService = getService('guild');
  const client = context.client || context;
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (!countingData.channelId) {
    return embeds.warn(context, 'Please set a counting channel first using `/count channel #channel`');
  }

  if (!countingData.ignoredUsers || countingData.ignoredUsers.length === 0) {
    return embeds.info(context, 'There are no **blacklisted users** in the counting system');
  }

  const userList = await Promise.all(
    countingData.ignoredUsers.map(async (userId, index) => {
      try {
        const user = await client.users.fetch(userId);
        return `${index + 1}. **${user.tag}** (${userId})`;
      } catch {
        return `${index + 1}. Unknown User (${userId})`;
      }
    })
  );

  return embeds.info(context, `**Blacklisted Users (${countingData.ignoredUsers.length}):**\n${userList.join('\n')}`);
}

module.exports = {
  // PREFIX COMMAND
  name: 'count',
  aliases: ['counting'],
  description: 'Configure the counting game system',
  syntax: 'count [subcommand]',
  example: 'count config',
  permission: 'manage_guild',
  isGroupCommand: true,

  subcommands: {
    config: {
      name: 'config',
      aliases: [],
      description: 'View current counting configuration',
      syntax: '{guildprefix}count config',
      parameters: [],
      example: '{guildprefix}count config',
      handler: async (client, message, args) => {
        return await viewCountingConfigShared(message);
      }
    },

    channel: {
      name: 'channel',
      aliases: [],
      description: 'Set the counting channel',
      syntax: '{guildprefix}count channel [#channel]',
      parameters: ['channel'],
      example: '{guildprefix}count channel #counting',
      handler: async (client, message, args) => {
        if (!args[0]) {
          return runHelpCommand(message, 'count');
        }

        const mentionedChannel = message.mentions.channels.first();
        const channel = (mentionedChannel && mentionedChannel.guild.id === message.guild.id) ? mentionedChannel :
                        message.guild.channels.cache.get(args[0]);
        
        if (!channel) {
          return embeds.warn(message, 'Invalid channel provided');
        }

        if (!channel.isTextBased()) {
          return embeds.deny(message, 'Counting channel must be a text channel', false);
        }

        return await setCountingChannelShared(message, channel);
      }
    },

    strict: {
      name: 'strict',
      aliases: [],
      description: 'Toggle strict mode (wrong counts reset the game)',
      syntax: '{guildprefix}count strict [on/off]',
      parameters: ['on/off'],
      example: '{guildprefix}count strict on',
      handler: async (client, message, args) => {
        const mode = args[0]?.toLowerCase();
        
        if (!mode || (mode !== 'on' && mode !== 'off')) {
          return runHelpCommand(message, 'count');
        }

        return await toggleStrictModeShared(message, mode);
      }
    },

    blacklist: {
      name: 'blacklist',
      aliases: [],
      description: 'Toggle blacklist for a user',
      syntax: '{guildprefix}count blacklist [@user]',
      parameters: ['user'],
      example: '{guildprefix}count blacklist @user',
      handler: async (client, message, args) => {
        const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        
        if (!user) {
          return runHelpCommand(message, 'count');
        }

        return await toggleBlacklistUserShared(message, user);
      }
    },

    blacklists: {
      name: 'blacklists',
      aliases: [],
      description: 'View all blacklisted users',
      syntax: '{guildprefix}count blacklists',
      parameters: [],
      example: '{guildprefix}count blacklists',
      handler: async (client, message, args) => {
        return await viewBlacklistedUsersShared(message);
      }
    }
  },

  run: async (client, message, args) => {
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'count');
    }

    const sub = args[0].toLowerCase();

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'count');
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('count')
    .setDescription('Configure the counting game system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('View current counting configuration')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Set the counting channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel for counting')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('strict')
        .setDescription('Toggle strict mode for counting')
        .addStringOption(option =>
          option
            .setName('mode')
            .setDescription('Enable or disable strict mode')
            .setRequired(true)
            .addChoices(
              { name: 'On', value: 'on' },
              { name: 'Off', value: 'off' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('blacklist')
        .setDescription('Toggle blacklist for a user in counting')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to blacklist/unblacklist')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('blacklists')
        .setDescription('View all blacklisted users in counting')
    ),

  async execute(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(interaction, 'You need **Manage Guild** permission to use this command', false);
      }

      const subcommand = interaction.options.getSubcommand();

      // CONFIG subcommand
      if (subcommand === 'config') {
        return await viewCountingConfigShared(interaction);
      }

      // CHANNEL subcommand
      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel');
        
        if (!channel.isTextBased()) {
          return embeds.deny(interaction, 'Counting channel must be a text channel', false);
        }

        return await setCountingChannelShared(interaction, channel);
      }

      // STRICT subcommand
      if (subcommand === 'strict') {
        const mode = interaction.options.getString('mode');
        return await toggleStrictModeShared(interaction, mode);
      }

      // BLACKLIST subcommand
      if (subcommand === 'blacklist') {
        const user = interaction.options.getUser('user');
        return await toggleBlacklistUserShared(interaction, user);
      }

      // BLACKLISTS subcommand
      if (subcommand === 'blacklists') {
        return await viewBlacklistedUsersShared(interaction);
      }

    } catch (error) {
      logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });

      if (interaction.client?.errorLogger) {
        interaction.client.errorLogger.log(error, 'Slash Count Command', {
          command: '/count',
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
