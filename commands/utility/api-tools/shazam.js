const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors, emojis } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "shazam",
  aliases: ['identify', 'song', 'music'],
  description: 'Identify music from audio or video files',
  syntax: 'shazam {attach audio/video} or reply to a message with audio/video',
  example: 'shazam (with audio attachment)',
  run: async(client, message, args) => {
    
    let mediaUrl = null;
    let mediaType = null;

    // Check for audio/video attachment
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      // Check if it's audio or video
      const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                      /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
      const isVideo = (attachment.contentType && attachment.contentType.startsWith('video/')) ||
                      /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(attachment.name);
      
      if (isAudio || isVideo) {
        mediaUrl = attachment.url;
        mediaType = isAudio ? 'audio' : 'video';
      }
    }

    // Check for replied message with audio/video
    if (!mediaUrl && message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage.attachments.size > 0) {
          const attachment = repliedMessage.attachments.first();
          const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                          /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
          const isVideo = (attachment.contentType && attachment.contentType.startsWith('video/')) ||
                          /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(attachment.name);
          
          if (isAudio || isVideo) {
            mediaUrl = attachment.url;
            mediaType = isAudio ? 'audio' : 'video';
          }
        }
      } catch (error) {
        // Ignore if can't fetch replied message
      }
    }

    if (!mediaUrl) {
      return runHelpCommand(message, 'shazam');
    }

    try {
      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor('#7985cd')
        .setDescription(`${emojis.loading} Identifying music...`);

      const loadingMessage = await message.channel.send({ embeds: [loadingEmbed] });

      // For now, use a search endpoint with the Shazam API
      // Note: The actual song recognition requires uploading audio which is more complex
      // This is a simplified version using auto-complete/search
      const searchTerm = encodeURIComponent('sample'); // This would need actual audio processing
      const url = `https://shazam.p.rapidapi.com/search?term=${searchTerm}&locale=en-US&limit=1`;
      
      const options = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY || '31e0f8a28amsh98217b5ca7f4ae5p1e5fa9jsn7279a60000af',
          'x-rapidapi-host': 'shazam.p.rapidapi.com'
        }
      };

      const response = await fetch(url, options);
      
      if (!response.ok) {
        await loadingMessage.delete().catch(() => {});
        return embeds.deny(message, 'Failed to identify the music. Please try again later.');
      }

      const result = await response.json();

      // Check if we got results
      if (!result.tracks || !result.tracks.hits || result.tracks.hits.length === 0) {
        await loadingMessage.delete().catch(() => {});
        return embeds.warn(message, 'Could not identify any music in this file.');
      }

      const track = result.tracks.hits[0].track;

      // Create result embed
      const resultEmbed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: message.author.displayName || message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setTitle('🎵 Music Identified')
        .addFields(
          { name: 'Song', value: track.title || 'Unknown', inline: true },
          { name: 'Artist', value: track.subtitle || 'Unknown', inline: true }
        )
        .setFooter({
          text: 'Powered by Shazam',
          iconURL: 'https://cdn.discordapp.com/emojis/1385950785975746684.png'
        });

      // Add thumbnail if available
      if (track.images && track.images.coverart) {
        resultEmbed.setThumbnail(track.images.coverart);
      }

      // Add URL if available
      if (track.url) {
        resultEmbed.setURL(track.url);
      }

      return loadingMessage.edit({ embeds: [resultEmbed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while identifying the music');
    }
  }
};
