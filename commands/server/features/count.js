const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  // PREFIX COMMAND
  name: 'count',
  aliases: ['counting'],
  description: 'Configure the counting game system',
  syntax: 'count [subcommand]',
  example: 'count config',
  permission: 'manage_guild',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'count');
    }

    const subcommand = args[0].toLowerCase();

    // CONFIG subcommand
    if (subcommand === 'config') {
      const subcommandInfo = {
        description: 'View current counting configuration',
        syntax: '{guildprefix}count config',
        aliases: [],
        example: '{guildprefix}count config'
      };
      const countingData = await guildService.getCounting(message.guild.id);
      
      if (countingData.channelId) {
        const strictMode = countingData.strict !== false ? 'on' : 'off';
        const status = countingData.enabled !== false ? 'enabled' : 'disabled';
        return embeds.info(message, `The counting channel is <#${countingData.channelId}>\nStatus: **${status}**\nStrict mode: **${strictMode}**\nCurrent count: **${countingData.currentCount}**`);
      } else {
        return embeds.info(message, `There is no counting channel set`);
      }
    }

    // CHANNEL subcommand
    if (subcommand === 'channel') {
      const subcommandInfo = {
        description: 'Set the counting channel',
        syntax: '{guildprefix}count channel [#channel]',
        aliases: [],
        example: '{guildprefix}count channel #counting'
      };

      if (!args[1]) {
        return runHelpCommand(message, 'count');
      }

      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      
      if (!channel) {
        return embeds.warn(message, 'Invalid channel provided');
      }

      await guildService.setCounting(message.guild.id, {
        channelId: channel.id,
        currentCount: 0,
        lastCounterId: null,
        strict: true,
        enabled: true
      });

      return embeds.success(message, `Counting channel has been **set** to ${channel} and **enabled**. Start counting from **1**!`);
    }

    // STRICT subcommand
    if (subcommand === 'strict') {
      const subcommandInfo = {
        description: 'Toggle strict mode for counting',
        syntax: '{guildprefix}count strict [on/off]',
        aliases: [],
        example: '{guildprefix}count strict on'
      };

      const countingData = await guildService.getCounting(message.guild.id);
      
      if (!countingData.channelId) {
        return embeds.warn(message, 'Please set a counting channel first using `,count channel #channel`');
      }

      const mode = args[1]?.toLowerCase();
      
      if (mode === 'on') {
        countingData.strict = true;
        await guildService.setCounting(message.guild.id, countingData);
        return embeds.success(message, '**Strict mode** has been **enabled**. Wrong counts will reset the game');
      } else if (mode === 'off') {
        countingData.strict = false;
        await guildService.setCounting(message.guild.id, countingData);
        return embeds.success(message, '**Strict mode** has been **disabled**. Wrong counts will be ignored but the game continues');
      } else {
        return runHelpCommand(message, 'count');
      }
    }

    // BLACKLIST subcommand
    if (subcommand === 'blacklist') {
      const subcommandInfo = {
        description: 'Toggle blacklist for a user in counting',
        syntax: '{guildprefix}count blacklist [user]',
        aliases: [],
        example: '{guildprefix}count blacklist @user'
      };

      const countingData = await guildService.getCounting(message.guild.id);
      
      if (!countingData.channelId) {
        return embeds.warn(message, 'Please set a counting channel first using `,count channel #channel`');
      }

      const user = message.mentions.users.first() || await message.client.users.fetch(args[1]).catch(() => null);
      
      if (!user) {
        return runHelpCommand(message, 'count');
      }

      if (!countingData.ignoredUsers) {
        countingData.ignoredUsers = [];
      }

      if (countingData.ignoredUsers.includes(user.id)) {
        countingData.ignoredUsers = countingData.ignoredUsers.filter(id => id !== user.id);
        await guildService.setCounting(message.guild.id, countingData);
        return embeds.success(message, `**${user.tag}** is no longer **blacklisted** in the counting system`);
      } else {
        countingData.ignoredUsers.push(user.id);
        await guildService.setCounting(message.guild.id, countingData);
        return embeds.success(message, `**${user.tag}** is now **blacklisted** in the counting system`);
      }
    }

    // BLACKLISTS subcommand
    if (subcommand === 'blacklists') {
      const subcommandInfo = {
        description: 'View all blacklisted users in counting',
        syntax: '{guildprefix}count blacklists',
        aliases: [],
        example: '{guildprefix}count blacklists'
      };

      const countingData = await guildService.getCounting(message.guild.id);
      
      if (!countingData.channelId) {
        return embeds.warn(message, 'Please set a counting channel first using `,count channel #channel`');
      }

      if (!countingData.ignoredUsers || countingData.ignoredUsers.length === 0) {
        return embeds.info(message, 'There are no **blacklisted users** in the counting system');
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

      return embeds.info(message, `**Blacklisted Users (${countingData.ignoredUsers.length}):**\n${userList.join('\n')}`);
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

      const guildService = getService('guild');
      const subcommand = interaction.options.getSubcommand();

      // CONFIG subcommand
      if (subcommand === 'config') {
        const countingData = await guildService.getCounting(interaction.guild.id);
        
        if (countingData.channelId) {
          const strictMode = countingData.strict !== false ? 'on' : 'off';
          const status = countingData.enabled !== false ? 'enabled' : 'disabled';
          return embeds.info(interaction, `The counting channel is <#${countingData.channelId}>\nStatus: **${status}**\nStrict mode: **${strictMode}**\nCurrent count: **${countingData.currentCount}**`, false);
        } else {
          return embeds.info(interaction, `There is no counting channel set`, false);
        }
      }

      // CHANNEL subcommand
      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel');
        
        if (!channel.isTextBased()) {
          return embeds.deny(interaction, 'Counting channel must be a text channel', false);
        }

        await guildService.setCounting(interaction.guild.id, {
          channelId: channel.id,
          currentCount: 0,
          lastCounterId: null,
          strict: true,
          enabled: true
        });

        return embeds.success(interaction, `Counting channel has been **set** to ${channel} and **enabled**. Start counting from **1**!`, false);
      }

      // STRICT subcommand
      if (subcommand === 'strict') {
        const countingData = await guildService.getCounting(interaction.guild.id);
        
        if (!countingData.channelId) {
          return embeds.warn(interaction, 'Please set a counting channel first using `/count channel #channel`', false);
        }

        const mode = interaction.options.getString('mode');
        
        if (mode === 'on') {
          countingData.strict = true;
          await guildService.setCounting(interaction.guild.id, countingData);
          return embeds.success(interaction, '**Strict mode** has been **enabled**. Wrong counts will reset the game', false);
        } else if (mode === 'off') {
          countingData.strict = false;
          await guildService.setCounting(interaction.guild.id, countingData);
          return embeds.success(interaction, '**Strict mode** has been **disabled**. Wrong counts will be ignored but the game continues', false);
        }
      }

      // BLACKLIST subcommand
      if (subcommand === 'blacklist') {
        const countingData = await guildService.getCounting(interaction.guild.id);
        
        if (!countingData.channelId) {
          return embeds.warn(interaction, 'Please set a counting channel first using `/count channel #channel`', false);
        }

        const user = interaction.options.getUser('user');

        if (!countingData.ignoredUsers) {
          countingData.ignoredUsers = [];
        }

        if (countingData.ignoredUsers.includes(user.id)) {
          countingData.ignoredUsers = countingData.ignoredUsers.filter(id => id !== user.id);
          await guildService.setCounting(interaction.guild.id, countingData);
          return embeds.success(interaction, `**${user.tag}** is no longer **blacklisted** in the counting system`, false);
        } else {
          countingData.ignoredUsers.push(user.id);
          await guildService.setCounting(interaction.guild.id, countingData);
          return embeds.success(interaction, `**${user.tag}** is now **blacklisted** in the counting system`, false);
        }
      }

      // BLACKLISTS subcommand
      if (subcommand === 'blacklists') {
        const countingData = await guildService.getCounting(interaction.guild.id);
        
        if (!countingData.channelId) {
          return embeds.warn(interaction, 'Please set a counting channel first using `/count channel #channel`', false);
        }

        if (!countingData.ignoredUsers || countingData.ignoredUsers.length === 0) {
          return embeds.info(interaction, 'There are no **blacklisted users** in the counting system', false);
        }

        const userList = await Promise.all(
          countingData.ignoredUsers.map(async (userId, index) => {
            try {
              const user = await interaction.client.users.fetch(userId);
              return `${index + 1}. **${user.tag}** (${userId})`;
            } catch {
              return `${index + 1}. Unknown User (${userId})`;
            }
          })
        );

        return embeds.info(interaction, `**Blacklisted Users (${countingData.ignoredUsers.length}):**\n${userList.join('\n')}`, false);
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
