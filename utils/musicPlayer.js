const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { google } = require('googleapis');
const logger = require('./logger');
const config = require('../config/setup');

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.GOOGLE_IMG // Using the Google API key from .env
});

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
      // Extract video ID from YouTube URL if provided
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        const videoIdMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          
          // Get video details from YouTube API
          const response = await youtube.videos.list({
            part: 'snippet,contentDetails',
            id: videoId
          });

          if (response.data.items && response.data.items.length > 0) {
            const video = response.data.items[0];
            return {
              title: video.snippet.title,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              duration: this.parseDuration(video.contentDetails.duration),
              thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
              author: video.snippet.channelTitle
            };
          }
        }
      }

      // Search YouTube using API
      const searchResponse = await youtube.search.list({
        part: 'snippet',
        q: query,
        maxResults: 1,
        type: 'video',
        videoCategoryId: '10' // Music category
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return null;
      }

      const video = searchResponse.data.items[0];
      const videoId = video.id.videoId;

      // Get full video details
      const videoResponse = await youtube.videos.list({
        part: 'snippet,contentDetails',
        id: videoId
      });

      if (videoResponse.data.items && videoResponse.data.items.length > 0) {
        const videoDetails = videoResponse.data.items[0];
        return {
          title: videoDetails.snippet.title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          duration: this.parseDuration(videoDetails.contentDetails.duration),
          thumbnail: videoDetails.snippet.thumbnails.high?.url || videoDetails.snippet.thumbnails.default?.url,
          author: videoDetails.snippet.channelTitle
        };
      }

      return null;
    } catch (error) {
      logger.console.error('Search error:', error);
      return null;
    }
  }

  parseDuration(duration) {
    // Parse ISO 8601 duration format (PT1H2M10S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
      // Create HIGHEST quality audio stream with ytdl-core
      const stream = ytdl(song.url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        dlChunkSize: 0
      });

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
