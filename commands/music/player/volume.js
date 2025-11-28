const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: "volume",
  aliases: ['vol', 'v'],
  description: 'Set the music volume (0-200)',
  syntax: 'volume <0-200>',
  example: 'volume 50',
  run: async(client, message, args) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return embeds.warn(message, 'You need to be in a **voice channel**!');
    }

    const queue = musicPlayer.getQueue(message.guild.id);
    if (!queue.connection) {
      return embeds.warn(message, 'Nothing is currently **playing**!');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'volume');
    }

    const volume = parseInt(args[0]);
    if (isNaN(volume) || volume < 0 || volume > 200) {
      return embeds.warn(message, 'Volume must be a number between **0** and **200**');
    }

    const newVolume = musicPlayer.setVolume(message.guild.id, volume / 100);
    
    const embed = new EmbedBuilder()
      .setColor(0xFFFFFF)
      .setDescription(`${config.emojis.music} ${message.author}: Volume set to **${Math.round(newVolume * 100)}%** successfully`);

    message.channel.send({ embeds: [embed] });
  }
};
