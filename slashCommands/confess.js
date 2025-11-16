const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getService } = require('@services');
const config = require('../config/setup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Submit an anonymous confession'),
  
  async execute(interaction) {
    try {
      const confessionService = getService('confession');
      const confessionConfig = await confessionService.getConfessionConfig(interaction.guild.id);
      
      // Check if system is enabled
      if (!confessionConfig.enabled || !confessionConfig.channelId) {
        return interaction.reply({
          content: '❌ The confession system is **not enabled** on this server. Please use`,confession channel #channel`',
          ephemeral: true
        });
      }

      // Check if user is ignored
      const isIgnored = await confessionService.isUserIgnored(interaction.guild.id, interaction.user.id);
      if (isIgnored) {
        return interaction.reply({
          content: '❌ You are not allowed to submit confessions in this server.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Anonymous Confession System')
        .setDescription('Please use the confess button below to create a confession');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confession_submit')
            .setLabel('Submit a Confession')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝')
        );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } catch (error) {
      console.error('Error in /confess command:', error);
      return interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
};
