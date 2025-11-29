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
          authorization: 'youshallnotpass',
          host: 'localhost',
          port: 2333,
          id: 'main-node',
          requestOptions: {
            timeout: 30000
          }
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
      emitNewSongsOnly: true,
      playerOptions: {
        clientBasedPositionUpdateInterval: 150,
        gapBetweenTracks: 3000,
        defaultSearchPlatform: "spsearch",
        volumeDecrementer: 1,
        requesterTransformer: (requester) => requester,
        onDisconnect: {
          autoReconnect: false,
          destroyPlayer: true
        },
        onEmptyQueue: {
          destroyAfterMs: undefined,
        },
        useUnresolvedData: false
      }
    });

    this.manager.nodeManager.on('connect', (node) => {
      logger.console.log(`Lavalink node ${node.id} connected`);
    });

    this.manager.nodeManager.on('disconnect', (node, reason) => {
      logger.console.error(`Lavalink node ${node.id} disconnected:`, reason);
    });

    this.manager.on('trackStart', (player, track) => {
      logger.console.log(`Track started: ${track.info.title} (${track.info.duration}ms)`);
      logger.console.log(`Track source: ${track.info.sourceName}, identifier: ${track.info.identifier}`);
      
      // Update voice channel status using REST API
      const voiceChannelId = player.voiceChannelId;
      const statusText = `Playing - ${track.info.title} by ${track.info.author}`;
      client.rest.put(`/channels/${voiceChannelId}/voice-status`, { 
        body: { status: statusText } 
      }).catch(() => {});
      
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
      logger.console.log(`Track ended: ${track.info.title}, reason: ${payload.reason}, position: ${player.position}ms / ${track.info.duration}ms`);
    });

    this.manager.on('trackError', (player, track, payload) => {
      logger.console.error(`Track error: ${track.info.title}, error: ${payload.exception?.cause || payload.exception?.message}`);
      
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        channel.send(`❌ Could not play: **${track.info.title}** - Track unavailable`).catch(() => {});
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
      // Clear voice channel status using REST API
      const voiceChannelId = player.voiceChannelId;
      client.rest.put(`/channels/${voiceChannelId}/voice-status`, { 
        body: { status: "" } 
      }).catch(() => {});
      
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        channel.send('Queue has ended.').catch(() => {});
      }
      // Don't destroy player - stay in VC
      // player.destroy();
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

    // Determine search prefix
    let searchQuery = query;
    let isDirectLink = query.includes('://');
    let isSpotifyLink = query.includes('spotify.com');
    
    if (!isDirectLink && !query.startsWith('spsearch:') && !query.startsWith('scsearch:')) {
      searchQuery = `spsearch:${query}`;
    }

    let res;
    try {
      res = await player.search({ query: searchQuery }, message.author);
    } catch (error) {
      logger.console.error('Lavalink search error:', error);
      if (!player.queue.current) player.destroy();
      return null;
    }

    // If Spotify link, get metadata then search SoundCloud
    if (isSpotifyLink && res.loadType === 'track' && res.tracks && res.tracks[0]) {
      const track = res.tracks[0];
      if (track.info.sourceName === 'spotify') {
        logger.console.log(`Resolving Spotify track to SoundCloud: ${track.info.title} by ${track.info.author}`);
        try {
          const scQuery = `scsearch:${track.info.author} ${track.info.title}`;
          const scRes = await player.search({ query: scQuery }, message.author);
          if (scRes.loadType === 'search' && scRes.tracks && scRes.tracks.length > 0) {
            // Filter out preview tracks and get top 3 results
            let fullTracks = scRes.tracks.filter(t => 
              t.info.identifier && 
              !t.info.identifier.includes('/preview/') &&
              t.info.duration > 60000 // At least 1 minute
            ).slice(0, 3);
            
            // If no full tracks found, use first 3 results
            if (fullTracks.length === 0) {
              fullTracks = scRes.tracks.slice(0, 3);
              logger.console.warn('Could not find full SoundCloud tracks, using first results');
            }
            
            // Use first available track (others as fallback)
            res = { ...scRes, tracks: fullTracks };
            logger.console.log(`Successfully resolved to SoundCloud with ${fullTracks.length} options`);
          }
        } catch (error) {
          logger.console.error('SoundCloud resolution error:', error);
        }
      }
    }

    // If Spotify search failed or returned empty, try SoundCloud
    if ((res.loadType === 'error' || res.loadType === 'empty') && searchQuery.startsWith('spsearch:')) {
      logger.console.log('Spotify search failed, trying SoundCloud...');
      try {
        const scQuery = searchQuery.replace('spsearch:', 'scsearch:');
        res = await player.search({ query: scQuery }, message.author);
      } catch (error) {
        logger.console.error('SoundCloud search error:', error);
        if (!player.queue.current) player.destroy();
        return null;
      }
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
          `${config.emojis.music} ${message.author}: Added playlist \`${res.playlist.name}\` with ${res.tracks.length} tracks`
        );
      message.channel.send({ embeds: [embed] }).catch(() => {});
    } else {
      // If we have multiple tracks (fallback options), add only the first one
      // The others will be tried if this one fails
      const trackToAdd = res.tracks[0];
      await player.queue.add(trackToAdd);

      if (player.queue.tracks.length > 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} ${message.author}: Added [\`${trackToAdd.info.title}\`](${trackToAdd.info.uri}) by \`${trackToAdd.info.author}\` to the queue`
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
