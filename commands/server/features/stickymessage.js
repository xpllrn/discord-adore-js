const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { createPagination } = require('../../../core/buttons');
const { getService } = require('@services');

module.exports = {
  name: "stickymessage",
  aliases: ['sticky', 'sm'],
  description: `Set up sticky messages that stay at the bottom of channels`,
  syntax: 'stickymessage [subcommand] (parameters)',
  example: 'stickymessage add #general Welcome to the channel!',
  permission: "manage_channels",
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['set', 'create'],
      description: 'Add a sticky message to a channel',
      syntax: '{guildprefix}stickymessage add [channel] [message]',
      parameters: ['channel', 'message'],
      example: '{guildprefix}stickymessage add #general Welcome to the channel!',

      handler: async (client, message, args, guildService) => {
        if (args.length < 2) return runHelpCommand(message, 'stickymessage');

        const channelInput = args[0];
        const channelResult = findChannel(message.guild, channelInput);
        
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const targetChannel = channelResult.channel;

        // Check bot permissions in target channel
        const botMember = message.guild.members.cache.get(client.user.id);
        if (!targetChannel.permissionsFor(botMember).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages])) {
          return embeds.warn(message, `I need **Send Messages** and **Manage Messages** permissions in ${targetChannel}`);
        }

        const stickyContent = args.slice(1).join(' ');

        if (!stickyContent || stickyContent.trim().length === 0) {
          return runHelpCommand(message, 'stickymessage');
        }

        if (stickyContent.length > 2000) {
          return embeds.deny(message, `Message cannot exceed **2000 characters**. Yours is **${stickyContent.length}**`);
        }

        // Check limit (max 10 sticky messages per guild)
        const existingStickies = await guildService.getStickyMessages(message.guild.id);
        const existingForChannel = existingStickies.find(s => s.channelId === targetChannel.id);
        
        if (!existingForChannel && existingStickies.length >= 10) {
          return embeds.deny(message, 'You have reached the **maximum sticky messages (10)**. Please remove some first.');
        }

        // Add the sticky message
        await guildService.addStickyMessage(message.guild.id, targetChannel.id, stickyContent, message.author.id);

        // Send the initial sticky message
        await sendStickyMessage(client, targetChannel, stickyContent, guildService, message.guild.id);

        const action = existingForChannel ? 'Updated' : 'Added';
        return embeds.success(message, `${action} **sticky message** for ${targetChannel}`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'rm', 'del'],
      description: 'Remove a sticky message from a channel',
      syntax: '{guildprefix}stickymessage remove [channel]',
      parameters: ['channel'],
      example: '{guildprefix}stickymessage remove #general',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return runHelpCommand(message, 'stickymessage');

        const channelInput = args[0];
        const channelResult = findChannel(message.guild, channelInput);
        
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const targetChannel = channelResult.channel;

        // Get the sticky message to delete the current message
        const stickyData = await guildService.getStickyMessage(message.guild.id, targetChannel.id);
        
        if (!stickyData) {
          return embeds.deny(message, `No **sticky message** found for ${targetChannel}`);
        }

        // Try to delete the current sticky message
        if (stickyData.currentMessageId) {
          try {
            const oldMessage = await targetChannel.messages.fetch(stickyData.currentMessageId);
            await oldMessage.delete();
          } catch (e) {
            // Message might already be deleted
          }
        }

        // Remove from database
        await guildService.removeStickyMessage(message.guild.id, targetChannel.id);

        return embeds.success(message, `Removed **sticky message** from ${targetChannel}`);
      }
    },

    view: {
      name: 'view',
      aliases: ['show', 'check'],
      description: 'View the sticky message for a channel',
      syntax: '{guildprefix}stickymessage view [channel]',
      parameters: ['channel'],
      example: '{guildprefix}stickymessage view #general',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return runHelpCommand(message, 'stickymessage');

        const channelInput = args[0];
        const channelResult = findChannel(message.guild, channelInput);
        
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const targetChannel = channelResult.channel;
        const stickyData = await guildService.getStickyMessage(message.guild.id, targetChannel.id);

        if (!stickyData) {
          return embeds.warn(message, `No **sticky message** found for ${targetChannel}`);
        }

        // Check if it's an embed message
        const trimmedMessage = stickyData.message.trim();
        const isEmbed = trimmedMessage.startsWith('{embed}') || trimmedMessage.startsWith('{v2}') || trimmedMessage.startsWith('{container}');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle(`Sticky Message for #${targetChannel.name}`)
          .addFields(
            { name: 'Type', value: isEmbed ? 'Embed/Container' : 'Text', inline: true },
            { name: 'Created By', value: `<@${stickyData.createdBy}>`, inline: true }
          )
          .setFooter({ text: `Created at ${new Date(stickyData.createdAt).toLocaleString()}` });

        // Show message preview (truncated if too long)
        const preview = stickyData.message.length > 1000 
          ? stickyData.message.substring(0, 1000) + '...' 
          : stickyData.message;
        
        embed.setDescription(`\`\`\`\n${preview}\n\`\`\``);

        return message.channel.send({ embeds: [embed] });
      }
    },

    list: {
      name: 'list',
      aliases: ['all'],
      description: 'List all sticky messages in the server',
      syntax: '{guildprefix}stickymessage list',
      parameters: [],
      example: '{guildprefix}stickymessage list',

      handler: async (client, message, args, guildService) => {
        const stickyMessages = await guildService.getStickyMessages(message.guild.id);

        if (!stickyMessages || stickyMessages.length === 0) {
          return embeds.warn(message, 'No **sticky messages** configured');
        }

        const formatPage = (pageStickies, currentPage, totalPages) => {
          const startIndex = (currentPage - 1) * 8;
          const stickyList = pageStickies.map((sticky, index) => {
            const number = (startIndex + index + 1).toString().padStart(2, '0');
            const channel = message.guild.channels.cache.get(sticky.channelId);
            const channelDisplay = channel ? `<#${channel.id}>` : `Unknown (${sticky.channelId})`;
            const preview = sticky.message.length > 50 
              ? sticky.message.substring(0, 50) + '...' 
              : sticky.message;
            return `\`${number}\` ${channelDisplay}\n> ${preview}`;
          }).join('\n\n');

          const entryText = stickyMessages.length === 1 ? 'sticky message' : 'sticky messages';
          return new EmbedBuilder()
            .setColor(config.colors.embed)
            .setTitle('Sticky Messages')
            .setDescription(stickyList)
            .setFooter({ text: `${stickyMessages.length} ${entryText} || page ${currentPage}/${totalPages}` });
        };

        await createPagination(message, stickyMessages, formatPage, 8, 'Sticky Messages');
      }
    }
  },

  run: async (client, message, args) => {
    await ensureGuildData(message.guild.id);
    const guildService = getService('guild');

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'stickymessage');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'stickymessage');
  }
};

// Helper function to send sticky message
async function sendStickyMessage(client, channel, content, guildService, guildId) {
  try {
    const trimmedContent = content.trim();
    let sentMessage;

    // Check if it's an embed message
    if (trimmedContent.startsWith('{embed}') || trimmedContent.startsWith('{v2}') || trimmedContent.startsWith('{container}')) {
      const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
      const variables = {
        guild: channel.guild,
        channel: channel
      };
      
      // Process the embed (sends internally)
      EmbedVariableProcessor.process(channel, content, variables, null);
      
      // Wait for message to be sent, then fetch the latest bot message
      await new Promise(resolve => setTimeout(resolve, 500));
      const recentMessages = await channel.messages.fetch({ limit: 5 });
      sentMessage = recentMessages.find(m => m.author.id === client.user.id);
    } else {
      sentMessage = await channel.send(content);
    }

    // Update the message ID in database
    if (sentMessage && sentMessage.id) {
      await guildService.updateStickyMessageId(guildId, channel.id, sentMessage.id);
    }

    return sentMessage;
  } catch (error) {
    console.error('Error sending sticky message:', error);
    return null;
  }
}

// Export the helper for use in message handler
module.exports.sendStickyMessage = sendStickyMessage;
