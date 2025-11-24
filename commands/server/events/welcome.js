const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "welcome",
  aliases: ['welc'],
  description: `Set up a welcome message for when new members join`,
  syntax: 'welcome [subcommand] (parameters)',
  example: 'welcome add #general Welcome {user.mention}!',
  permission: "manage_guild",
  isGroupCommand: true,

  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Add or update a welcome message for a channel',
        syntax: '{guildprefix}welcome add [channel] [message]',
        aliases: [],
        parameters: ['channel', 'message'],
        example: '{guildprefix}welcome add #general Welcome {user.mention}!'
      };

      try {
        const channelInput = args[1];
        const welcomemessage = args.slice(2).join(' ');

        if (!channelInput || !welcomemessage) return false;

        // Use universal finder for channel detection
        const channelResult = message.mentions.channels.first() ?
          { found: true, channel: message.mentions.channels.first() } :
          findChannel(message.guild, channelInput);

        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const welcomechannel = channelResult.channel;

        // Check welcome message limit (5 max)
        const currentWelcomeMessages = await guildService.getWelcomeMessages(message.guild.id) || [];
        const existingWelcomeMessage = currentWelcomeMessages.find(wm => wm.channelId === welcomechannel.id);

        if (!existingWelcomeMessage && currentWelcomeMessages.length >= 5) {
          return embeds.deny(message, 'You have reached the **maximum welcome messages (5)**. Please remove some first.');
        }

        // Add welcome message using new cache system
        await guildService.addWelcomeMessage(message.guild.id, welcomechannel.id, welcomemessage);

        const action = existingWelcomeMessage ? 'Updated the' : 'Created a';
        return embeds.success(message, `${action} **welcome message** for ${welcomechannel}`);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, `Failed to set welcome message: ${error.message}`);
      }

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        description: 'Remove a welcome message from a channel',
        syntax: '{guildprefix}welcome remove [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}welcome remove #general'
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

      const welcomechannel = channelResult.channel;

      // Check if welcome message exists for this channel
      const existingWelcomeMessage = await guildService.getWelcomeMessageForChannel(message.guild.id, welcomechannel.id);
      if (!existingWelcomeMessage) {
        return embeds.warn(message, `No **welcome message** exists for ${welcomechannel}`);
      }

      // Remove welcome message using new cache system
      await guildService.removeWelcomeMessage(message.guild.id, welcomechannel.id);

      return embeds.success(message, `Removed the **welcome message** for ${welcomechannel}`);


    } else if (args[0] === 'view') {
      const subcommandInfo = {
        description: 'Preview the welcome message for a channel',
        syntax: '{guildprefix}welcome view [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}welcome view #general'
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

      const welcomechannel = channelResult.channel;

      // Check if welcome message exists for this channel
      const existingWelcomeMessage = await guildService.getWelcomeMessageForChannel(message.guild.id, welcomechannel.id);
      if (!existingWelcomeMessage) {
        return embeds.warn(message, `No **welcome message** to preview for ${welcomechannel}`);
      }

      // Use EmbedVariableProcessor to handle the welcome message with variables
      EmbedVariableProcessor.process(message.channel, existingWelcomeMessage.message, {
        user: message.author,
        guild: message.guild,
        channel: welcomechannel
      });

    } else if (args[0] === 'variables') {
      const subcommandInfo = {
        description: 'Shows available variables for welcome messages',
        syntax: '{guildprefix}welcome variables',
        aliases: [],
        parameters: [],
        example: '{guildprefix}welcome variables'
      };

      const member = message.author;
      const ordinal = (message.guild.memberCount.toString().endsWith(1) && !message.guild.memberCount.toString().endsWith(11)) ? 'st' : (message.guild.memberCount.toString().endsWith(2) && !message.guild.memberCount.toString().endsWith(12)) ? 'nd' : (message.guild.memberCount.toString().endsWith(3) && !message.guild.memberCount.toString().endsWith(13)) ? 'rd' : 'th';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Welcome Message Variables')
        .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{server.humanmembercount}\` — ${message.guild.memberCount + ordinal}`);

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'Lists all configured welcome messages',
        syntax: '{guildprefix}welcome list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}welcome list'
      };

      const welcomeMessages = await guildService.getWelcomeMessages(message.guild.id) || [];

      if (welcomeMessages.length === 0) {
        return embeds.warn(message, 'No **welcome messages** have been setup yet');
      }

      const messageList = welcomeMessages.map((wm, index) => {
        const channel = message.guild.channels.cache.get(wm.channelId);
        const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${wm.channelId})`;
        const messageNumber = (index + 1).toString().padStart(2, '0');
        return `\`${messageNumber}\` ${channelName}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Welcome Messages')
        .setDescription(messageList)
        .setFooter({ text: `${welcomeMessages.length} welcome message${welcomeMessages.length === 1 ? '' : 's'}` });

      return message.channel.send({ embeds: [embed] });

    } else {
      // Invalid subcommand - show help
      return false;
    }
  }
}
