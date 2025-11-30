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
          authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
          host: process.env.LAVALINK_HOST || 'localhost',
          port: parseInt(process.env.LAVALINK_PORT) || 2333,
          id: 'main-node',
          secure: process.env.LAVALINK_SECURE === 'true'
        }
      ],
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
      client: {
        id: client.user.id,
      },
      autoSkip: true,
      playerOptions: {
        defaultSearchPlatform: "ytsearch",
        volumeDecrementer: 1,
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false
        },
        onEmptyQueue: {
          destroyAfterMs: 300000, // 5 minutes
        }
      }
    });

    this.manager.nodeManager.on('connect', (node) => {
      logger.console.log(`Lavalink node ${node.id} connected`);
    });

    this.manager.nodeManager.on('disconnect', (node, reason) => {
      logger.console.error(`Lavalink node ${node.id} disconnected:`, reason);
    });

    this.manager.on('trackStart', (player, track) => {
      logger.console.log(`Now playing: ${track.info.title}`);
      
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

    this.manager.on('trackEnd', (player, track, payload) => {
      logger.console.log(`Track ended: ${track.info.title}`);
    });

    this.manager.on('trackError', (player, track, payload) => {
      logger.console.error(`Track error: ${track.info.title}`);
      
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        channel.send(`❌ Error playing: **${track.info.title}**`).catch(() => {});
      }
    });

    this.manager.on('trackStuck', (player, track, payload) => {
      logger.console.error(`Track stuck: ${track.info.title}, threshold: ${payload.thresholdMs}ms`);
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        channel.send(`⚠️ Track stuck: ${track.info.title}`).catch(() => {});
      }
    });

    this.manager.on('playerDisconnect', (player) => {
      logger.console.log(`Player disconnected from guild ${player.guildId}`);
    });

    this.manager.on('playerMove', (player, oldChannel, newChannel) => {
      logger.console.log(`Player moved from ${oldChannel} to ${newChannel}`);
    });

    // Listen for voice state updates to detect when all users leave
    client.on('voiceStateUpdate', (oldState, newState) => {
      // Check if someone left a voice channel
      if (oldState.channelId && !newState.channelId) {
        const channel = oldState.channel;
        if (!channel) return;

        // Check if bot is in this channel
        const botMember = channel.guild.members.cache.get(client.user.id);
        if (!botMember || botMember.voice.channelId !== channel.id) return;

        // Count non-bot members in the channel
        const members = channel.members.filter(m => !m.user.bot);
        
        // If no users left (only bots), disconnect
        if (members.size === 0) {
          const player = this.manager.getPlayer(channel.guild.id);
          if (player) {
            logger.console.log(`All users left voice channel, disconnecting player in ${channel.guild.name}`);
            player.destroy();
          }
        }
      }
    });

    this.manager.on('queueEnd', (player) => {
      logger.console.log(`Queue ended in guild ${player.guildId}`);
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        channel.send('✅ Queue finished!').catch(() => {});
      }
    });

    client.on('raw', (d) => this.manager.sendRawData(d));

    this.manager.init({ id: client.user.id, username: client.user.username });

    logger.console.log('Lavalink music player initialized');
  }

  async play(message, query) {
    const player = this.manager.createPlayer({
      guildId: message.guild.id,
      voiceChannelId: message.member.voice.channel.id,
      textChannelId: message.channel.id,
      selfDeaf: true,
      selfMute: false,
    });

    if (!player.connected) await player.connect();

    // Simple search - let Lavalink handle it
    let searchQuery = query;
    if (!query.includes('://')) {
      searchQuery = `ytsearch:${query}`;
    }

    let res;
    try {
      res = await player.search({ query: searchQuery }, message.author);
    } catch (error) {
      logger.console.error('Search error:', error);
      if (!player.queue.current) player.destroy();
      return null;
    }

    if (res.loadType === 'error' || res.loadType === 'empty') {
      if (!player.queue.current) player.destroy();
      return null;
    }

    if (res.loadType === 'playlist') {
      await player.queue.add(res.tracks);
      
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(
          `${config.emojis.music} Added playlist \`${res.playlist.name}\` with ${res.tracks.length} tracks`
        );
      message.channel.send({ embeds: [embed] }).catch(() => {});
    } else {
      const track = res.tracks[0];
      await player.queue.add(track);

      if (player.queue.tracks.length > 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} Added [\`${track.info.title}\`](${track.info.uri}) to the queue`
          );
        message.channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    if (!player.playing) await player.play();

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

  setRepeat(guildId, mode) {
    const player = this.manager.getPlayer(guildId);
    if (player) {
      player.setRepeatMode(mode);
      return true;
    }
    return false;
  }

  shuffle(guildId) {
    const player = this.manager.getPlayer(guildId);
    if (player && player.queue.tracks.length > 0) {
      player.queue.shuffle();
      return true;
    }
    return false;
  }

  removeTrack(guildId, index) {
    const player = this.manager.getPlayer(guildId);
    if (player && player.queue.tracks[index]) {
      player.queue.remove(index);
      return true;
    }
    return false;
  }

  clearQueue(guildId) {
    const player = this.manager.getPlayer(guildId);
    if (player) {
      player.queue.clear();
      return true;
    }
    return false;
  }

  moveTrack(guildId, from, to) {
    const player = this.manager.getPlayer(guildId);
    if (player && player.queue.tracks[from] && to >= 0 && to < player.queue.tracks.length) {
      const track = player.queue.tracks.splice(from, 1)[0];
      player.queue.tracks.splice(to, 0, track);
      return true;
    }
    return false;
  }
}

module.exports = new MusicPlayer();
