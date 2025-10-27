const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { checkSpotifyAccess, handleSpotifyError } = require('../../handlers/spotifyHelpers');

module.exports = {
  name: "volume",
  aliases: ['vol'],
  description: 'Set Spotify playback volume',
  usage: '{guildprefix}volume [0-100]',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');

    if (!args[0]) {
      return runHelpCommand(message, 'volume');
    }

    const volume = parseInt(args[0]);

    if (isNaN(volume) || volume < 0 || volume > 100) {
      return embeds.warn(message, 'Volume must be a number between **0** and **100**');
    }

    try {
      const { accessToken } = await checkSpotifyAccess(message);
      if (!accessToken) return;

      await spotifyService.setVolume(volume, accessToken);

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setDescription(`${config.emojis.spotifyVolume} ${message.author}: Volume set to **${volume}%** successfully`);

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('[Volume Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};
