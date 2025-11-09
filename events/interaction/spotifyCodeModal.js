const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
      // Extract userId and state from customId
      // Format: spotify_submit_${userId}_${state}
      const customId = interaction.customId;
      const prefix = 'spotify_submit_';
      const afterPrefix = customId.substring(prefix.length);
      const firstUnderscoreIndex = afterPrefix.indexOf('_');

      const userId = afterPrefix.substring(0, firstUnderscoreIndex);
      const state = afterPrefix.substring(firstUnderscoreIndex + 1);

      console.log(`[Spotify Modal] CustomId: ${customId}`);
      console.log(`[Spotify Modal] Extracted userId: ${userId}`);
      console.log(`[Spotify Modal] Extracted state: ${state}`);

      // Check if the submitter is the authorized user
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: '❌ This is not your authorization!',
          ephemeral: true
        });
      }

      const code = interaction.fields.getTextInputValue('spotify_code').trim();

      console.log(`[Spotify Modal] User ${userId} submitted code`);
      console.log(`[Spotify Modal] State token: ${state}`);
      console.log(`[Spotify Modal] Code length: ${code.length}`);

      await interaction.deferReply({ ephemeral: true });

      try {
        const spotifyService = getService('spotify');

        // Verify state token
        console.log(`[Spotify Modal] Looking up auth session for state: ${state}`);
        const authSession = await spotifyService.getAuthSession(state);

        console.log(`[Spotify Modal] Auth session found:`, authSession ? 'YES' : 'NO');
        if (authSession) {
          console.log(`[Spotify Modal] Auth session userId: ${authSession.userId}`);
          console.log(`[Spotify Modal] Expected userId: ${userId}`);
          console.log(`[Spotify Modal] Auth session created: ${authSession.createdAt}`);
        }

        if (!authSession) {
          console.log(`[Spotify Modal] ERROR: No auth session found for state ${state}`);
          return interaction.editReply({
            content: '❌ Invalid or expired authorization session. Please run the command again.',
            ephemeral: true
          });
        }

        if (authSession.userId !== userId) {
          console.log(`[Spotify Modal] ERROR: User ID mismatch`);
          return interaction.editReply({
            content: '❌ This authorization session does not belong to you.',
            ephemeral: true
          });
        }

        console.log(`[Spotify Modal] Auth session verified successfully`);

        // Exchange code for tokens
        console.log(`[Spotify Modal] Exchanging code for tokens...`);
        const tokens = await spotifyService.exchangeCodeForTokens(code);
        console.log(`[Spotify Modal] Tokens received successfully`);

        // Store tokens
        console.log(`[Spotify Modal] Storing tokens for user ${userId}`);
        await spotifyService.storeTokens(
          userId,
          tokens.accessToken,
          tokens.refreshToken,
          tokens.expiresIn
        );
        console.log(`[Spotify Modal] Tokens stored successfully`);

        // Get Spotify user profile (optional - not critical for linking)
        console.log(`[Spotify Modal] Fetching Spotify user profile...`);
        let profileName = 'your Spotify account';
        try {
          const profile = await spotifyService.getUserProfile(tokens.accessToken);
          console.log(`[Spotify Modal] Profile fetched: ${profile.display_name || profile.id}`);
          profileName = profile.display_name || profile.id;

          await spotifyService.storeSpotifyUserId(userId, profile.id);
          console.log(`[Spotify Modal] Spotify user ID stored`);
        } catch (profileError) {
          console.log(`[Spotify Modal] Could not fetch profile (non-critical): ${profileError.message}`);
          // Continue anyway - profile is not critical for basic functionality
        }

        // Delete auth session
        console.log(`[Spotify Modal] Deleting auth session`);
        await spotifyService.deleteAuthSession(userId);
        console.log(`[Spotify Modal] Auth session deleted`);

        // Dismiss the ephemeral modal reply
        await interaction.deleteReply().catch(() => {});

        // Find and edit the original authorization message
        try {
          // Get the message that contains the authorization buttons
          const messages = await interaction.channel.messages.fetch({ limit: 20 });
          const authMessage = messages.find(msg => 
            msg.author.id === interaction.client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].author?.name === 'Connect your Spotify account'
          );

          let successMessage;
          
          // If we got the profile name, show it. Otherwise show ticket message
          if (profileName !== 'your Spotify account') {
            successMessage = `${config.emojis.success} <@${userId}>: Your **Discord account** has been connected to **${profileName}**!`;
          } else {
            successMessage = `${config.emojis.success} <@${userId}>: Your **Discord account** has been connected to your **Spotify account**!\n\n` +
              `**vleed** user's have to **create a ticket** in [\`support server\`](https://discord.gg/qsJMaTURqf) first to use **spotify commands**.`;
          }

          const successEmbed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setDescription(successMessage);

          if (authMessage) {
            await authMessage.edit({ embeds: [successEmbed], components: [] });
          } else {
            await interaction.channel.send({ embeds: [successEmbed] });
          }
        } catch (err) {
          // Couldn't edit original message, send to channel as fallback
          console.log('[Spotify Modal] Could not edit original message:', err.message);
          
          let successMessage;
          if (profileName !== 'your Spotify account') {
            successMessage = `${config.emojis.success} <@${userId}>: Your **Discord account** has been connected to **${profileName}**!`;
          } else {
            successMessage = `${config.emojis.success} <@${userId}>: Your **Discord account** has been connected to your **Spotify account**!\n\n` +
              `**vleed** user's have to **create a ticket** in [\`support server\`](https://discord.gg/qsJMaTURqf) first to use **spotify commands**.`;
          }

          const successEmbed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setDescription(successMessage);

          await interaction.channel.send({ embeds: [successEmbed] }).catch(() => {});
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
