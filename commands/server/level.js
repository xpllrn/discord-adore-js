const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embedbuilder');
const config = require('../../config/setup');
const { findChannel } = require('../../handlers/finder');
const { getService } = require('@services');

module.exports = {
  name: "level",
  aliases: ['lvl'],
  description: `Set up custom level up messages for when members level up`,
  permission: "Manage Guild",
  isGroupCommand: true,

  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'message') {
      const subcommandInfo = {
        description: 'Add or update a custom level up message for a channel',
        usage: '{guildprefix}level message [channel] [message]',
        aliases: [],
        parameters: ['channel', 'message'],
        example: '{guildprefix}level message #level-ups {user.mention} leveled up to {level.new_rank}!'
      };

      try {
        const channelInput = args[1];
        const levelMessage = args.slice(2).join(' ');

        if (!channelInput || !levelMessage) return false;

        // Check if the message contains the required {level.new_rank} variable
        if (!levelMessage.includes('{level.new_rank}')) {
          return embeds.deny(message, 'Level up messages **must** include the `{level.new_rank}` variable to show the user\'s new level.');
        }

        // Use universal finder for channel detection
        const channelResult = message.mentions.channels.first() ?
          { found: true, channel: message.mentions.channels.first() } :
          findChannel(message.guild, channelInput);

        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
        }

        const levelChannel = channelResult.channel;

        // Check level message limit (5 max)
        const currentLevelMessages = await guildService.getLevelMessages(message.guild.id) || [];
        const existingLevelMessage = currentLevelMessages.find(lm => lm.channelId === levelChannel.id);

        if (!existingLevelMessage && currentLevelMessages.length >= 5) {
          return embeds.deny(message, 'You have reached the **maximum level messages (5)**. Please remove some first.');
        }

        // Add level message using new cache system
        await guildService.addLevelMessage(message.guild.id, levelChannel.id, levelMessage);

        const action = existingLevelMessage ? 'Updated the' : 'Created a';
        return embeds.success(message, `${action} **level up message** for ${levelChannel}`);
      } catch (error) {
        console.error('Level message add error:', error);
        return embeds.deny(message, `Failed to set level message: ${error.message}`);
      }

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        description: 'Remove a custom level up message from a channel',
        usage: '{guildprefix}level remove [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}level remove #level-ups'
      };

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
      }

      const levelChannel = channelResult.channel;

      // Check if level message exists for this channel
      const existingLevelMessage = await guildService.getLevelMessageForChannel(message.guild.id, levelChannel.id);
      if (!existingLevelMessage) {
        return embeds.warn(message, `No **level up message** exists for ${levelChannel}`);
      }

      // Remove level message using new cache system
      await guildService.removeLevelMessage(message.guild.id, levelChannel.id);

      return embeds.success(message, `Removed the **level up message** for ${levelChannel}`);

    } else if (args[0] === 'view') {
      const subcommandInfo = {
        description: 'Preview the level up message for a channel',
        usage: '{guildprefix}level view [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}level view #level-ups'
      };

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
      }

      const levelChannel = channelResult.channel;

      // Check if level message exists for this channel
      const existingLevelMessage = await guildService.getLevelMessageForChannel(message.guild.id, levelChannel.id);
      if (!existingLevelMessage) {
        return embeds.warn(message, `No **level up message** to preview for ${levelChannel}`);
      }

      // Use EmbedVariableProcessor to handle the level message with variables
      EmbedVariableProcessor.process(message.channel, existingLevelMessage.message, {
        user: message.author,
        guild: message.guild,
        channel: levelChannel,
        level: { new_rank: 25 } // Example level for preview
      });

    } else if (args[0] === 'variables') {
      const subcommandInfo = {
        description: 'Shows available variables for level up messages',
        usage: '{guildprefix}level variables',
        aliases: [],
        parameters: [],
        example: '{guildprefix}level variables'
      };

      const member = message.author;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Level Up Message Variables')
        .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{level.new_rank}\` — Member's new level at time of level up`);

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'Lists all configured level up messages',
        usage: '{guildprefix}level list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}level list'
      };

      const levelMessages = await guildService.getLevelMessages(message.guild.id) || [];

      if (levelMessages.length === 0) {
        return embeds.warn(message, 'No **level up messages** have been setup yet');
      }

      const messageList = levelMessages.map((lm, index) => {
        const channel = message.guild.channels.cache.get(lm.channelId);
        const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${lm.channelId})`;
        const messageNumber = (index + 1).toString().padStart(2, '0');
        return `\`${messageNumber}\` ${channelName}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Level Up Messages')
        .setDescription(messageList)
        .setFooter({ text: `${levelMessages.length} level message${levelMessages.length === 1 ? '' : 's'}` });

      return message.channel.send({ embeds: [embed] });

    } else {
      // Invalid subcommand - show help
      return false;
    }
  }
}