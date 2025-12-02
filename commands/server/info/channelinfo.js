const { ContainerBuilder, MessageFlags } = require('discord.js');
const { colors } = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { embeds } = require('../../../core/embeds');
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
        const channelResult = findChannel(message.guild, args[0]);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }
        channel = channelResult.channel;
      } else {
        channel = message.channel;
      }

      // Calculate created timestamp
      const createdTimestamp = Math.floor(channel.createdTimestamp / 1000);

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
      const channelType = channelTypes[channel.type] || 'not sure';

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.info.replace('#', ''), 16));

      // Title and topic section
      container.addTextDisplayComponents(
        (text) => text.setContent(`# ${channel.name}`),
        (text) => text.setContent(`-# ${channel.topic || 'No topic'}`)
      );

      // Created date
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`Created: <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`)
      );

      // Information section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Information**`),
        (text) => text.setContent(`> **Channel ID**: \`${channel.id}\`\n> **Category**: ${channel.parent ? `<#${channel.parentId}> \`${channel.parentId}\`` : 'None'} • **Type**: \`${channelType}\``)
      );

      // Footer
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`-# Guild ID: ${message.guild.id}`)
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
