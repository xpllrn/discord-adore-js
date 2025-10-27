const { EmbedBuilder } = require("discord.js");
const config = require('../../config/setup');
const { getService } = require('@services');
const { checkSpotifyAccess, handleSpotifyError } = require('./spotifyHelpers');

module.exports = {
  name: "previous",
  aliases: ['back'],
  description: 'Go back to the previous track on Spotify',
  usage: '{guildprefix}previous',
  run: async (client, message, args) => {
    const spotifyService = getService('spotify');

    try {
      const { accessToken } = await checkSpotifyAccess(message);
      if (!accessToken) return;

      await spotifyService.skipToPrevious(accessToken);

      // Wait a moment then get the new track
      await new Promise(resolve => setTimeout(resolve, 500));

      const nowPlaying = await spotifyService.getCurrentlyPlaying(accessToken);

      if (nowPlaying && nowPlaying.item) {
        const track = nowPlaying.item;
        const trackName = track.name;
        const artistName = track.artists.map(a => a.name).join(', ');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setDescription(`${config.emojis.spotifyPrevious} Playing **previous** track — **${trackName}** by **${artistName}**`);

        return message.channel.send({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setDescription(`${config.emojis.spotifyPrevious} Playing **previous** track`);

        return message.channel.send({ embeds: [embed] });
      }

    } catch (error) {
      console.error('[Previous Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};
