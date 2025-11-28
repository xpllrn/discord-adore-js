const { LavalinkManager } = require('lavalink-client');
const { EmbedBuilder } = require('discord.js');
const config = require('../config/setup');
const logger = require('./logger');

class MusicPlayer {
  constructor() {
    this.manager = null;
  }

  init(client) {
    this.manager = new LavalinkManager({
      nodes: [
        {
          authorization: 'https://dsc.gg/ajidevserver',
          host: 'lava-v3.ajieblogs.eu.org',
          port: 80,
          id: 'main-node'
        }
      ],
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
      client: {
        id: client.user.id,
        username: client.user.username
      },
      autoSkip: true,
      playerOptions: {
        clientBasedPositionUpdateInterval: 150,
        defaultSearchPlatform: 'ytsearch',
        volumeDecrementer: 0.75,
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false
        },
        onEmptyQueue: {
          destroyAfterMs: 30_000,
        },
        useUnresolvedData: true
      }
    });

    this.manager.on('nodeConnect', (node) => {
      logger.console.log(`Lavalink node ${node.id} connected`);
    });

    this.manager.on('nodeError', (node, error) => {
      logger.console.error(`Lavalink node ${node.id} error:`, error.message);
    });

    this.manager.on('trackStart', (player, track) => {
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} Now playing [\`${track.info.title}\`](${track.info.uri}) by \`${track.info.author}\``
          );
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    });

    this.manager.on('queueEnd', (player) => {
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        channel.send('Queue has ended.').catch(() => {});
      }
    });

    client.on('raw', (d) => this.manager.sendRawData(d));

    logger.console.log('Lavalink music player initialized');
  }

  async play(message, query) {
    let player = this.manager.getPlayer(message.guild.id);

    if (!player) {
      player = this.manager.createPlayer({
        guildId: message.guild.id,
        voiceChannelId: message.member.voice.channel.id,
        textChannelId: message.channel.id,
        selfDeaf: true,
        selfMute: false,
        volume: 100
      });
    }

    if (!player.connected) await player.connect();

    const res = await player.search({ query }, message.author);

    if (res.loadType === 'error') {
      if (!player.queue.current) player.destroy();
      throw new Error('Failed to load track');
    }

    if (res.loadType === 'empty') {
      if (!player.queue.current) player.destroy();
      return null;
    }

    if (res.loadType === 'playlist') {
      await player.queue.add(res.tracks);
      
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(
          `${config.emojis.music} ${message.author}: Added playlist \`${res.playlist.name}\` with ${res.tracks.length} tracks`
        );
      message.channel.send({ embeds: [embed] }).catch(() => {});
    } else {
      await player.queue.add(res.tracks[0]);

      if (player.queue.tracks.length > 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} ${message.author}: Added [\`${res.tracks[0].info.title}\`](${res.tracks[0].info.uri}) by \`${res.tracks[0].info.author}\` to the queue`
          );
        message.channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    if (!player.playing && !player.paused) await player.play();

    return true;
  }

  stop(guildId) {
    const player = this.manager.getPlayer(guildId);
    if (player) {
      player.destroy();
      return true;
    }
    return false;
  }

  skip(guildId) {
    const player = this.manager.getPlayer(guildId);
    if (player && player.queue.current) {
      player.skip();
      return true;
    }
    return false;
  }

  pause(guildId) {
    const player = this.manager.getPlayer(guildId);
    if (player && !player.paused) {
      player.pause();
      return true;
    }
    return false;
  }

  resume(guildId) {
    const player = this.manager.getPlayer(guildId);
    if (player && player.paused) {
      player.resume();
      return true;
    }
    return false;
  }

  setVolume(guildId, volume) {
    const player = this.manager.getPlayer(guildId);
    if (player) {
      player.setVolume(volume);
      return volume;
    }
    return null;
  }

  getQueue(guildId) {
    const player = this.manager.getPlayer(guildId);
    return player ? player.queue : null;
  }

  getCurrentSong(guildId) {
    const player = this.manager.getPlayer(guildId);
    return player ? player.queue.current : null;
  }

  getQueueList(guildId) {
    const player = this.manager.getPlayer(guildId);
    return player ? player.queue.tracks : [];
  }

  isPlaying(guildId) {
    const player = this.manager.getPlayer(guildId);
    return player ? player.playing : false;
  }
}

module.exports = new MusicPlayer();
