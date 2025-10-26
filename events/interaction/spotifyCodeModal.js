const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getService } = require('@services');
const config = require('../../config/setup');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle button click to show modal
    if (interaction.isButton() && interaction.customId.startsWith('spotify_code_')) {
      const parts = interaction.customId.split('_');
      const userId = parts[2];
      const state = parts[3];

      // Check if the button clicker is the authorized user
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: '❌ This button is not for you!',
          ephemeral: true
        });
      }

      // Create modal
      const modal = new ModalBuilder()
        .setCustomId(`spotify_submit_${userId}_${state}`)
        .setTitle('Enter Spotify Authorization Code');

      const codeInput = new TextInputBuilder()
        .setCustomId('spotify_code')
        .setLabel('Authorization Code')
        .setPlaceholder('Paste your authorization code here')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(500);

      const row = new ActionRowBuilder().addComponents(codeInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    // Handle modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('spotify_submit_')) {
      const parts = interaction.customId.split('_');
      const userId = parts[2];
      const state = parts[3];

      // Check if the submitter is the authorized user
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: '❌ This is not your authorization!',
          ephemeral: true
        });
      }

      const code = interaction.fields.getTextInputValue('spotify_code').trim();

      await interaction.deferReply({ ephemeral: true });

      try {
        const spotifyService = getService('spotify');

        // Verify state token
        const authSession = await spotifyService.getAuthSession(state);
        
        if (!authSession) {
          return interaction.editReply({
            content: '❌ Invalid or expired authorization session. Please run the command again.',
            ephemeral: true
          });
        }

        if (authSession.userId !== userId) {
          return interaction.editReply({
            content: '❌ This authorization session does not belong to you.',
            ephemeral: true
          });
        }

        // Exchange code for tokens
        const tokens = await spotifyService.exchangeCodeForTokens(code);
        
        // Store tokens
        await spotifyService.storeTokens(
          userId,
          tokens.accessToken,
          tokens.refreshToken,
          tokens.expiresIn
        );

        // Get Spotify user profile
        const profile = await spotifyService.getUserProfile(tokens.accessToken);
        await spotifyService.storeSpotifyUserId(userId, profile.id);

        // Delete auth session
        await spotifyService.deleteAuthSession(state);

        // Send success message
        const successEmbed = new EmbedBuilder()
          .setColor(0x1DB954)
          .setTitle('✅ Spotify Linked Successfully')
          .setDescription(
            `Your Spotify account **${profile.display_name || profile.id}** has been linked!\n\n` +
            `You can now use Spotify commands like \`,play\``
          )
          .setThumbnail(profile.images?.[0]?.url || null)
          .setFooter({ text: 'Spotify Integration' })
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        // Also send to channel
        try {
          await interaction.channel.send({
            content: `<@${userId}>`,
            embeds: [successEmbed]
          });
        } catch (err) {
          // Channel message failed, that's okay
        }

      } catch (error) {
        console.error('[Spotify Code Submit] Error:', error);
        
        let errorMessage = 'Failed to link Spotify account. ';
        
        if (error.message.includes('invalid_grant') || error.message.includes('Invalid authorization code')) {
          errorMessage += 'The authorization code is invalid or has expired. Please try again.';
        } else if (error.message.includes('redirect_uri')) {
          errorMessage += 'Redirect URI mismatch. Please contact the bot administrator.';
        } else {
          errorMessage += 'Please try again later.';
        }

        await interaction.editReply({
          content: `❌ ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
};
