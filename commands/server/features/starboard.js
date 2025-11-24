const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: "starboard",
  aliases: ['board'],
  description: `Set up a starboard system for highlighting popular messages`,
  syntax: 'starboard (set/threshold/emoji/check/unset) <value>',
  example: 'starboard set #starboard',
  permission: "manage_guild",
  isGroupCommand: true,

  run: async(client, message, args) => {
    const { getService } = require('@services');
    const guildService = getService('guild');

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

    if (!args[0]) return false;

    // Ensure guild data exists in the database
    await ensureGuildData(message.guild.id);

    if (args[0] === 'set') {
      const subcommandInfo = {
        name: 'set',
        description: 'Set the starboard channel',
        syntax: '{guildprefix}starboard set <channel>',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}starboard set #starboard'
      };

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error);
      }

      const starboardChannel = channelResult.channel;

      // Check if bot has permissions in the channel
      const botMember = message.guild.members.cache.get(client.user.id);
      if (!starboardChannel.permissionsFor(botMember).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return embeds.warn(message, `I don't have permission to send messages and embed links in ${starboardChannel}`);
      }

      await guildService.setStarboardChannel(message.guild.id, starboardChannel.id);
      return embeds.success(message, `**Starboard enabled!** Set starboard channel to ${starboardChannel}`);

    } else if (args[0] === 'threshold') {
      const subcommandInfo = {
        name: 'threshold',
        description: 'Set the minimum number of reactions needed for a message to appear on the starboard',
        syntax: '{guildprefix}starboard threshold <number>',
        aliases: [],
        parameters: ['number'],
        example: '{guildprefix}starboard threshold 5'
      };

      const thresholdInput = args[1];
      if (!thresholdInput) return false;

      const threshold = parseInt(thresholdInput);
      if (isNaN(threshold) || threshold < 2) {
        return embeds.warn(message, 'Threshold must be a number and at least **2**');
      }

      await guildService.setStarboardThreshold(message.guild.id, threshold);
      return embeds.success(message, `Set **starboard threshold** to **${threshold}** reactions`);

    } else if (args[0] === 'emoji') {
      const subcommandInfo = {
        name: 'emoji',
        description: 'Set the emoji used for starboard reactions',
        syntax: '{guildprefix}starboard emoji <emoji>',
        aliases: [],
        parameters: ['emoji'],
        example: '{guildprefix}starboard emoji ⭐'
      };

      const emojiInput = args[1];
      if (!emojiInput) return false;

      const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
      let emoji = emojiInput;

      if (customEmojiMatch) {
        const emojiId = customEmojiMatch[2];
        const guildEmoji = message.guild.emojis.cache.get(emojiId);

        if (!guildEmoji) {
          return embeds.warn(message, 'Custom emoji **not found** in this server');
        }

        // Ensure proper format with animation flag
        emoji = `<${guildEmoji.animated ? 'a' : ''}:${guildEmoji.name}:${guildEmoji.id}>`;
      } else {
        try {
          await message.react(emojiInput);
          await message.reactions.cache.get(emojiInput)?.users.remove(client.user.id);
        } catch (error) {
          return embeds.warn(message, 'Invalid emoji provided');
        }
      }

      await guildService.setStarboardEmoji(message.guild.id, emoji);
      return embeds.success(message, `Set **starboard emoji** to ${emoji}`);

    } else if (args[0] === 'check') {
      const subcommandInfo = {
        name: 'check',
        description: 'View the current starboard configuration',
        syntax: '{guildprefix}starboard check',
        aliases: [],
        parameters: [],
        example: '{guildprefix}starboard check'
      };

      const starboardChannel = await guildService.getStarboardChannel(message.guild.id);
      const starboardThreshold = await guildService.getStarboardThreshold(message.guild.id);
      const starboardEmoji = await guildService.getStarboardEmoji(message.guild.id);

      if (!starboardChannel) {
        return embeds.warn(message, 'No **starboard channel** has been set up yet');
      }

      const channel = message.guild.channels.cache.get(starboardChannel);
      if (!channel) {
        return embeds.warn(message, 'The starboard channel no longer exists');
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Starboard Configuration')
        .addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Threshold', value: `${starboardThreshold} reactions`, inline: true },
          { name: 'Emoji', value: `${starboardEmoji}`, inline: true }
        );

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'unset') {
      const subcommandInfo = {
        name: 'unset',
        description: 'Disable the starboard system',
        syntax: '{guildprefix}starboard unset',
        aliases: [],
        parameters: [],
        example: '{guildprefix}starboard unset'
      };

      const starboardChannel = await guildService.getStarboardChannel(message.guild.id);
      if (!starboardChannel) {
        return embeds.warn(message, 'Starboard is not currently enabled');
      }

      await guildService.setStarboardChannel(message.guild.id, null);
      return embeds.success(message, 'Disabled the **starboard system**');

    } else {
      // Invalid subcommand - show help
      return false;
    }
  },

  // Starboard utility functions
  createStarboardEmbed(message, reactionCount, emoji) {
    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setAuthor({
        name: message.author.displayName || message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`${message.content || '*No text content*'}`)
      .setTimestamp(message.createdAt);

    // Handle message attachments
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment.contentType && attachment.contentType.startsWith('image/')) {
        embed.setImage(attachment.url);
      }
    }

    if (message.embeds.length > 0) {
      const originalEmbed = message.embeds[0];

      if (originalEmbed.title) embed.setTitle(originalEmbed.title);
      if (originalEmbed.description && !message.content) {
        embed.setDescription(`${originalEmbed.description}`);
      }
      if (originalEmbed.fields && originalEmbed.fields.length > 0) {
        embed.addFields(originalEmbed.fields);
      }
      if (originalEmbed.image) embed.setImage(originalEmbed.image.url);
      if (originalEmbed.thumbnail) embed.setThumbnail(originalEmbed.thumbnail.url);
      if (originalEmbed.footer && !embed.data.footer) {
        embed.setFooter({ text: originalEmbed.footer.text, iconURL: originalEmbed.footer.iconURL });
      }
    }

    return embed;
  },

  createJumpButton(message) {
    const button = new ButtonBuilder()
      .setLabel('Message')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`);

    return new ActionRowBuilder().addComponents(button);
  }
};
