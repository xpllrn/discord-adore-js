const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix, runHelpCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: "spotify",
  aliases: ['sp'],
  description: 'Manage your Spotify account connection',
  usage: '{guildprefix}spotify login\n{guildprefix}spotify logout',
  run: async(client, message, args) => {
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
              `If you want to remove your account with adore, run \`${guildprefix}spotify logout\` and visit your settings on **Spotify** to unauthorize our application.`
            );

          // Create buttons
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Authorize Spotify')
                .setStyle(ButtonStyle.Secondary)
                .setURL(authUrl)
                .setEmoji(config.emojis.spotify),
              new ButtonBuilder()
                .setCustomId(`spotify_code_${message.author.id}_${stateToken}`)
                .setLabel('Enter Code')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📝')
            );

          const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

          // Disable buttons after 5 minutes
          setTimeout(async () => {
            try {
              const disabledRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setLabel('Authorize Spotify')
                    .setStyle(ButtonStyle.Secondary)
                    .setURL(authUrl)
                    .setEmoji(config.emojis.spotify)
                    .setDisabled(true),
                  new ButtonBuilder()
                    .setCustomId(`spotify_code_expired`)
                    .setLabel('Enter Code')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📝')
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

          // Create confirmation embed
          const confirmEmbed = new EmbedBuilder()
            .setColor(config.colors.warn)
            .setDescription(`${config.emojis.warn} Are you sure that you would like to unlink your **Spotify**?`);

          const confirmRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`spotify_unlink_confirm_${message.author.id}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success)
                .setEmoji(config.emojis.success),
              new ButtonBuilder()
                .setCustomId(`spotify_unlink_cancel_${message.author.id}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji(config.emojis.cancel)
            );

          const confirmMessage = await message.channel.send({ embeds: [confirmEmbed], components: [confirmRow] });

          // Create collector for button interaction
          const filter = i => i.user.id === message.author.id && (i.customId.startsWith('spotify_unlink_confirm_') || i.customId.startsWith('spotify_unlink_cancel_'));
          const collector = confirmMessage.createMessageComponentCollector({ filter, time: 30000, max: 1 });

          collector.on('collect', async i => {
            if (i.customId.startsWith('spotify_unlink_confirm_')) {
              // Revoke tokens
              await spotifyService.revokeTokens(message.author.id);

              const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setDescription(`${config.emojis.spotify} ${message.author}: Your **Spotify** account has been unlinked!`);

              await i.update({ embeds: [successEmbed], components: [] });
            } else {
              const cancelEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setDescription(`${config.emojis.cancel} Cancelled **Spotify** unlink.`);

              await i.update({ embeds: [cancelEmbed], components: [] });
            }
          });

          collector.on('end', collected => {
            if (collected.size === 0) {
              // Timeout - disable buttons
              const disabledRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('spotify_unlink_confirm_expired')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(config.emojis.success)
                    .setDisabled(true),
                  new ButtonBuilder()
                    .setCustomId('spotify_unlink_cancel_expired')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(config.emojis.cancel)
                    .setDisabled(true)
                );

              confirmMessage.edit({ components: [disabledRow] }).catch(() => {});
            }
          });

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
