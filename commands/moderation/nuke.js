const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasDiscordPermission } = require('../../utils/permissions');
const { getService } = require('@services');

module.exports = {
  name: "nuke",
  aliases: [],
  description: 'Deletes and recreates the channel with the same settings',
  syntax: 'nuke',
  example: 'nuke',
  permission: 'Manage Channels',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    // Permission checks
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    const channel = message.channel;

    // Store channel settings before deletion
    const channelData = {
      name: channel.name,
      type: channel.type,
      topic: channel.topic,
      nsfw: channel.nsfw,
      rateLimitPerUser: channel.rateLimitPerUser,
      position: channel.position,
      parent: channel.parent,
      permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield
      }))
    };

    // Store database settings for this channel
    const channelId = channel.id;
    
    // Get channel-specific settings
    const welcomeMsg = await guildService.getWelcomeMessageForChannel(message.guild.id, channelId);
    const leaveMsg = await guildService.getLeaveMessageForChannel(message.guild.id, channelId);
    const boostMsg = await guildService.getBoostMessage(message.guild.id, channelId);

    try {
      // Delete the channel
      await channel.delete(`Nuked by ${message.author.tag}`);

      // Create new channel with same settings
      const newChannel = await message.guild.channels.create({
        name: channelData.name,
        type: channelData.type,
        topic: channelData.topic,
        nsfw: channelData.nsfw,
        rateLimitPerUser: channelData.rateLimitPerUser,
        position: channelData.position,
        parent: channelData.parent,
        permissionOverwrites: channelData.permissionOverwrites
      });

      // Restore database settings with new channel ID
      if (welcomeMsg) {
        await guildService.removeWelcomeMessage(message.guild.id, channelId);
        await guildService.addWelcomeMessage(message.guild.id, newChannel.id, welcomeMsg.message);
      }

      if (leaveMsg) {
        await guildService.removeLeaveMessage(message.guild.id, channelId);
        await guildService.addLeaveMessage(message.guild.id, newChannel.id, leaveMsg.message);
      }

      if (boostMsg) {
        await guildService.removeBoostMessage(message.guild.id, channelId);
        await guildService.addBoostMessage(message.guild.id, newChannel.id, boostMsg.message);
      }

      // Send success message in the new channel
      await embeds.success({ channel: newChannel }, `Channel nuked by **${message.author.tag}**`);

    } catch (error) {
      console.error('Nuke command error:', error);
      // Try to send error in original channel if it still exists
      try {
        await embeds.deny(message, 'An error occurred while nuking the channel');
      } catch {
        // Channel might be deleted, can't send error
      }
    }
  }
}
