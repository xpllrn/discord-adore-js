const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findRole, findChannel } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "lock",
  aliases: ['lockdown'],
  description: 'locks the channel for default/selected role',
  syntax: 'lock (channel) (role)',
  example: 'lock #general @Members',
  permission: 'manage_channels',
  run: async(client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    let targetChannel = message.channel;

    // Handle threads differently - they use setLocked() API
    if (message.channel.isThread()) {
      // Threads don't support role-based locking, only full lock/unlock
      if (args.length > 0) {
        return embeds.deny(message, 'Threads can only be locked entirely, not for specific roles');
      }

      // Check if thread is already locked
      if (targetChannel.locked) {
        return embeds.warn(message, `**${targetChannel.name}** is already **locked**`);
      }

      try {
        await targetChannel.setLocked(true, 'Locked via command');
        return message.react('🔒');
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, "An error occurred while trying to **lock** the thread");
      }
    }

    // Regular channel logic with role-based permissions
    let targetRole = null;

    if (args.length === 0) {
      targetRole = message.guild.roles.everyone;
    } else if (args.length === 1) {
      const roleResult = findRole(message.guild, args[0]);
      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }
      targetRole = roleResult.role;
    } else if (args.length === 2) {
      const channelMention = args[0].match(/^<#(\d+)>$/);
      if (channelMention) {
        const channelResult = findChannel(message.guild, channelMention[1]);
        if (!channelResult.found) {
          return embeds.deny(message, channelResult.error);
        }
        targetChannel = channelResult.channel;
      } else {
        return embeds.deny(message, "Please provide a **valid channel mention** (e.g., #general)");
      }

      const roleResult = findRole(message.guild, args[1]);
      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }
      targetRole = roleResult.role;
    } else {
      return runHelpCommand(message, 'lock');
    }

    // Check if there's an explicit permission override for this role
    const existingOverwrite = targetChannel.permissionOverwrites.cache.get(targetRole.id);
    const roleText = targetRole.id === message.guild.id ? "@everyone" : `**${targetRole.name}**`;

    // Only consider it "already locked" if there's an explicit DENY override for SendMessages
    if (existingOverwrite && existingOverwrite.deny.has(PermissionFlagsBits.SendMessages)) {
      return embeds.warn(message, `**#${targetChannel.name}** is already **locked** for ${roleText}`);
    }

    try {
      await targetChannel.permissionOverwrites.edit(targetRole, {
        SendMessages: false,
        AddReactions: false,
      });

      return message.react('🔒');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, "An error occurred while trying to **lock** the channel");
    }
  }
}