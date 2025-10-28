const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: 'count',
  aliases: ['counting'],
  description: 'Configure the counting game system.',
  syntax: 'count (channel/strict) <value>',
  example: 'count channel #counting',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    // Show current settings
    if (!args[0]) {
      const countingData = await guildService.getCounting(message.guild.id);
      if (countingData.channelId) {
        const strictMode = countingData.strict !== false ? 'on' : 'off';
        return embeds.info(message, `The counting channel is <#${countingData.channelId}>.\nStrict mode: **${strictMode}**\nCurrent count: **${countingData.currentCount}**`);
      } else {
        return embeds.info(message, `There is no counting channel set.`);
      }
    }

    // Handle strict mode toggle
    if (args[0].toLowerCase() === 'strict') {
      const countingData = await guildService.getCounting(message.guild.id);
      if (!countingData.channelId) {
        return embeds.deny(message, 'Please set a counting channel first.');
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
        return embeds.deny(message, 'Usage: `count strict on/off`');
      }
    }

    // Handle channel setting
    if (args[0].toLowerCase() === 'channel') {
      if (!args[1]) {
        return embeds.deny(message, 'Usage: `count channel #channel` or `count channel none`');
      }

      if (args[1].toLowerCase() === 'none' || args[1].toLowerCase() === 'off') {
        await guildService.setCounting(message.guild.id, {
          channelId: null,
          currentCount: 0,
          lastCounterId: null,
          strict: true
        });
        return embeds.success(message, 'Counting channel has been disabled.');
      }

      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel) {
        return embeds.deny(message, 'Invalid channel provided.');
      }

      await guildService.setCounting(message.guild.id, {
        channelId: channel.id,
        currentCount: 0,
        lastCounterId: null,
        strict: true
      });

      return embeds.success(message, `Counting channel has been set to ${channel}. Start counting from **1**!`);
    }

    // Legacy support: direct channel mention or ID
    if (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable' || args[0].toLowerCase() === 'none') {
      await guildService.setCounting(message.guild.id, {
        channelId: null,
        currentCount: 0,
        lastCounterId: null,
        strict: true
      });
      return embeds.success(message, 'Counting channel has been disabled.');
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel) {
      return embeds.deny(message, 'Invalid channel provided. Use `count channel #channel` to set a counting channel.');
    }

    await guildService.setCounting(message.guild.id, {
      channelId: channel.id,
      currentCount: 0,
      lastCounterId: null,
      strict: true
    });

    return embeds.success(message, `Counting channel has been set to ${channel}. Start counting from **1**!`);
  }
};
