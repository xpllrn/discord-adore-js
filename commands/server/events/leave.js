const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "leave",
  aliases: ['bye'],
  description: `Set up a leave message for when members leave`,
  syntax: 'leave [subcommand] (parameters)',
  example: 'leave add #general Goodbye {user.name}!',
  permission: "manage_guild",
  isGroupCommand: true,

  run: async(client, message, args) => {
    const guildService = getService('guild');

    // Show help if no subcommand provided
    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Add or update a leave message for a channel',
        usage: '{guildprefix}leave add [channel] [message]',
        aliases: [],
        parameters: ['channel', 'message'],
        example: '{guildprefix}leave add #general Goodbye {user.name}!'
      };

      const channelInput = args[1];
      const leavemessage = args.slice(2).join(' ');

      if (!channelInput || !leavemessage) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error);
      }

      const leavechannel = channelResult.channel;

      // Check leave message limit (5 max)
      const currentLeaveMessages = await guildService.getLeaveMessages(message.guild.id) || [];
      const existingLeaveMessage = currentLeaveMessages.find(lm => lm.channelId === leavechannel.id);

      if (!existingLeaveMessage && currentLeaveMessages.length >= 5) {
        return embeds.deny(message, 'You have reached the **maximum leave messages (5)**. Please remove some first.');
      }

      try {

        // Add leave message using new cache system
        await guildService.addLeaveMessage(message.guild.id, leavechannel.id, leavemessage);

        const action = existingLeaveMessage ? 'Updated the' : 'Created a';
        return embeds.success(message, `${action} **leave message** for ${leavechannel}`);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, `Failed to set leave message: ${error.message}`);
      }

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        description: 'Remove a leave message from a channel',
        usage: '{guildprefix}leave remove [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}leave remove #general'
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

      const leavechannel = channelResult.channel;

      // Check if leave message exists for this channel
      const existingLeaveMessage = await guildService.getLeaveMessageForChannel(message.guild.id, leavechannel.id);
      if (!existingLeaveMessage) {
        return embeds.warn(message, `No **leave message** exists for ${leavechannel}`);
      }

      try {
        // Remove leave message using new cache system
        await guildService.removeLeaveMessage(message.guild.id, leavechannel.id);

        return embeds.success(message, `Removed the **leave message** for ${leavechannel}`);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.error(message, `Failed to remove leave message: ${error.message}`);
      }

    } else if (args[0] === 'view') {
      const subcommandInfo = {
        description: 'Preview the leave message for a channel',
        usage: '{guildprefix}leave view [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}leave view #general'
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

      const leavechannel = channelResult.channel;

      // Check if leave message exists for this channel
      const existingLeaveMessage = await guildService.getLeaveMessageForChannel(message.guild.id, leavechannel.id);
      if (!existingLeaveMessage) {
        return embeds.warn(message, `No **leave message** to preview for ${leavechannel}`);
      }

      // Use EmbedVariableProcessor to handle the leave message with variables
      EmbedVariableProcessor.process(message.channel, existingLeaveMessage.message, {
        user: message.author,
        guild: message.guild,
        channel: leavechannel
      });

    } else if (args[0] === 'variables') {
      const subcommandInfo = {
        description: 'Shows available variables for leave messages',
        usage: '{guildprefix}leave variables',
        aliases: [],
        parameters: [],
        example: '{guildprefix}leave variables'
      };

      const member = message.author;
      const ordinal = (message.guild.memberCount.toString().endsWith(1) && !message.guild.memberCount.toString().endsWith(11)) ? 'st' : (message.guild.memberCount.toString().endsWith(2) && !message.guild.memberCount.toString().endsWith(12)) ? 'nd' : (message.guild.memberCount.toString().endsWith(3) && !message.guild.memberCount.toString().endsWith(13)) ? 'rd' : 'th';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Leave Message Variables')
        .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{server.humanmembercount}\` — ${message.guild.memberCount + ordinal}`);

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'Lists all configured leave messages',
        usage: '{guildprefix}leave list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}leave list'
      };

      const leaveMessages = await guildService.getLeaveMessages(message.guild.id) || [];

      if (leaveMessages.length === 0) {
        return embeds.warn(message, 'No **leave messages** have been setup yet');
      }

      const messageList = leaveMessages.map((lm, index) => {
        const channel = message.guild.channels.cache.get(lm.channelId);
        const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${lm.channelId})`;
        const messageNumber = (index + 1).toString().padStart(2, '0');
        return `\`${messageNumber}\` ${channelName}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Leave Messages')
        .setDescription(messageList)
        .setFooter({ text: `${leaveMessages.length} leave message${leaveMessages.length === 1 ? '' : 's'}` });

      return message.channel.send({ embeds: [embed] });

    } else {
      // Invalid subcommand - show help
      return false;
    }
  }
}
