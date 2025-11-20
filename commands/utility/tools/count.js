const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: 'count',
  aliases: ['counting'],
  description: 'Configure the counting game system.',
  syntax: 'count (config/channel/strict/enable/disable/ignore/unignore) <value>',
  example: 'count channel #counting',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    // Require subcommand
    if (!args[0]) {
      return runHelpCommand(message, 'count');
    }

    const subcommand = args[0].toLowerCase();

    // Show current settings
    if (subcommand === 'config') {
      const countingData = await guildService.getCounting(message.guild.id);
      if (countingData.channelId) {
        const strictMode = countingData.strict !== false ? 'on' : 'off';
        const status = countingData.enabled !== false ? 'enabled' : 'disabled';
        return embeds.info(message, `The counting channel is <#${countingData.channelId}>.\nStatus: **${status}**\nStrict mode: **${strictMode}**\nCurrent count: **${countingData.currentCount}**`);
      } else {
        return embeds.info(message, `There is no counting channel set.`);
      }
    }

    // Handle enable
    if (subcommand === 'enable') {
      const countingData = await guildService.getCounting(message.guild.id);
      if (!countingData.channelId) {
        return embeds.deny(message, 'Please set a counting channel first using `count channel #channel`.');
      }
      countingData.enabled = true;
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, 'Counting system has been enabled.');
    }

    // Handle disable
    if (subcommand === 'disable') {
      const countingData = await guildService.getCounting(message.guild.id);
      if (!countingData.channelId) {
        return embeds.deny(message, 'There is no counting channel set.');
      }
      countingData.enabled = false;
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, 'Counting system has been disabled.');
    }

    // Handle ignore user
    if (subcommand === 'ignore') {
      const countingData = await guildService.getCounting(message.guild.id);
      if (!countingData.channelId) {
        return embeds.deny(message, 'Please set a counting channel first using `count channel #channel`.');
      }

      const user = message.mentions.users.first() || await message.client.users.fetch(args[1]).catch(() => null);
      if (!user) {
        return embeds.deny(message, 'Please mention a valid user or provide a user ID.');
      }

      if (!countingData.ignoredUsers) {
        countingData.ignoredUsers = [];
      }

      if (countingData.ignoredUsers.includes(user.id)) {
        return embeds.deny(message, `${user.tag} is already ignored in the counting system.`);
      }

      countingData.ignoredUsers.push(user.id);
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, `${user.tag} will now be ignored in the counting system.`);
    }

    // Handle unignore user
    if (subcommand === 'unignore') {
      const countingData = await guildService.getCounting(message.guild.id);
      if (!countingData.channelId) {
        return embeds.deny(message, 'Please set a counting channel first using `count channel #channel`.');
      }

      const user = message.mentions.users.first() || await message.client.users.fetch(args[1]).catch(() => null);
      if (!user) {
        return embeds.deny(message, 'Please mention a valid user or provide a user ID.');
      }

      if (!countingData.ignoredUsers || !countingData.ignoredUsers.includes(user.id)) {
        return embeds.deny(message, `${user.tag} is not currently ignored in the counting system.`);
      }

      countingData.ignoredUsers = countingData.ignoredUsers.filter(id => id !== user.id);
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, `${user.tag} is no longer ignored in the counting system.`);
    }

    // Handle strict mode toggle
    if (subcommand === 'strict') {
      const countingData = await guildService.getCounting(message.guild.id);
      if (!countingData.channelId) {
        return embeds.deny(message, 'Please set a counting channel first using `count channel #channel`.');
      }

      const mode = args[1]?.toLowerCase();
      if (mode === 'on') {
        countingData.strict = true;
        await guildService.setCounting(message.guild.id, countingData);
        return embeds.success(message, 'Strict mode enabled. Wrong counts will reset the game.');
      } else if (mode === 'off') {
        countingData.strict = false;
        await guildService.setCounting(message.guild.id, countingData);
        return embeds.success(message, 'Strict mode disabled. Wrong counts will be ignored but the game continues.');
      } else {
        return runHelpCommand(message, 'count');
      }
    }

    // Handle channel setting
    if (subcommand === 'channel') {
      if (!args[1]) {
        return runHelpCommand(message, 'count');
      }

      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel) {
        return embeds.deny(message, 'Invalid channel provided.');
      }

      await guildService.setCounting(message.guild.id, {
        channelId: channel.id,
        currentCount: 0,
        lastCounterId: null,
        strict: true,
        enabled: true
      });

      return embeds.success(message, `Counting channel has been set to ${channel} and enabled. Start counting from **1**!`);
    }

    return runHelpCommand(message, 'count');
  }
};
