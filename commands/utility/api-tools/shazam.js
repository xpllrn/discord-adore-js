const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors, emojis } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "shazam",
  aliases: [],
  description: 'Identify music from audio or video files',
  syntax: 'shazam {attach audio/video} or reply to a message with audio/video',
  example: 'shazam (with audio attachment)',
  run: async(client, message, args) => {
    
    let mediaUrl = null;
    let mediaType = null;

    logger.console.log(`[SHAZAM] Command triggered by ${message.author.tag} in ${message.guild?.name || 'DM'}`);

    // Check for audio/video attachment
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      logger.console.log(`[SHAZAM] Found attachment: ${attachment.name} (${attachment.contentType})`);
      
      // Check if it's audio or video
      const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                      /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
      const isVideo = (attachment.contentType && attachment.contentType.startsWith('video/')) ||
                      /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(attachment.name);
      
      if (isAudio || isVideo) {
        mediaUrl = attachment.url;
        mediaType = isAudio ? 'audio' : 'video';
        logger.console.log(`[SHAZAM] Valid ${mediaType} file detected: ${mediaUrl}`);
      } else {
        logger.console.warn(`[SHAZAM] Attachment is not audio/video: ${attachment.name}`);
      }
    }

    // Check for replied message with audio/video
    if (!mediaUrl && message.reference) {
      logger.console.log(`[SHAZAM] Checking replied message for media`);
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage.attachments.size > 0) {
          const attachment = repliedMessage.attachments.first();
          logger.console.log(`[SHAZAM] Found attachment in reply: ${attachment.name} (${attachment.contentType})`);
          
          const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                          /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
          const isVideo = (attachment.contentType && attachment.contentType.startsWith('video/')) ||
                          /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(attachment.name);
          
          if (isAudio || isVideo) {
            mediaUrl = attachment.url;
            mediaType = isAudio ? 'audio' : 'video';
            logger.console.log(`[SHAZAM] Valid ${mediaType} file detected in reply: ${mediaUrl}`);
          }
        }
      } catch (error) {
        logger.console.error(`[SHAZAM] Error fetching replied message: ${error.message}`);
      }
    }

    if (!mediaUrl) {
      logger.console.warn(`[SHAZAM] No valid media found`);
      return runHelpCommand(message, 'shazam');
    }

    try {
      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor('#7985cd')
        .setDescription(`${emojis.loading} Identifying music from ${mediaType}...`);

      const loadingMessage = await message.channel.send({ embeds: [loadingEmbed] });
      logger.console.log(`[SHAZAM] Processing ${mediaType} file...`);

      // Download the audio file first
      logger.console.log(`[SHAZAM] Downloading media file...`);
      const audioResponse = await fetch(mediaUrl);
      if (!audioResponse.ok) {
        logger.console.error(`[SHAZAM] Failed to download media: ${audioResponse.status}`);
        await loadingMessage.delete().catch(() => {});
        return embeds.deny(message, 'Failed to download the media file.');
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      logger.console.log(`[SHAZAM] Media downloaded, size: ${audioBuffer.byteLength} bytes`);

      // Limit to first 500KB to avoid 413 error (API has size limits)
      const maxSize = 500 * 1024; // 500KB
      const limitedBuffer = audioBuffer.byteLength > maxSize 
        ? audioBuffer.slice(0, maxSize) 
        : audioBuffer;
      
      const audioBase64 = Buffer.from(limitedBuffer).toString('base64');
      logger.console.log(`[SHAZAM] Sending ${limitedBuffer.byteLength} bytes (${Math.round(limitedBuffer.byteLength / 1024)}KB) to API`);

      // Use Shazam's song detection endpoint
      const url = 'https://shazam.p.rapidapi.com/songs/v2/detect';
      
      const options = {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'x-rapidapi-key': process.env.RAPIDAPI_KEY || '31e0f8a28amsh98217b5ca7f4ae5p1e5fa9jsn7279a60000af',
          'x-rapidapi-host': 'shazam.p.rapidapi.com'
        },
        body: audioBase64
      };

      logger.console.log(`[SHAZAM] Sending request to Shazam API...`);
      const response = await fetch(url, options);
      logger.console.log(`[SHAZAM] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.console.error(`[SHAZAM] API error: ${response.status} - ${errorText}`);
        await loadingMessage.delete().catch(() => {});
        return embeds.deny(message, `Failed to identify the music. API returned: ${response.status}`);
      }

      const result = await response.json();
      logger.console.log(`[SHAZAM] API response received:`, JSON.stringify(result, null, 2));

      // Check if we got a match
      if (!result || !result.track) {
        logger.console.warn(`[SHAZAM] No track found in response`);
        await loadingMessage.delete().catch(() => {});
        return embeds.warn(message, 'Could not identify any music in this file.');
      }

      const track = result.track;
      logger.console.log(`[SHAZAM] Track identified: ${track.title} by ${track.subtitle}`);

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

      // Add genre if available
      if (track.genres && track.genres.primary) {
        resultEmbed.addFields({ name: 'Genre', value: track.genres.primary, inline: true });
      }

      logger.console.log(`[SHAZAM] Successfully identified and sent result`);
      return loadingMessage.edit({ embeds: [resultEmbed] });

    } catch (error) {
      logger.console.error(`[SHAZAM] Error occurred: ${error.message}`);
      logger.console.error(`[SHAZAM] Stack trace:`, error.stack);
      throw error; // Re-throw to trigger webhook logging
    }
  }
};
