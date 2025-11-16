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
      
      // Check if system is enabled
      if (!confessionConfig.enabled || !confessionConfig.channelId) {
        return interaction.reply({
          content: `${config.emojis.error} <@${interaction.user.id}>: The confession system is not enabled on this server.`,
          ephemeral: true
        });
      }

      // Check if user is ignored
      const isIgnored = await confessionService.isUserIgnored(interaction.guild.id, interaction.user.id);
      if (isIgnored) {
        return interaction.reply({
          content: `${config.emojis.error} <@${interaction.user.id}>: You are not allowed to submit confessions in this server.`,
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

      // Create confession embed
      const confessionEmbed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle(`Anonymous Confession (#${confessionId})`)
        .setDescription(confessionContent)
        .setFooter({ text: `Confession ID: ${confessionId}` })
        .setTimestamp();

      // Create buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confession_submit')
            .setLabel('Submit a Confession')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝'),
          new ButtonBuilder()
            .setCustomId(`confession_reply_${confessionId}`)
            .setLabel('Reply')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💬')
        );

      // Send confession to channel
      await confessionChannel.send({ embeds: [confessionEmbed], components: [row] });

      // Confirm to user
      return interaction.reply({
        content: `${config.emojis.success} <@${interaction.user.id}>: Your confession has been submitted anonymously! (ID: #${confessionId})`,
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
