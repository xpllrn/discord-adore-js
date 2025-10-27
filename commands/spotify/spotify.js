const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix, runHelpCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: "spotify",
  aliases: ['sp'],
  description: 'Manage your Spotify account connection',
  usage: '{guildprefix}spotify login\n{guildprefix}spotify logout',
  run: async(_client, message, args) => {
    const spotifyService = getService('spotify');
    const guildprefix = await getGuildPrefix(message.guild.id);
    const subcommand = String(args[0] || '').toLowerCase();

    if (!subcommand || !['link', 'login', 'unlink', 'logout'].includes(subcommand)) {
      return runHelpCommand(message, 'spotify');
    }

    switch (subcommand) {
      case 'link':
      case 'login': {
        try {
          // Check if user already has linked account
          const isLinked = await spotifyService.isLinked(message.author.id);
          
          if (isLinked) {
            return embeds.warn(message, 'Your **Spotify** account is already linked. Use `' + guildprefix + 'spotify logout` to unlink it first.');
          }

          // Create auth session and get OAuth URL
          const { authUrl, stateToken } = await spotifyService.createAuthSession(
            message.author.id,
            message.guild.id
          );

          const embed = new EmbedBuilder()
            .setColor(config.colors.embed)
            .setAuthor({ 
              name: 'Connect your Spotify account',
              iconURL: message.author.displayAvatarURL()
            })
            .setDescription(
              `Authorize **adore** to use your Spotify account. You give us permission to control your active player and show your music statistics through commands.\n\n` +
              `If you want to remove your account with adore, run \`${guildprefix}spotify logout\`.\n -# First time adore user's have to **create a ticket** in [support server](https://discord.gg/qsJMaTURqf) first to use spotify commands.`
            );

          // Create buttons
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Authorize Spotify')
                .setStyle(ButtonStyle.Link)
                .setURL(authUrl),
              new ButtonBuilder()
                .setCustomId(`spotify_code_${message.author.id}_${stateToken}`)
                .setLabel('Enter Code')
                .setStyle(ButtonStyle.Secondary)
            );

          const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

          // Disable buttons after 5 minutes
          setTimeout(async () => {
            try {
              const disabledRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setLabel('Authorize Spotify')
                    .setStyle(ButtonStyle.Link)
                    .setURL(authUrl)
                    .setDisabled(true),
                  new ButtonBuilder()
                    .setCustomId(`spotify_code_expired`)
                    .setLabel('Enter Code')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                );

              await sentMessage.edit({ components: [disabledRow] });
            } catch (err) {
              // Message might be deleted, ignore
            }
          }, 5 * 60 * 1000); // 5 minutes

        } catch (error) {
          console.error('[Spotify Link] Error:', error);
          return embeds.warn(message, 'Failed to create **Spotify** authorization link. Please try again later.');
        }
        break;
      }

      case 'unlink':
      case 'logout': {
        try {
          // Check if user has linked account
          const isLinked = await spotifyService.isLinked(message.author.id);
          
          if (!isLinked) {
            return embeds.warn(message, 'You don\'t have a **Spotify** account linked. Use `' + guildprefix + 'spotify login` to link one.');
          }

          // Use the createConfirmation helper
          const { createConfirmation } = require('../../core/buttons');
          
          await createConfirmation(
            message,
            'Are you sure that you would like to unlink your **Spotify**?',
            async (interaction, confirmMessage) => {
              // On approve - revoke tokens
              await spotifyService.revokeTokens(message.author.id);
              
              // Edit the confirmation message with success
              const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setDescription(`${config.emojis.success} ${message.author}: Your **Spotify** account has been unlinked!`);
              
              await interaction.update({ embeds: [successEmbed], components: [] });
            }
          );

        } catch (error) {
          console.error('[Spotify Unlink] Error:', error);
          return embeds.warn(message, 'Failed to unlink **Spotify** account. Please try again later.');
        }
        break;
      }

      default: {
        return runHelpCommand(message, 'spotify');
      }
    }
  }
};
