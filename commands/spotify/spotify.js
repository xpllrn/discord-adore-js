const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix, runHelpCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: "spotify",
  aliases: ['sp'],
  description: 'Manage your Spotify account connection',
  usage: '{guildprefix}spotify link\n{guildprefix}spotify unlink',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');
    const guildprefix = await getGuildPrefix(message.guild.id);
    const subcommand = String(args[0] || '').toLowerCase();

    if (!subcommand || !['link', 'unlink'].includes(subcommand)) {
      return runHelpCommand(message, 'spotify');
    }

    switch (subcommand) {
      case 'link': {
        try {
          // Check if user already has linked account
          const isLinked = await spotifyService.isLinked(message.author.id);
          
          if (isLinked) {
            return embeds.warn(message, 'Your Spotify account is already linked. Use `' + guildprefix + 'spotify unlink` to unlink it first.');
          }

          // Create auth session and get OAuth URL
          const { authUrl } = await spotifyService.createAuthSession(
            message.author.id,
            message.guild.id
          );

          const embed = new EmbedBuilder()
            .setColor(0x1DB954) // Spotify green
            .setTitle('🎵 Link Your Spotify Account')
            .setDescription(
              `Click the link below to authorize Spotify:\n\n` +
              `[**Authorize Spotify**](${authUrl})\n\n` +
              `After authorizing, you'll be redirected to a success page. ` +
              `You can then return here and use Spotify commands!\n\n` +
              `⏱️ This link expires in **10 minutes**.`
            )
            .setFooter({ text: 'Spotify Integration' })
            .setTimestamp();

          await message.channel.send({ embeds: [embed] });

          // Also try to DM the user
          try {
            await message.author.send({ embeds: [embed] });
            await embeds.success(message, 'I\'ve sent you a DM with the Spotify authorization link!');
          } catch (error) {
            // User has DMs disabled, that's okay
          }

        } catch (error) {
          console.error('[Spotify Link] Error:', error);
          return embeds.warn(message, 'Failed to create Spotify authorization link. Please try again later.');
        }
        break;
      }

      case 'unlink': {
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
