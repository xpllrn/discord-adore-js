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
            return embeds.warn(message, 'Your Spotify account is already linked. Use `' + guildprefix + 'spotify unlink` to unlink it first.');
          }

          // Create auth session and get OAuth URL
          const { authUrl, state } = await spotifyService.createAuthSession(
            message.author.id,
            message.guild.id
          );

          const embed = new EmbedBuilder()
            .setColor(0x1DB954) // Spotify green
            .setAuthor({ 
              name: 'Connect your Spotify account',
              iconURL: message.author.displayAvatarURL()
            })
            .setDescription(
              `Authorize **adore** to use your Spotify account. You give us permission to control your active player and show your music statistics through commands.\n\n` +
              `**How to connect:**\n` +
              `1️⃣ Click "Authorize Spotify" below\n` +
              `2️⃣ Copy the authorization code from the page\n` +
              `3️⃣ Click "Enter Code" and paste it\n\n` +
              `If you want to remove your account with adore, run \`${guildprefix}spotify logout\` and visit your settings on Spotify to unauthorize our application.\n\n` +
              `⏱️ Authorization expires in **10 minutes**.`
            )
            .setFooter({ text: 'Spotify Integration' })
            .setTimestamp();

          // Create buttons
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Authorize Spotify')
                .setStyle(ButtonStyle.Link)
                .setURL(authUrl)
                .setEmoji('🎵'),
              new ButtonBuilder()
                .setCustomId(`spotify_code_${message.author.id}_${state}`)
                .setLabel('Enter Code')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📝')
            );

          await message.channel.send({ embeds: [embed], components: [row] });

        } catch (error) {
          console.error('[Spotify Link] Error:', error);
          return embeds.warn(message, 'Failed to create Spotify authorization link. Please try again later.');
        }
        break;
      }

      case 'unlink':
      case 'logout': {
        try {
          // Check if user has linked account
          const isLinked = await spotifyService.isLinked(message.author.id);
          
          if (!isLinked) {
            return embeds.warn(message, 'You don\'t have a Spotify account linked. Use `' + guildprefix + 'spotify link` to link one.');
          }

          // Revoke tokens
          await spotifyService.revokeTokens(message.author.id);

          const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Spotify Unlinked')
            .setDescription('Your Spotify account has been unlinked successfully.\n\nAll stored tokens have been removed.')
            .setFooter({ text: 'Spotify Integration' })
            .setTimestamp();

          return message.channel.send({ embeds: [embed] });

        } catch (error) {
          console.error('[Spotify Unlink] Error:', error);
          return embeds.warn(message, 'Failed to unlink Spotify account. Please try again later.');
        }
        break;
      }

      default: {
        return runHelpCommand(message, 'spotify');
      }
    }
  }
};
