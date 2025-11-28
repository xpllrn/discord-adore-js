const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');

module.exports = {
  name: "pause",
  description: 'Pause the current song',
  syntax: 'pause',
  example: 'pause',
  run: async(client, message, args) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return embeds.warn(message, 'You need to be in a **voice channel**!');
    }

    const queue = musicPlayer.getQueue(message.guild.id);
    if (!queue.connection || !queue.isPlaying) {
      return embeds.warn(message, 'Nothing is currently **playing**!');
    }

    if (musicPlayer.pause(message.guild.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`${config.emojis.music} ${message.author}: Playback **paused**`);

      message.channel.send({ embeds: [embed] });
    } else {
      embeds.warn(message, 'Failed to pause the music');
    }
  }
};
