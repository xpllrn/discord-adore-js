const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { getService } = require('@services');
const { createConfirmation } = require('../../../core/buttons');

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
          const loggingConfig = await guildService.getLoggingConfigForChannel(message.guild.id, channelId);
          
          // Get single channel reference settings
          const starboardChannel = await guildService.getStarboardChannel(message.guild.id);
          const vanityConfig = await guildService.getVanityConfig(message.guild.id);
          const voiceManager = await guildService.getVoiceManager(message.guild.id);
          const ticketSystem = await guildService.getTicketSystem(message.guild.id);
          const levelSystem = await guildService.getLevelSystem(message.guild.id);
          const countingData = await guildService.getCounting(message.guild.id);

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

          if (loggingConfig) {
            await guildService.removeLoggingChannel(message.guild.id, channelId);
            await guildService.setLoggingChannel(
              message.guild.id,
              newChannel.id,
              loggingConfig.webhookUrl,
              loggingConfig.logTypes,
              loggingConfig.createdBy
            );
          }

          // Update single channel reference settings
          if (starboardChannel === channelId) {
            await guildService.setStarboardChannel(message.guild.id, newChannel.id);
          }



          if (vanityConfig && vanityConfig.logChannelId === channelId) {
            await guildService.setVanityConfig(
              message.guild.id,
              vanityConfig.vanity,
              vanityConfig.roles,
              newChannel.id,
              vanityConfig.message
            );
          }

          if (voiceManager) {
            let updated = false;
            const newConfig = { ...voiceManager };
            
            if (voiceManager.joinChannelId === channelId) {
              newConfig.joinChannelId = newChannel.id;
              updated = true;
            }
            
            if (voiceManager.mutedChannelId === channelId) {
              newConfig.mutedChannelId = newChannel.id;
              updated = true;
            }
            
            if (updated) {
              await guildService.setVoiceManager(message.guild.id, newConfig);
            }
          }

          if (ticketSystem && ticketSystem.setupChannelId === channelId) {
            await guildService.setTicketSystem(message.guild.id, {
              ...ticketSystem,
              setupChannelId: newChannel.id
            });
          }

          if (levelSystem && levelSystem.levelUpChannel === channelId) {
            await guildService.setLevelUpChannel(message.guild.id, newChannel.id);
          }

          if (countingData && countingData.channelId === channelId) {
            await guildService.setCounting(message.guild.id, {
              ...countingData,
              channelId: newChannel.id
            });
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
