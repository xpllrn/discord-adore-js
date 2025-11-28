const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const logger = require('./logger');
const config = require('../config/setup');
const { EmbedBuilder } = require('discord.js');

class MusicPlayer {
  constructor() {
    this.distube = null;
  }

  init(client) {
    this.distube = new DisTube(client, {
      emitNewSongOnly: true,
      savePreviousSongs: true,
      searchSongs: 1,
      nsfw: false,
      emptyCooldown: 60,
      plugins: [new YtDlpPlugin()]
    });

    // Event handlers
    this.distube.on('playSong', (queue, song) => {
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(
          `${config.emojis.music} ${song.user}: Now playing [\`${song.name}\`](${song.url}) by \`${song.uploader.name}\``
        );

      queue.textChannel.send({ embeds: [embed] }).catch(() => {});
    });

    this.distube.on('addSong', (queue, song) => {
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(
          `${config.emojis.music} ${song.user}: Added [\`${song.name}\`](${song.url}) by \`${song.uploader.name}\` to the queue`
        );

      queue.textChannel.send({ embeds: [embed] }).catch(() => {});
    });

    this.distube.on('error', (channel, error) => {
      logger.console.error('DisTube error:', error);
      if (channel) {
        channel.send('❌ An error occurred while playing music.').catch(() => {});
      }
    });

    this.distube.on('searchNoResult', (message, query) => {
      message.channel.send(`❌ No results found for: \`${query}\``).catch(() => {});
    });

    logger.console.log('DisTube music player initialized');
  }

  async play(message, query) {
    try {
      await this.distube.play(message.member.voice.channel, query, {
        member: message.member,
        textChannel: message.channel,
        message
      });
    } catch (error) {
      logger.console.error('Play error:', error);
      throw error;
    }
  }

  stop(message) {
    try {
      this.distube.stop(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  skip(message) {
    try {
      this.distube.skip(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  pause(message) {
    try {
      this.distube.pause(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  resume(message) {
    try {
      this.distube.resume(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  setVolume(message, volume) {
    try {
      this.distube.setVolume(message, volume);
      return volume;
    } catch (error) {
      return null;
    }
  }

  getQueue(message) {
    try {
      return this.distube.getQueue(message);
    } catch (error) {
      return null;
    }
  }

  isPlaying(guildId) {
    try {
      const queue = this.distube.getQueue(guildId);
      return queue ? queue.playing : false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new MusicPlayer();
