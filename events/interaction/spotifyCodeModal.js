const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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
          flags: MessageFlags.Ephemeral
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
      // Extract userId and state from customId
      // Format: spotify_submit_${userId}_${state}
      const customId = interaction.customId;
      const prefix = 'spotify_submit_';
      const afterPrefix = customId.substring(prefix.length);
      const firstUnderscoreIndex = afterPrefix.indexOf('_');

      const userId = afterPrefix.substring(0, firstUnderscoreIndex);
      const state = afterPrefix.substring(firstUnderscoreIndex + 1);

      // Check if the submitter is the authorized user
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: '❌ This is not your authorization!',
          flags: MessageFlags.Ephemeral
        });
      }

      const code = interaction.fields.getTextInputValue('spotify_code').trim();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const spotifyService = getService('spotify');

      try {

        // Verify state token
        const authSession = await spotifyService.getAuthSession(state);

        if (!authSession) {
          return interaction.editReply({
            content: '❌ Invalid or expired authorization session. Please run the command again.'
          });
        }

        if (authSession.userId !== userId) {
          return interaction.editReply({
            content: '❌ This authorization session does not belong to you.'
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
        let profileName = 'your Spotify account';
        try {
          const profile = await spotifyService.getUserProfile(tokens.accessToken);
          profileName = profile.display_name || profile.id;
          await spotifyService.storeSpotifyUserId(userId, profile.id);
        } catch (profileError) {
          // Continue anyway - profile is not critical for basic functionality
        }

        // Delete auth session
        await spotifyService.deleteAuthSession(userId);

        // Prepare success message
        let successMessage;
        if (profileName !== 'your Spotify account') {
          successMessage = `${config.emojis.success} <@${userId}>: Your **Discord account** has been connected to **${profileName}**!\n\n` +
            `-# First time **adore** users have to **create a ticket** in the [\`support server\`](https://discord.gg/qsJMaTURqf) to get approved for **Spotify commands**.`;
        } else {
          successMessage = `${config.emojis.success} <@${userId}>: Your **Discord account** has been connected to your **Spotify account**!\n\n` +
            `-# First time **adore** users have to **create a ticket** in the [\`support server\`](https://discord.gg/qsJMaTURqf) to get approved for **Spotify commands**.`;
        }

        const successEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(successMessage);

        // Update the ephemeral modal reply with success message
        await interaction.editReply({ embeds: [successEmbed] }).catch(() => {});

        // Try to find and edit the original authorization message
        try {
          const messages = await interaction.channel.messages.fetch({ limit: 20 });
          const authMessage = messages.find(msg => 
            msg.author.id === interaction.client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].author?.name === 'Connect your Spotify account' &&
            msg.interaction?.user?.id === userId
          );

          if (authMessage) {
            await authMessage.edit({ embeds: [successEmbed], components: [] });
          }
        } catch (err) {
          // Couldn't edit original message, that's okay - ephemeral reply already shows success
        }

      } catch (error) {
        const logger = require('../../utils/logger');
        logger.webhook.error(error);

        let errorMessage = 'Failed to link Spotify account. ';
        let showTicketMessage = false;

        if (error.message.includes('invalid_grant') || error.message.includes('Invalid authorization code')) {
          errorMessage += 'The authorization code is invalid or has expired. Please try again.';
        } else if (error.message.includes('redirect_uri')) {
          errorMessage += 'Redirect URI mismatch. Please contact the bot administrator.';
        } else {
          // Most likely the user is not in the Spotify Developer beta list
          errorMessage = 'Your **Spotify account** is not approved for **adore** yet.';
          showTicketMessage = true;
        }

        // Delete auth session on error
        await spotifyService.deleteAuthSession(userId).catch(() => {});

        const errorEmbed = new EmbedBuilder()
          .setColor(config.colors.error)
          .setDescription(
            showTicketMessage 
              ? `❌ <@${userId}>: ${errorMessage}\n\n` +
                `**Create a ticket** in the [\`support server\`](https://discord.gg/qsJMaTURqf) and provide your **Spotify email** to get added to the beta list.`
              : `❌ ${errorMessage}`
          );

        await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
      }
    }
  }
};
