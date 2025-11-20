const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const config = require('../../../config/setup');

// SHARED LOGIC: Submit a confession
async function submitConfession(context, confessionText) {
  const confessionService = getService('confession');
  const guild = context.guild;
  const user = context.user || context.author;
  const isInteraction = !!context.user;

  // Get confession config
  const confessionConfig = await confessionService.getConfessionConfig(guild.id);
  
  // Check if system is enabled
  if (!confessionConfig.enabled || !confessionConfig.channelId) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: The confession system is **not enabled** on this server.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: true });
    } else {
      return embeds.deny(context, 'The confession system is not enabled on this server.');
    }
  }

  // Check if user is ignored
  const isIgnored = await confessionService.isUserIgnored(guild.id, user.id);
  if (isIgnored) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: You are **not allowed** to submit confessions in this server.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: true });
    } else {
      return embeds.deny(context, 'You are not allowed to submit confessions in this server.');
    }
  }

  // Get confession channel
  const confessionChannel = guild.channels.cache.get(confessionConfig.channelId);
  if (!confessionChannel) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: The confession channel no longer exists.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: true });
    } else {
      return embeds.deny(context, 'The confession channel no longer exists.');
    }
  }

  // Get next confession ID
  const confessionId = await confessionService.getNextConfessionId(guild.id);

  // Get user's top role color
  const member = await guild.members.fetch(user.id);
  const roleColor = member.displayHexColor !== '#000000' ? member.displayHexColor : config.colors.embed;

  // Create confession embed
  const confessionEmbed = new EmbedBuilder()
    .setColor(roleColor)
    .setTitle(`Anonymous Confession (#${confessionId})`)
    .setDescription(confessionText);

  // Create buttons
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confession_submit')
        .setLabel('Submit a Confession')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('confession_reply')
        .setLabel('Reply')
        .setStyle(ButtonStyle.Secondary)
    );

  // Remove buttons from previous confession if exists
  if (confessionConfig.lastMessageId) {
    try {
      const lastMessage = await confessionChannel.messages.fetch(confessionConfig.lastMessageId);
      if (lastMessage) {
        await lastMessage.edit({ components: [] });
      }
    } catch (error) {
      // Message might be deleted, ignore
    }
  }

  // Send confession to channel
  const sentMessage = await confessionChannel.send({ embeds: [confessionEmbed], components: [row] });
  
  // Track this confession
  await confessionService.addConfession(guild.id, confessionId, sentMessage.id, user.id);

  // Confirm to user
  const confirmEmbed = new EmbedBuilder()
    .setColor(config.colors.success)
    .setDescription(`${config.emojis.success} <@${user.id}>: Your confession has **been submitted**. Confession ID: **${confessionId}**`);

  if (isInteraction) {
    return context.reply({ embeds: [confirmEmbed], ephemeral: true });
  } else {
    return context.channel.send({ embeds: [confirmEmbed] });
  }
}

module.exports = {
  // PREFIX COMMAND
  name: "confess",
  aliases: [],
  description: "Submit an anonymous confession",
  run: async (client, message, args) => {
    try {
      if (args.length === 0) {
        return embeds.deny(message, 'Please provide a confession text.');
      }
      
      const confessionText = args.join(' ');
      return await submitConfession(message, confessionText);
    } catch (error) {
      console.error('Error in confess command:', error);
      
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Confess Command', {
          command: 'confess',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      
      return embeds.deny(message, 'An error occurred while submitting your confession.');
    }
  }
};
