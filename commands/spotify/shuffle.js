const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');

module.exports = {
  name: "shuffle",
  aliases: [],
  description: 'Toggle shuffle mode on Spotify',
  syntax: 'shuffle <on/off>',
  example: 'shuffle on',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');

    const mode = args[0] ? args[0].toLowerCase() : 'on';
    let shuffleState = true;
    
    if (mode === 'off' || mode === 'false' || mode === '0') {
      shuffleState = false;
    }

    try {
      const isLinked = await spotifyService.isLinked(message.author.id);
      
      if (!isLinked) {
        return embeds.warn(message, 'You haven\'t linked your **Spotify** account. Use `,spotify login` to get started.');
      }

      const accessToken = await spotifyService.getAccessToken(message.author.id);
      
      if (!accessToken) {
        return embeds.warn(message, 'Failed to get Spotify access token.');
      }

      await spotifyService.setShuffleMode(shuffleState, accessToken);

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setDescription(`${config.emojis.spotifyShuffle} Shuffle mode **${shuffleState ? 'enabled' : 'disabled'}** successfully`);

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('[Shuffle Command] Error:', error);
      return embeds.warn(message, 'Failed to set shuffle mode. Make sure **Spotify** is open on a device.');
    }
  }
};
