const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { ensureGuildData } = require('../../database');
const { createConfirmation } = require('../../core/buttons');
const guildCache = require('../../database/cache/models/guild');
const config = require('../../config/setup');
const { findChannel } = require('../../handlers/finder');

module.exports = {
  name: 'poj',
  aliases: ['pingojoin', 'pojping'],
  description: 'Set up ping on join messages that auto-delete after 1 second',
  usage: `{guildprefix}poj add [channel] [message]
{guildprefix}poj remove [channel]
{guildprefix}poj view [channel]
{guildprefix}poj list
{guildprefix}poj reset`,
  permission: 'Manage Guild',
  run: async(client, message, args) => {

    // Show help if no subcommand provided
    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {

      const channelInput = args[1];
      const pojmessage = args.slice(2).join(' ');

      if (!channelInput || !pojmessage) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const pojchannel = channelResult.channel;

      try {
        // Check if this is an update or new addition
        const existingPoj = await guildCache.getPojMessage(message.guild.id, pojchannel.id);
        const isUpdate = !!existingPoj;

        // Add/update the poj message
        await guildCache.addPojMessage(message.guild.id, pojchannel.id, pojmessage);

        const action = isUpdate ? 'Updated the' : 'Created a';
        return embeds.success(message, `${action} **poj message** for ${pojchannel}`);
      } catch (error) {
        if (error.message.includes('Maximum of 5')) {
          return embeds.warn(message, 'You can only have **5 poj channels** per server. Remove one first.');
        }
        console.error('Poj add error:', error);
        return embeds.deny(message, `Failed to set poj message: ${error.message}`);
      }

    } else if (args[0] === 'remove') {

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const pojchannel = channelResult.channel;

      // Check if channel has a poj message
      const existingPoj = await guildCache.getPojMessage(message.guild.id, pojchannel.id);
      if (!existingPoj) {
        return embeds.warn(message, `**${pojchannel.name}** does not have a poj message`);
      }

      try {
        // Remove the poj message
        const removed = await guildCache.removePojMessage(message.guild.id, pojchannel.id);

        if (removed) {
          return embeds.success(message, `Removed the **poj message** for ${pojchannel}`);
        } else {
          return embeds.deny(message, 'Failed to remove poj message');
        }
      } catch (error) {
        console.error('Poj remove error:', error);
        return embeds.deny(message, `Failed to remove poj message: ${error.message}`);
      }

    } else if (args[0] === 'view') {

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const pojchannel = channelResult.channel;

      // Get poj message for this channel
      const pojMessage = await guildCache.getPojMessage(message.guild.id, pojchannel.id);
      if (!pojMessage) {
        return embeds.warn(message, `**${pojchannel.name}** does not have a poj message`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`📌 Poj Message - #${pojchannel.name}`)
        .setColor(config.colors.embed)
        .addFields(
          { name: '**Channel**', value: `${pojchannel}`, inline: true },
          { name: '**Auto-Delete**', value: '1 second', inline: true },
          { name: '**Message**', value: pojMessage.message.length > 1014 ? pojMessage.message.substring(0, 1011) + '...' : pojMessage.message, inline: false }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'list') {

      // Get all poj messages
      const pojMessages = await guildCache.getPojMessages(message.guild.id);

      if (!pojMessages || pojMessages.length === 0) {
        return embeds.info(message, 'No poj messages found in this server');
      }

      const embed = new EmbedBuilder()
        .setTitle('📌 Poj Messages')
        .setColor(config.colors.embed)
        .setFooter({ text: `${pojMessages.length}/5 channels used` })
        .setTimestamp();

      let description = '';
      for (const poj of pojMessages) {
        const channel = message.guild.channels.cache.get(poj.channelId);
        const channelName = channel ? `#${channel.name}` : `<#${poj.channelId}>`;
        
        description += `**${channelName}**\n`;
        description += `> ${poj.message.length > 100 ? poj.message.substring(0, 97) + '...' : poj.message}\n\n`;
      }

      embed.setDescription(description);
      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'reset') {

      // Show confirmation dialog
      const confirmationText = `Are you sure you want to **remove all poj messages** from this server?`;

      await createConfirmation(message, confirmationText, async (interaction) => {
        try {
          await guildCache.clearAllPojMessages(message.guild.id);
          return embeds.success(interaction, 'Successfully **cleared all poj messages**');
        } catch (error) {
          console.error('Poj reset error:', error);
          return embeds.deny(interaction, 'Failed to clear poj messages');
        }
      });

    } else {
      // Invalid subcommand - show help
      return false;
    }
  }
}
