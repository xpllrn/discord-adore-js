const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { emojis } = require('../../../config/setup');

module.exports = {
  name: "pin",
  description: 'pin a message in the current channel',
  syntax: 'pin',
  example: 'pin (reply to message)',
  permission: "manage_messages",
  run: async(client, message) => {

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return embeds.deny(message, 'I need **Manage Messages** permission to use this command');
    }

    // Check if this is a reply to a message
    if (!message.reference || !message.reference.messageId) {
      return embeds.warn(message, 'Please **reply** to a message to pin it');
    }

    try {
      // Get the message being replied to
      const targetMessage = await message.channel.messages.fetch(message.reference.messageId);

      // Check if message is already pinned
      if (targetMessage.pinned) {
        return embeds.warn(message, 'That message is already pinned');
      }

      // Pin the message
      await targetMessage.pin();

      // React with success emoji instead of sending embed
      return message.react(emojis.success);

    } catch (error) {
      if (error.code === 10008) {
        return embeds.warn(message, 'Message not found or has been deleted.');
      } else if (error.code === 30003) {
        return embeds.warn(message, 'Cannot pin message. This channel has reached the maximum number of pinned messages (50).');
      } else {
        return embeds.warn(message, 'An error occurred while trying to pin the message.');
      }
    }
  }
}
