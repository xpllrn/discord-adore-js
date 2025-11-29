const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');

module.exports = {
  name: "topic",
  aliases: ['settopic', 'channeltopic'],
  description: 'Set or clear the topic/description of a channel',
  syntax: 'topic (channel) (description)',
  example: 'topic #general Welcome to our server',
  permission: 'manage_channels',
  run: async(client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    let targetChannel = message.channel;
    let topicText = args.join(' ');

    // Check if first argument is a channel mention
    if (args.length > 0) {
      const channelMention = args[0].match(/^<#(\d+)>$/);
      if (channelMention) {
        targetChannel = message.guild.channels.cache.get(channelMention[1]);
        if (!targetChannel) {
          return embeds.deny(message, `Channel with ID ${channelMention[1]} **not found**`);
        }
        // Remove channel mention from topic text
        topicText = args.slice(1).join(' ');
      }
    }

    // Check if channel is a text channel (topics only work on text channels)
    if (targetChannel.type !== 0) { // 0 = GUILD_TEXT
      return embeds.deny(message, `**#${targetChannel.name}** is not a text channel. Topics can only be set on text channels.`);
    }

    // Handle help command
    if (!topicText || topicText.trim() === '') {
      return runHelpCommand(message, 'topic');
    }

    // Handle clear command
    if (topicText.toLowerCase() === 'clear') {
      try {
        await targetChannel.setTopic(null, `Topic cleared by ${message.author.tag}`);
        return message.react(config.emojis.success);
      } catch (error) {
        return embeds.deny(message, "An error occurred while trying to **clear** the channel topic");
      }
    }

    // Validate topic length (Discord limit is 1024 characters)
    if (topicText.length > 1024) {
      return embeds.deny(message, `Topic is too long! Maximum **1024 characters** allowed`);
    }

    try {
      await targetChannel.setTopic(topicText, `Topic set by ${message.author.tag}`);
      return message.react(config.emojis.success);
    } catch (error) {
      return embeds.deny(message, "An error occurred while trying to **set** the channel topic");
    }
  }
}
