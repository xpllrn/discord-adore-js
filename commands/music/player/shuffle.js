const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');

module.exports = {
  name: "shuffle",
  description: 'Shuffle the queue',
  syntax: 'shuffle',
  example: 'shuffle',
  run: async(client, message, args) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return embeds.warn(message, 'You need to be in a **voice channel**!');
    }

    const queue = musicPlayer.getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return embeds.warn(message, 'Nothing is currently **playing**!');
    }

    const queueList = musicPlayer.getQueueList(message.guild.id);
    if (queueList.length === 0) {
      return embeds.warn(message, 'The queue is **empty**!');
    }

    if (musicPlayer.shuffle(message.guild.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`${config.emojis.music} ${message.author}: Queue **shuffled** with ${queueList.length} tracks`);

      message.channel.send({ embeds: [embed] });
    } else {
      embeds.warn(message, 'Failed to shuffle the queue');
    }
  }
};
