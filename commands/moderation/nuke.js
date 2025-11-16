const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasDiscordPermission } = require('../../utils/permissions');
const { getService } = require('@services');
const { createConfirmation } = require('../../core/buttons');

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

    // Show confirmation dialog
    await createConfirmation(
      message,
      `Are you sure you want to **nuke** <#${channel.id}>? This will delete and recreate the channel.`,
      async (interaction, confirmMessage) => {
        try {
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

          // Delete the confirmation message first
          try {
            await confirmMessage.delete();
          } catch (e) {
            // Ignore if already deleted
          }

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
          console.error('Error details:', error.stack);
          // Try to send error message in any available channel
          try {
            // Try to find a channel to send the error to
            const errorChannel = message.guild.channels.cache.find(ch => 
              ch.isTextBased() && 
              ch.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.SendMessages)
            );
            
            if (errorChannel) {
              await embeds.deny({ channel: errorChannel }, `Failed to nuke channel: ${error.message}`);
            }
          } catch (sendError) {
            // Can't send error anywhere
            console.error('Could not send error message:', sendError);
          }
        }
      }
    );
  }
}
