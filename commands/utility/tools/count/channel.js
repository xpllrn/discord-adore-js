const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../../utils/commandProcessor');

module.exports = {
  name: 'channel',
  description: 'Set the counting channel',
  syntax: 'count channel <#channel>',
  example: 'count channel #counting',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'count', 'channel');
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    
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

    return embeds.success(message, `Counting channel has been **set** to ${channel} and **enabled**. Start counting from **1**!`);
  }
};
