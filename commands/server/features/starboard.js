const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('@services');

// Helper function to create starboard embed
function createStarboardEmbed(message, reactionCount, emoji) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ dynamic: true })
    })
    .setDescription(message.content || '*No text content*')
    .addFields({ name: 'Source', value: `[Jump to message](${message.url})`, inline: true })
    .setFooter({ text: `${emoji} ${reactionCount}` })
    .setTimestamp(message.createdAt);

  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (attachment.contentType?.startsWith('image/')) {
      embed.setImage(attachment.url);
    }
  }

  return embed;
}

// Helper function to create jump button
function createJumpButton(message) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Jump to Message')
      .setStyle(ButtonStyle.Link)
      .setURL(message.url)
  );
}

module.exports = {
  name: "starboard",
  aliases: ['board'],
  description: `Set up a starboard system for highlighting popular messages`,
  syntax: 'starboard [subcommand] (parameters)',
  example: 'starboard set #starboard',
  permission: "manage_guild",
  isGroupCommand: true,

  // Export helper functions for use in reaction events
  createStarboardEmbed,
  createJumpButton,

  subcommands: {
    set: {
      name: 'set',
      aliases: ['channel'],
      description: 'Set the starboard channel',
      syntax: '{guildprefix}starboard set [channel]',
      parameters: ['channel'],
      example: '{guildprefix}starboard set #starboard',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'starboard');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const starboardChannel = channelResult.channel;
        const botMember = message.guild.members.cache.get(client.user.id);
        if (!starboardChannel.permissionsFor(botMember).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
          return embeds.warn(message, `I don't have permission to send messages and embed links in ${starboardChannel}`);
        }

        await guildService.setStarboardChannel(message.guild.id, starboardChannel.id);
        return embeds.success(message, `**Starboard enabled!** Set starboard channel to ${starboardChannel}`);
      }
    },

    threshold: {
      name: 'threshold',
      aliases: ['stars', 'min'],
      description: 'Set the minimum reactions needed',
      syntax: '{guildprefix}starboard threshold [number]',
      parameters: ['number'],
      example: '{guildprefix}starboard threshold 5',

      handler: async (client, message, args, guildService) => {
        const threshold = parseInt(args[0]);

        if (!args[0]) {
          const currentThreshold = await guildService.getStarboardThreshold(message.guild.id);
          return embeds.info(message, `Current starboard threshold: **${currentThreshold}** reactions`);
        }

        if (isNaN(threshold) || threshold < 1 || threshold > 100) {
          return embeds.warn(message, 'Please provide a valid number between **1** and **100**');
        }

        await guildService.setStarboardThreshold(message.guild.id, threshold);
        return embeds.success(message, `Set starboard threshold to **${threshold}** reactions`);
      }
    },

    emoji: {
      name: 'emoji',
      aliases: ['reaction'],
      description: 'Set the starboard emoji',
      syntax: '{guildprefix}starboard emoji [emoji]',
      parameters: ['emoji'],
      example: '{guildprefix}starboard emoji ⭐',

      handler: async (client, message, args, guildService) => {
        const emoji = args[0];

        if (!emoji) {
          const currentEmoji = await guildService.getStarboardEmoji(message.guild.id);
          return embeds.info(message, `Current starboard emoji: ${currentEmoji}`);
        }

        // Validate emoji (basic check)
        const emojiRegex = /^(<a?:\w+:\d+>|[\u{1f300}-\u{1f9ff}]|[\u{2600}-\u{26ff}]|[\u{2700}-\u{27bf}]|⭐|🌟|✨|💫|🔥|❤️|👍|👎|😂|😍|🎉|🙌)$/u;
        if (!emojiRegex.test(emoji) && !emoji.match(/<a?:\w+:\d+>/)) {
          return embeds.warn(message, 'Please provide a valid emoji');
        }

        await guildService.setStarboardEmoji(message.guild.id, emoji);
        return embeds.success(message, `Set starboard emoji to ${emoji}`);
      }
    },

    check: {
      name: 'check',
      aliases: ['status', 'info'],
      description: 'Check current starboard settings',
      syntax: '{guildprefix}starboard check',
      parameters: [],
      example: '{guildprefix}starboard check',

      handler: async (client, message, args, guildService) => {
        const channelId = await guildService.getStarboardChannel(message.guild.id);
        const threshold = await guildService.getStarboardThreshold(message.guild.id);
        const emoji = await guildService.getStarboardEmoji(message.guild.id);

        if (!channelId) {
          return embeds.warn(message, 'Starboard is not configured. Use `starboard set #channel` to set it up.');
        }

        const channel = message.guild.channels.cache.get(channelId);
        const channelDisplay = channel ? `<#${channel.id}>` : 'Unknown Channel';

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Starboard Settings')
          .addFields(
            { name: 'Channel', value: channelDisplay, inline: true },
            { name: 'Threshold', value: `${threshold} reactions`, inline: true },
            { name: 'Emoji', value: emoji, inline: true }
          );

        return message.channel.send({ embeds: [embed] });
      }
    },

    unset: {
      name: 'unset',
      aliases: ['disable', 'remove', 'off'],
      description: 'Disable the starboard',
      syntax: '{guildprefix}starboard unset',
      parameters: [],
      example: '{guildprefix}starboard unset',

      handler: async (client, message, args, guildService) => {
        const channelId = await guildService.getStarboardChannel(message.guild.id);

        if (!channelId) {
          return embeds.warn(message, 'Starboard is not currently enabled');
        }

        await guildService.setStarboardChannel(message.guild.id, null);
        return embeds.success(message, 'Starboard has been **disabled**');
      }
    }
  },

  run: async (client, message, args) => {
    await ensureGuildData(message.guild.id);
    const guildService = getService('guild');

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'starboard');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'starboard');
  }
};
