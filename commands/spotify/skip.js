const { EmbedBuilder } = require("discord.js");
const config = require('../../config/setup');
const { getService } = require('@services');
const { checkSpotifyAccess, handleSpotifyError } = require('./spotifyHelpers');

module.exports = {
  name: "skip",
  aliases: ['next'],
  description: 'Skip to the next track on Spotify',
  usage: '{guildprefix}skip',
  run: async(client, message, args) => {
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
          .setColor(config.colors.embed)
          .setDescription(`${config.emojis.spotifyNext} Skipped current track — now playing **${trackName}** by **${artistName}**`);

        return message.channel.send({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setDescription(`${config.emojis.spotifyNext} Skipping to **next** track`);

        return message.channel.send({ embeds: [embed] });
      }

    } catch (error) {
      console.error('[Skip Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};
