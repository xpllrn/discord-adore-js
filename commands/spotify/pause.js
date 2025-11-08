const { EmbedBuilder } = require("discord.js");
const config = require('../../config/setup');
const { getService } = require('@services');
const { checkSpotifyAccess, handleSpotifyError } = require('../../handlers/spotifyHelpers');

module.exports = {
  name: "pause",
  aliases: [],
  description: 'Pause your Spotify playback',
  syntax: 'pause',
  example: 'pause',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');

    try {
      const { accessToken } = await checkSpotifyAccess(message);
      if (!accessToken) return;

      await spotifyService.pausePlayback(accessToken);

      const embed = new EmbedBuilder()
        .setColor(config.colors.spotify)
        .setDescription(`${config.emojis.spotify} ${message.author}: Playback **paused**`);

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return handleSpotifyError(message, error);
    }
  }
};
