const { Manager } = require('erela.js');
const { EmbedBuilder } = require('discord.js');
const config = require('../config/setup');
const logger = require('./logger');

class MusicPlayer {
  constructor() {
    this.manager = null;
  }

  init(client) {
    this.manager = new Manager({
      nodes: [
        {
          host: 'lava-v3.ajieblogs.eu.org',
          port: 80,
          password: 'https://dsc.gg/ajidevserver',
        }
      ],
      send: (id, payload) => {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      }
    });

    this.manager.on('nodeConnect', node => {
      logger.console.log(`Lavalink node ${node.options.identifier} connected`);
    });

    this.manager.on('nodeError', (node, error) => {
      logger.console.error(`Lavalink node ${node.options.identifier} error:`, error);
    });

    this.manager.on('trackStart', (player, track) => {
      const channel = client.channels.cache.get(player.textChannel);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} Now playing [\`${track.title}\`](${track.uri}) by \`${track.author}\``
          );
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    });

    this.manager.on('queueEnd', player => {
      const channel = client.channels.cache.get(player.textChannel);
      if (channel) {
        channel.send('Queue has ended.').catch(() => {});
      }
      player.destroy();
    });

    client.on('raw', d => this.manager.updateVoiceState(d));

    this.manager.init(client.user.id);

    logger.console.log('Lavalink music player initialized');
  }

  async play(message, query) {
    let player = this.manager.get(message.guild.id);

    if (!player) {
      player = this.manager.create({
        guild: message.guild.id,
        voiceChannel: message.member.voice.channel.id,
        textChannel: message.channel.id,
        selfDeafen: true,
      });
    }

    if (player.state !== 'CONNECTED') player.connect();

    const res = await this.manager.search(query, message.author);

    if (res.loadType === 'LOAD_FAILED') {
      if (!player.queue.current) player.destroy();
      throw new Error(res.exception.message);
    }

    if (res.loadType === 'NO_MATCHES') {
      if (!player.queue.current) player.destroy();
      return null;
    }

    if (res.loadType === 'PLAYLIST_LOADED') {
      player.queue.add(res.tracks);
      
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(
          `${config.emojis.music} ${message.author}: Added playlist \`${res.playlist.name}\` with ${res.tracks.length} tracks`
        );
      message.channel.send({ embeds: [embed] }).catch(() => {});
    } else {
      player.queue.add(res.tracks[0]);

      if (player.queue.size > 1) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} ${message.author}: Added [\`${res.tracks[0].title}\`](${res.tracks[0].uri}) by \`${res.tracks[0].author}\` to the queue`
          );
        message.channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    if (!player.playing && !player.paused && !player.queue.size) player.play();

    return true;
  }

  stop(guildId) {
    const player = this.manager.get(guildId);
    if (player) {
      player.destroy();
      return true;
    }
    return false;
  }

  skip(guildId) {
    const player = this.manager.get(guildId);
    if (player && player.queue.current) {
      player.stop();
      return true;
    }
    return false;
  }

  pause(guildId) {
    const player = this.manager.get(guildId);
    if (player && !player.paused) {
      player.pause(true);
      return true;
    }
    return false;
  }

  resume(guildId) {
    const player = this.manager.get(guildId);
    if (player && player.paused) {
      player.pause(false);
      return true;
    }
    return false;
  }

  setVolume(guildId, volume) {
    const player = this.manager.get(guildId);
    if (player) {
      player.setVolume(volume);
      return volume;
    }
    return null;
  }

  getQueue(guildId) {
    const player = this.manager.get(guildId);
    return player ? player.queue : null;
  }

  getCurrentSong(guildId) {
    const player = this.manager.get(guildId);
    return player ? player.queue.current : null;
  }

  getQueueList(guildId) {
    const player = this.manager.get(guildId);
    return player ? player.queue : [];
  }

  isPlaying(guildId) {
    const player = this.manager.get(guildId);
    return player ? player.playing : false;
  }
}

module.exports = new MusicPlayer();
