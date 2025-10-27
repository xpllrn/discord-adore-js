const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { checkSpotifyAccess, handleSpotifyError } = require('../../handlers/spotifyHelpers');

module.exports = {
  name: "repeat",
  aliases: ['loop'],
  description: 'Toggle repeat mode on Spotify',
  usage: '{guildprefix}repeat [track/context/off]',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');

    const mode = args[0] ? args[0].toLowerCase() : 'track';
    
    if (!['track', 'context', 'off'].includes(mode)) {
      return embeds.warn(message, 'Repeat mode must be **track**, **context**, or **off**');
    }

    try {
      const { accessToken } = await checkSpotifyAccess(message);
      if (!accessToken) return;

      await spotifyService.setRepeatMode(mode, accessToken);

      let modeText = mode === 'track' ? 'current track' : mode === 'context' ? 'playlist/album' : 'disabled';
      
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setDescription(`${config.emojis.spotifyRepeat} Repeat mode set to **${mode === 'off' ? 'disabled' : 'enabled'}** (\`${modeText}\`)`);

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('[Repeat Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};
