const { EmbedBuilder } = require("discord.js");
const config = require('../../config/setup');
const { getService } = require('@services');
const { checkSpotifyAccess, handleSpotifyError } = require('../../utils/helpers');

module.exports = {
  name: "skip",
  aliases: ['next'],
  description: 'Skip to the next track on Spotify',
  syntax: 'skip',
  example: 'skip',
  run: async (client, message, args) => {
    const spotifyService = getService('spotify');

    try {
      const { accessToken } = await checkSpotifyAccess(message);
      if (!accessToken) return;

      await spotifyService.skipToNext(accessToken);

      // Wait a moment then get the new track
      await new Promise(resolve => setTimeout(resolve, 500));

      const nowPlaying = await spotifyService.getCurrentlyPlaying(accessToken);

      if (nowPlaying && nowPlaying.item) {
        const track = nowPlaying.item;
        const trackName = track.name;
        const artistName = track.artists.map(a => a.name).join(', ');

        const embed = new EmbedBuilder()
          .setColor(config.colors.spotify)
          .setDescription(`${config.emojis.spotify} Skipped current track — now playing **${trackName}** by **${artistName}**`);

        return message.channel.send({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(config.colors.spotify)
          .setDescription(`${config.emojis.spotify} Skipping to **next** track`);

        return message.channel.send({ embeds: [embed] });
      }

    } catch (error) {
      logger.webhook.error(error, message);
      return handleSpotifyError(message, error);
    }
  }
};
