const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');

module.exports = {
  name: "disconnect",
  aliases: ['dc', 'stop', 'leave'],
  description: 'Disconnect the bot from voice channel',
  syntax: 'disconnect',
  example: 'disconnect',
  run: async(client, message, args) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return embeds.warn(message, 'You need to be in a **voice channel**!');
    }

    const queue = musicPlayer.getQueue(message.guild.id);
    if (!queue) {
      return embeds.warn(message, 'I am not connected to any **voice channel**!');
    }

    if (musicPlayer.stop(message.guild.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`${config.emojis.music} ${message.author}: Disconnected from voice channel`);

      message.channel.send({ embeds: [embed] });
    } else {
      embeds.warn(message, 'Failed to disconnect');
    }
  }
};
