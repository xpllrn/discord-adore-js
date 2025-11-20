const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, PermissionFlagsBits } = require('../../../utils/permissions');
const { findChannel } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: "naughty",
  aliases: ['nsfw'],
  description: 'toggles `NSFW` status on a channel',
  syntax: 'naughty (channel)',
  example: 'naughty #channel',
  permission: 'Manage Channels',
  run: async (client, message, args) => {

    // Check user permissions
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) {
      return;
    }

    // Check bot permissions
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    let targetChannel = message.channel;

    // If a channel is specified, find it
    if (args.length === 1) {
      const channelMention = args[0].match(/^<#(\d+)>$/);
      if (channelMention) {
        const channelResult = findChannel(message.guild, channelMention[1]);
        if (!channelResult.found) {
          return embeds.deny(message, channelResult.error || `Channel with ID ${channelMention[1]} not found`);
        }
        targetChannel = channelResult.channel;
      } else {
        return embeds.deny(message, "Please provide a **valid channel mention** (e.g., #general)");
      }
    } else if (args.length > 1) {
      return runHelpCommand(message, 'naughty');
    }

    // Check if it's a text channel (NSFW can only be set on text channels)
    if (targetChannel.type !== 0) { // 0 = GUILD_TEXT
      return embeds.warn(message, 'NSFW status can only be toggled on text channels');
    }

    // Check if command is used in a thread
    if (targetChannel.isThread()) {
      return embeds.warn(message, 'NSFW status cannot be set on threads. Use the command in the parent channel.');
    }

    const currentNSFW = targetChannel.nsfw;

    try {
      // Toggle NSFW status
      await targetChannel.setNSFW(!currentNSFW, `NSFW toggled by ${message.author.tag}`);

      if (!currentNSFW) {
        // Channel is now NSFW
        try {
          await message.react('🔞');
        } catch (reactError) {
          // Ignore reaction errors (message might be deleted)
        }
      } else {
        // Channel is no longer NSFW
        try {
          await message.react('✅');
        } catch (reactError) {
          // Ignore reaction errors (message might be deleted)
        }
      }

    } catch (error) {
      logger.webhook.error(error, message);

      if (error.code === 50013) {
        return embeds.deny(message, '**Missing permissions** to change NSFW status');
      } else if (error.code === 50035) {
        return embeds.warn(message, 'Invalid channel type for **NSFW toggle**');
      } else {
        return embeds.deny(message, 'not wanna');
      }
    }
  }
};