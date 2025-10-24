const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: 'count',
  aliases: ['counting'],
  description: 'Set a channel for counting.',
  usage: '{guildprefix}count [channel | #channel | channelId | off]',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    if (!args[0]) {
      const countingData = await guildService.getCounting(message.guild.id);
      if (countingData.channelId) {
        return embeds.info(message, `The counting channel is currently <#${countingData.channelId}>.`);
      } else {
        return embeds.info(message, `There is no counting channel set.`);
      }
    }

    if (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable') {
      await guildService.setCounting(message.guild.id, {
        channelId: null,
        currentCount: 0,
        lastCounterId: null
      });
      return embeds.success(message, 'Counting channel has been disabled.');
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel) {
      return embeds.deny(message, 'Invalid channel provided.');
    }

    await guildService.setCounting(message.guild.id, {
      channelId: channel.id,
      currentCount: 0,
      lastCounterId: null
    });

    return embeds.success(message, `Counting channel has been set to ${channel}.`);
  }
};
