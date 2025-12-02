const { ContainerBuilder, SectionBuilder, MessageFlags } = require('discord.js');
const { colors } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'channelinfo',
  aliases: ['ci', 'channel'],
  description: 'Display detailed information about a channel',
  syntax: 'channelinfo [channel]',
  example: 'channelinfo #general',
  run: async (client, message, args) => {
    try {
      // Get channel from mention, ID, or current channel
      let channel;
      if (args[0]) {
        const channelId = args[0].replace(/[<>#]/g, '');
        channel = message.guild.channels.cache.get(channelId);
        if (!channel) {
          return message.reply('Channel not found.');
        }
      } else {
        channel = message.channel;
      }

      // Calculate created timestamp
      const createdTimestamp = Math.floor(channel.createdTimestamp / 1000);
      const createdDate = new Date(channel.createdTimestamp);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const formattedDate = `${createdDate.getDate()} ${monthNames[createdDate.getMonth()]} ${createdDate.getFullYear()}`;

      // Channel type mapping
      const channelTypes = {
        0: 'Text',
        2: 'Voice',
        4: 'Category',
        5: 'Announcement',
        13: 'Stage',
        15: 'Forum',
        16: 'Media'
      };
      const channelType = channelTypes[channel.type] || 'Unknown';

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.info.replace('#', ''), 16));

      // Title and topic section
      container.addTextDisplayComponents(
        (text) => text.setContent(`# ${channel.name}`),
        (text) => text.setContent(`-# ${channel.topic || 'No topic set'}`)
      );

      // Created date
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`Created: ${formattedDate} (<t:${createdTimestamp}:R>)`)
      );

      // Information section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Information**`),
        (text) => text.setContent(`> **ID**: \`${channel.id}\` • **Type**: \`${channelType}\`\n> **Category**: ${channel.parent ? `<#${channel.parentId}> \`${channel.parentId}\`` : 'None'} • **Guild**: ${message.guild.name} \`${message.guild.id}\``)
      );

      // Footer
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`-# Channel ID: ${channel.id}`)
      );

      // Send with Components V2 flag
      return message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      logger.webhook.error(error, message);
      throw error;
    }
  }
};
