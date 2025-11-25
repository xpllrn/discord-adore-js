const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { runHelpCommand } = require('../../../../utils/commandProcessor');
const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const logger = require('../../../../utils/logger');

// SHARED LOGIC: View config
async function viewConfigShared(context) {
  const guildService = getService('guild');
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (countingData.channelId) {
    const strictMode = countingData.strict !== false ? 'on' : 'off';
    const status = countingData.enabled !== false ? 'enabled' : 'disabled';
    return embeds.info(context, `The counting channel is <#${countingData.channelId}>.\nStatus: **${status}**\nStrict mode: **${strictMode}**\nCurrent count: **${countingData.currentCount}**`, false);
  } else {
    return embeds.info(context, `There is no counting channel set.`, false);
  }
}

// SHARED LOGIC: Set channel
async function setChannelShared(context, channel) {
  const guildService = getService('guild');
  
  await guildService.setCounting(context.guild.id, {
    channelId: channel.id,
    currentCount: 0,
    lastCounterId: null,
    strict: true,
    enabled: true
  });

  return embeds.success(context, `Counting channel has been **set** to ${channel} and **enabled**. Start counting from **1**!`, false);
}

// SHARED LOGIC: Set strict mode
async function setStrictModeShared(context, mode) {
  const guildService = getService('guild');
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (!countingData.channelId) {
    return embeds.deny(context, 'Please set a counting channel first using `count channel #channel`.', false);
  }

  if (mode === 'on') {
    countingData.strict = true;
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, '**Strict mode** has been **enabled**. Wrong counts will reset the game', false);
  } else if (mode === 'off') {
    countingData.strict = false;
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, '**Strict mode** has been **disabled**. Wrong counts will be ignored but the game continues', false);
  }
}

// SHARED LOGIC: Toggle blacklist
async function toggleBlacklistShared(context, user) {
  const guildService = getService('guild');
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (!countingData.channelId) {
    return embeds.deny(context, 'Please set a counting channel first using `count channel #channel`.', false);
  }

  if (!countingData.ignoredUsers) {
    countingData.ignoredUsers = [];
  }

  if (countingData.ignoredUsers.includes(user.id)) {
    countingData.ignoredUsers = countingData.ignoredUsers.filter(id => id !== user.id);
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, `**${user.tag}** is no longer **blacklisted** in the counting system`, false);
  } else {
    countingData.ignoredUsers.push(user.id);
    await guildService.setCounting(context.guild.id, countingData);
    return embeds.success(context, `**${user.tag}** is now **blacklisted** in the counting system`, false);
  }
}

// SHARED LOGIC: View blacklists
async function viewBlacklistsShared(context) {
  const guildService = getService('guild');
  const countingData = await guildService.getCounting(context.guild.id);
  
  if (!countingData.channelId) {
    return embeds.deny(context, 'Please set a counting channel first using `count channel #channel`.', false);
  }

  if (!countingData.ignoredUsers || countingData.ignoredUsers.length === 0) {
    return embeds.info(context, 'There are no **blacklisted users** in the counting system', false);
  }

  const userList = await Promise.all(
    countingData.ignoredUsers.map(async (userId, index) => {
      try {
        const user = await context.client.users.fetch(userId);
        return `${index + 1}. **${user.tag}** (${userId})`;
      } catch {
        return `${index + 1}. Unknown User (${userId})`;
      }
    })
  );

  return embeds.info(context, `**Blacklisted Users (${countingData.ignoredUsers.length}):**\n${userList.join('\n')}`, false);
}

module.exports = {
  // PREFIX COMMAND
  name: 'count',
  aliases: ['counting'],
  description: 'Configure the counting game system.',
  syntax: 'count <subcommand>',
  example: 'count config',
  run: async (client, message, args) => {
    if (!args[0]) {
      return runHelpCommand(message, 'count');
    }

    const subcommand = args[0].toLowerCase();
    const subcommands = ['config', 'channel', 'strict', 'blacklist', 'blacklists'];

    if (!subcommands.includes(subcommand)) {
      return runHelpCommand(message, 'count');
    }

    // Load and execute subcommand
    try {
      const subCmd = require(`./${subcommand}.js`);
      return await subCmd.run(client, message, args.slice(1));
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return runHelpCommand(message, 'count');
      }
      throw error;
    }
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
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(interaction, 'You need **Manage Guild** permission to use this command', false);
      }

      const subcommand = interaction.options.getSubcommand();

      // CONFIG subcommand
      if (subcommand === 'config') {
        return await viewConfigShared(interaction);
      }

      // CHANNEL subcommand
      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel');
        
        if (!channel.isTextBased()) {
          return embeds.deny(interaction, 'Counting channel must be a text channel', false);
        }

        return await setChannelShared(interaction, channel);
      }

      // STRICT subcommand
      if (subcommand === 'strict') {
        const mode = interaction.options.getString('mode');
        return await setStrictModeShared(interaction, mode);
      }

      // BLACKLIST subcommand
      if (subcommand === 'blacklist') {
        const user = interaction.options.getUser('user');
        return await toggleBlacklistShared(interaction, user);
      }

      // BLACKLISTS subcommand
      if (subcommand === 'blacklists') {
        return await viewBlacklistsShared(interaction);
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
