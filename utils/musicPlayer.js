const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const logger = require('./logger');

class MusicPlayer {
  constructor() {
    this.queues = new Map(); // guildId -> queue data
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

      // Wait for connection to be ready
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      queue.connection = connection;
      queue.voiceChannel = voiceChannel;
      queue.textChannel = textChannel;

      // Create audio player if it doesn't exist
      if (!queue.player) {
        queue.player = createAudioPlayer();
        
        // Handle player events
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

      // Handle connection state changes
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
      // Clean URL - remove playlist and extra parameters
      let cleanQuery = query;
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        // Extract video ID from various YouTube URL formats
        const videoIdMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) {
          cleanQuery = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
        }
      }

      // Check if it's a YouTube URL
      if (ytdl.validateURL(cleanQuery)) {
        const info = await ytdl.getInfo(cleanQuery);
        return {
          title: info.videoDetails.title,
          url: info.videoDetails.video_url,
          duration: this.formatDuration(parseInt(info.videoDetails.lengthSeconds)),
          thumbnail: info.videoDetails.thumbnails[0]?.url,
          author: info.videoDetails.author.name
        };
      }

      // Search YouTube
      const searchResults = await ytSearch(cleanQuery);
      const video = searchResults.videos[0];

      if (!video) {
        return null;
      }

      return {
        title: video.title,
        url: video.url,
        duration: video.timestamp,
        thumbnail: video.thumbnail,
        author: video.author.name
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

    // If nothing is playing, start playing
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
      // Create HIGHEST quality audio stream - optimized for best audio quality
      const stream = ytdl(song.url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25, // 32MB buffer for ultra-smooth playback
        dlChunkSize: 0 // Download entire file for maximum quality
      });

      // Handle stream errors
      stream.on('error', (error) => {
        logger.console.error(`Stream error for ${song.title}:`, error);
        this.playNext(guildId);
      });

      const resource = createAudioResource(stream, {
        inlineVolume: true
      });

      resource.volume.setVolume(queue.volume);

      queue.player.play(resource);
      
      logger.console.log(`Started playing: ${song.title} in guild ${guildId}`);

      // Send now playing message
      if (queue.textChannel) {
        const config = require('../config/setup');
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
    
    // Remove the current song
    queue.songs.shift();

    if (queue.songs.length === 0) {
      queue.isPlaying = false;
      queue.currentSong = null;
      
      // Optionally leave after finishing queue
      setTimeout(() => {
        if (queue.songs.length === 0 && !queue.isPlaying) {
          this.cleanup(guildId);
        }
      }, 60000); // Leave after 1 minute of inactivity
      
      return;
    }

    // Play next song
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
    queue.volume = Math.max(0, Math.min(2, volume)); // Clamp between 0 and 2
    
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

// Export singleton instance
module.exports = new MusicPlayer();
