const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const config = require('../../config/setup');
const { findChannel } = require('../../handlers/finder');
const guildCache = require('../../database/cache/models/guild');

module.exports = {
  name: "stickymessage",
  aliases: ['sticky'],
  description: `Set up sticky messages that send after periods of inactivity`,
  usage: `{guildprefix}stickymessage add [channel] [message]
{guildprefix}stickymessage remove [channel]
{guildprefix}stickymessage view [channel]
{guildprefix}stickymessage list`,
  permission: "Manage Channels",

  run: async(client, message, args) => {

    // Show help if no subcommand provided
    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {

      const channelInput = args[1];
      const stickymessage = args.slice(2).join(' ');

      if (!channelInput || !stickymessage) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
      }

      const channel = channelResult.channel;

      // Check if bot has permission to send messages in the channel
      if (!channel.permissionsFor(message.guild.members.me).has('SendMessages')) {
        return embeds.deny(message, `I don't have permission to send messages in ${channel}`);
      }

      // Validate message length
      if (stickymessage.length > 2000) {
        return embeds.warn(message, 'Sticky message must be **2000 characters or less**');
      }

      // Check sticky message limit (10 max)
      const currentStickyMessages = await guildCache.getStickyMessages(message.guild.id) || [];
      const existingStickyMessage = currentStickyMessages.find(sm => sm.channelId === channel.id);

      if (!existingStickyMessage && currentStickyMessages.length >= 10) {
        return embeds.deny(message, 'You have reached the **maximum sticky messages (10)**. Please remove some first.');
      }

      // No validation needed - just save the message as-is
      // The EmbedVariableProcessor will handle any syntax issues when the message is actually sent

      // Save sticky message using cache system
      await guildCache.setStickyMessage(message.guild.id, channel.id, stickymessage);

      return embeds.success(message, `Sticky message set for ${channel}. It will send after **15 minutes** of inactivity.`);

    } else if (args[0] === 'remove') {

      const channelInput = args[1];

      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
      }

      const channel = channelResult.channel;

      // Check if sticky message exists for this channel
      const existingStickyMessage = await guildCache.getStickyMessage(message.guild.id, channel.id);

      if (!existingStickyMessage) {
        return embeds.warn(message, `No sticky message found for ${channel}`);
      }

      // Remove sticky message
      await guildCache.removeStickyMessage(message.guild.id, channel.id);

      return embeds.success(message, `Sticky message removed from ${channel}`);

    } else if (args[0] === 'view') {

      const channelInput = args[1];

      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
      }

      const channel = channelResult.channel;

      // Get sticky message for this channel
      const stickyMessage = await guildCache.getStickyMessage(message.guild.id, channel.id);

      if (!stickyMessage) {
        return embeds.warn(message, `No sticky message found for ${channel}`);
      }

      // Create preview embed
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Sticky Message Preview')
        .setDescription(`**Channel:** ${channel}\n**Inactivity Timer:** 15 minutes\n\n**Message:**\n\`\`\`${stickyMessage.message.length > 1000 ? stickyMessage.message.substring(0, 1000) + '...' : stickyMessage.message}\`\`\``)
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'list') {

      // Get all sticky messages for this guild
      const stickyMessages = await guildCache.getAllStickyMessages(message.guild.id);

      if (!stickyMessages || stickyMessages.length === 0) {
        return embeds.info(message, 'No sticky messages configured for this server');
      }

      // Create list embed
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Sticky Messages')
        .setTimestamp();

      let description = '';
      for (const sticky of stickyMessages) {
        const channel = message.guild.channels.cache.get(sticky.channelId);
        if (channel) {
          const preview = sticky.message.length > 50 ? sticky.message.substring(0, 50) + '...' : sticky.message;
          description += `**${channel}**\n\`${preview}\`\n\n`;
        }
      }

      if (description.length > 4000) {
        description = description.substring(0, 4000) + '...';
      }

      embed.setDescription(description || 'No valid sticky messages found');

      return message.channel.send({ embeds: [embed] });

    } else {
      return false;
    }
  }
};
