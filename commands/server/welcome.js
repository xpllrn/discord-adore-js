const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embedbuilder');
const config = require('../../config/setup');
const { findChannel } = require('../../handlers/finder');
const { getService } = require('@services');

module.exports = {
  name: "welcome",
  aliases: ['welc'],
  description: `Set up a welcome message for when new members join`,
  usage: `{guildprefix}welcome add [channel] [message]
{guildprefix}welcome remove [channel]
{guildprefix}welcome view [channel]
{guildprefix}welcome list

{guildprefix}welcome variables`,
  permission: "Manage Guild",

  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      try {
        const channelInput = args[1];
        const welcomemessage = args.slice(2).join(' ');

        if (!channelInput || !welcomemessage) return false;

        // Use universal finder for channel detection
        const channelResult = message.mentions.channels.first() ?
          { found: true, channel: message.mentions.channels.first() } :
          findChannel(message.guild, channelInput);

        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
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
        console.error('Welcome add error:', error);
        return embeds.deny(message, `Failed to set welcome message: ${error.message}`);
      }

    } else if (args[0] === 'remove') {

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
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

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error || `I was unable to find a channel with the name: ${channelInput}`);
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

      const member = message.author;
      const ordinal = (message.guild.memberCount.toString().endsWith(1) && !message.guild.memberCount.toString().endsWith(11)) ? 'st' : (message.guild.memberCount.toString().endsWith(2) && !message.guild.memberCount.toString().endsWith(12)) ? 'nd' : (message.guild.memberCount.toString().endsWith(3) && !message.guild.memberCount.toString().endsWith(13)) ? 'rd' : 'th';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Welcome Message Variables')
        .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{server.humanmembercount}\` — ${message.guild.memberCount + ordinal}`);

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'list') {

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
