const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const play = require('play-dl');
const logger = require('./logger');
const config = require('../config/setup');

class MusicPlayer {
  constructor() {
    this.queues = new Map();
  }

  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        songs: [],
        currentSong: null,
        player: null,
        connection: null,
        textChannel: null,
        voiceChannel: null,
        isPlaying: false,
        volume: 1.0
      });
    }
    return this.queues.get(guildId);
  }

  async joinChannel(voiceChannel, textChannel) {
    const guildId = voiceChannel.guild.id;
    const queue = this.getQueue(guildId);

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      queue.connection = connection;
      queue.voiceChannel = voiceChannel;
      queue.textChannel = textChannel;

      if (!queue.player) {
        queue.player = createAudioPlayer();
        
        queue.player.on(AudioPlayerStatus.Idle, () => {
          logger.console.log(`Player idle in ${guildId}, playing next...`);
          this.playNext(guildId);
        });

        queue.player.on(AudioPlayerStatus.Playing, () => {
          logger.console.log(`Player started playing in ${guildId}`);
        });

        queue.player.on('error', error => {
          logger.console.error(`Music player error in ${guildId}:`, error);
          this.playNext(guildId);
        });

        const subscription = connection.subscribe(queue.player);
        if (!subscription) {
          logger.console.error(`Failed to subscribe player to connection in ${guildId}`);
        }
      }

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch (error) {
          this.cleanup(guildId);
        }
      });

      return connection;
    } catch (error) {
      logger.console.error(`Failed to join voice channel:`, error);
      throw error;
    }
  }

  async searchSong(query) {
    try {
      // Check if it's a YouTube URL
      const isURL = play.yt_validate(query) === 'video';
      
      let video;
      
      if (isURL) {
        // Get video info from URL
        video = await play.video_info(query);
      } else {
        // Search YouTube
        const searchResults = await play.search(query, { limit: 1, source: { youtube: 'video' } });
        
        if (!searchResults || searchResults.length === 0) {
          return null;
        }
        
        video = searchResults[0];
      }

      if (!video) {
        return null;
      }

      return {
        title: video.title,
        url: video.url,
        duration: this.formatDuration(video.durationInSec),
        thumbnail: video.thumbnails?.[0]?.url || null,
        author: video.channel?.name || 'Unknown'
      };
    } catch (error) {
      logger.console.error('Search error:', error);
      return null;
    }
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  async addSong(guildId, song, requestedBy) {
    const queue = this.getQueue(guildId);
    
    song.requestedBy = requestedBy;
    queue.songs.push(song);

    if (!queue.isPlaying) {
      await this.play(guildId);
    }

    return queue.songs.length;
  }

  async play(guildId) {
    const queue = this.getQueue(guildId);

    if (queue.songs.length === 0) {
      queue.isPlaying = false;
      queue.currentSong = null;
      return;
    }

    const song = queue.songs[0];
    queue.currentSong = song;
    queue.isPlaying = true;

    try {
      // Create audio stream with play-dl
      const stream = await play.stream(song.url);

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
      });

      resource.volume.setVolume(queue.volume);

      queue.player.play(resource);
      
      logger.console.log(`Started playing: ${song.title} in guild ${guildId}`);

      // Send now playing message
      if (queue.textChannel) {
        const { EmbedBuilder } = require('discord.js');
        
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} ${song.requestedBy}: Now playing [\`${song.title}\`](${song.url}) by \`${song.author}\``
          );

        queue.textChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {
      logger.console.error(`Error playing song in ${guildId}:`, error);
      queue.textChannel?.send('❌ Error playing this song. Skipping...').catch(() => {});
      this.playNext(guildId);
    }
  }

  playNext(guildId) {
    const queue = this.getQueue(guildId);
    
    queue.songs.shift();

    if (queue.songs.length === 0) {
      queue.isPlaying = false;
      queue.currentSong = null;
      
      setTimeout(() => {
        if (queue.songs.length === 0 && !queue.isPlaying) {
          this.cleanup(guildId);
        }
      }, 60000);
      
      return;
    }

    this.play(guildId);
  }

  skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      queue.player.stop();
      return true;
    }
    return false;
  }

  stop(guildId) {
    const queue = this.getQueue(guildId);
    queue.songs = [];
    if (queue.player) {
      queue.player.stop();
    }
    this.cleanup(guildId);
  }

  pause(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player && queue.isPlaying) {
      queue.player.pause();
      return true;
    }
    return false;
  }

  resume(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      queue.player.unpause();
      return true;
    }
    return false;
  }

  setVolume(guildId, volume) {
    const queue = this.getQueue(guildId);
    queue.volume = Math.max(0, Math.min(2, volume));
    
    if (queue.player && queue.player.state.resource) {
      queue.player.state.resource.volume?.setVolume(queue.volume);
    }
    
    return queue.volume;
  }

  cleanup(guildId) {
    const queue = this.getQueue(guildId);
    
    if (queue.connection) {
      queue.connection.destroy();
    }
    
    this.queues.delete(guildId);
  }

  getCurrentSong(guildId) {
    const queue = this.getQueue(guildId);
    return queue.currentSong;
  }

  getQueueList(guildId) {
    const queue = this.getQueue(guildId);
    return queue.songs;
  }

  isPlaying(guildId) {
    const queue = this.getQueue(guildId);
    return queue.isPlaying;
  }
}

module.exports = new MusicPlayer();
