const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');

module.exports = {
  name: "skip",
  aliases: ['s'],
  description: 'Skip the current song',
  syntax: 'skip',
  example: 'skip',
  run: async(client, message, args) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return embeds.warn(message, 'You need to be in a **voice channel**!');
    }

    const queue = musicPlayer.getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return embeds.warn(message, 'Nothing is currently **playing**!');
    }

    if (musicPlayer.skip(message.guild.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`${config.emojis.music} ${message.author}: Skipped the current track`);

      message.channel.send({ embeds: [embed] });
    } else {
      embeds.warn(message, 'Failed to skip the track');
    }
  }
};
