const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: "repeat",
  aliases: ['loop'],
  description: 'Set repeat mode (off, track, queue)',
  syntax: 'repeat <off|track|queue>',
  example: 'repeat track',
  run: async(client, message, args) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return embeds.warn(message, 'You need to be in a **voice channel**!');
    }

    const queue = musicPlayer.getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return embeds.warn(message, 'Nothing is currently **playing**!');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'repeat');
    }

    const mode = args[0].toLowerCase();
    let repeatMode;
    let modeText;

    switch(mode) {
      case 'off':
      case 'none':
        repeatMode = 0;
        modeText = 'off';
        break;
      case 'track':
      case 'song':
        repeatMode = 1;
        modeText = 'track';
        break;
      case 'queue':
      case 'all':
        repeatMode = 2;
        modeText = 'queue';
        break;
      default:
        return embeds.warn(message, 'Invalid mode! Use: **off**, **track**, or **queue**');
    }

    if (musicPlayer.setRepeat(message.guild.id, repeatMode)) {
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`${config.emojis.music} ${message.author}: Repeat mode set to **${modeText}**`);

      message.channel.send({ embeds: [embed] });
    } else {
      embeds.warn(message, 'Failed to set repeat mode');
    }
  }
};
