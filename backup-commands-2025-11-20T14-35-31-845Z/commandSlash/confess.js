const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getService } = require('@services');
const config = require('../config/setup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Submit an anonymous confession')
    .addStringOption(option =>
      option
        .setName('confession')
        .setDescription('Your anonymous confession')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2000)
    ),
  
  async execute(interaction) {
    try {
      const confessionService = getService('confession');
      const confessionConfig = await confessionService.getConfessionConfig(interaction.guild.id);
      
      // Check if system is enabled1
      if (!confessionConfig.enabled || !confessionConfig.channelId) {
        return interaction.reply({
          content: `${config.emojis.error} <@${interaction.user.id}>: The confession system is **not enabled** on this server.`,
          ephemeral: true
        });
      }

      // Check if user is ignored
      const isIgnored = await confessionService.isUserIgnored(interaction.guild.id, interaction.user.id);
      if (isIgnored) {
        return interaction.reply({
          content: `${config.emojis.error} <@${interaction.user.id}>: You are **not allowed** to submit confessions in this server.`,
          ephemeral: true
        });
      }

      const confessionChannel = interaction.guild.channels.cache.get(confessionConfig.channelId);
      if (!confessionChannel) {
        return interaction.reply({
          content: `${config.emojis.error} <@${interaction.user.id}>: The confession channel no longer exists.`,
          ephemeral: true
        });
      }

      const confessionContent = interaction.options.getString('confession');
      const confessionId = await confessionService.getNextConfessionId(interaction.guild.id);

      // Get user's top role color
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const roleColor = member.displayHexColor !== '#000000' ? member.displayHexColor : config.colors.embed;

      // Create confession embed
      const confessionEmbed = new EmbedBuilder()
        .setColor(roleColor)
        .setTitle(`Anonymous Confession (#${confessionId})`)
        .setDescription(confessionContent);

      // Create buttons
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
      await confessionService.addConfession(interaction.guild.id, confessionId, sentMessage.id, interaction.user.id);

      // Confirm to user
      const confirmEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setDescription(`${config.emojis.success} <@${interaction.user.id}>: Your confession has **been submitted**. Confession ID: **${confessionId}**`);

      return interaction.reply({
        embeds: [confirmEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in /confess command:', error);
      
      if (interaction.client?.errorLogger) {
        interaction.client.errorLogger.log(error, 'Slash Confess Command', {
          command: '/confess',
          user: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel
        });
      }

      return interaction.reply({
        content: `${config.emojis.error} <@${interaction.user.id}>: An error occurred while submitting your confession.`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};
