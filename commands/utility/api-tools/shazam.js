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

    logger.info(`[SHAZAM] Command triggered by ${message.author.tag} in ${message.guild?.name || 'DM'}`);

    // Check for audio/video attachment
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      logger.info(`[SHAZAM] Found attachment: ${attachment.name} (${attachment.contentType})`);
      
      // Check if it's audio or video
      const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                      /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
      const isVideo = (attachment.contentType && attachment.contentType.startsWith('video/')) ||
                      /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(attachment.name);
      
      if (isAudio || isVideo) {
        mediaUrl = attachment.url;
        mediaType = isAudio ? 'audio' : 'video';
        logger.info(`[SHAZAM] Valid ${mediaType} file detected: ${mediaUrl}`);
      } else {
        logger.warn(`[SHAZAM] Attachment is not audio/video: ${attachment.name}`);
      }
    }

    // Check for replied message with audio/video
    if (!mediaUrl && message.reference) {
      logger.info(`[SHAZAM] Checking replied message for media`);
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage.attachments.size > 0) {
          const attachment = repliedMessage.attachments.first();
          logger.info(`[SHAZAM] Found attachment in reply: ${attachment.name} (${attachment.contentType})`);
          
          const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                          /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
          const isVideo = (attachment.contentType && attachment.contentType.startsWith('video/')) ||
                          /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(attachment.name);
          
          if (isAudio || isVideo) {
            mediaUrl = attachment.url;
            mediaType = isAudio ? 'audio' : 'video';
            logger.info(`[SHAZAM] Valid ${mediaType} file detected in reply: ${mediaUrl}`);
          }
        }
      } catch (error) {
        logger.error(`[SHAZAM] Error fetching replied message: ${error.message}`);
      }
    }

    if (!mediaUrl) {
      logger.warn(`[SHAZAM] No valid media found`);
      return runHelpCommand(message, 'shazam');
    }

    try {
      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor('#7985cd')
        .setDescription(`${emojis.loading} Identifying music from ${mediaType}...`);

      const loadingMessage = await message.channel.send({ embeds: [loadingEmbed] });
      logger.info(`[SHAZAM] Processing ${mediaType} file...`);

      // Download the audio file first
      logger.info(`[SHAZAM] Downloading media file...`);
      const audioResponse = await fetch(mediaUrl);
      if (!audioResponse.ok) {
        logger.error(`[SHAZAM] Failed to download media: ${audioResponse.status}`);
        await loadingMessage.delete().catch(() => {});
        return embeds.deny(message, 'Failed to download the media file.');
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      logger.info(`[SHAZAM] Media downloaded, size: ${audioBuffer.byteLength} bytes`);

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

      logger.info(`[SHAZAM] Sending request to Shazam API...`);
      const response = await fetch(url, options);
      logger.info(`[SHAZAM] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[SHAZAM] API error: ${response.status} - ${errorText}`);
        await loadingMessage.delete().catch(() => {});
        return embeds.deny(message, `Failed to identify the music. API returned: ${response.status}`);
      }

      const result = await response.json();
      logger.info(`[SHAZAM] API response received:`, JSON.stringify(result, null, 2));

      // Check if we got a match
      if (!result || !result.track) {
        logger.warn(`[SHAZAM] No track found in response`);
        await loadingMessage.delete().catch(() => {});
        return embeds.warn(message, 'Could not identify any music in this file.');
      }

      const track = result.track;
      logger.info(`[SHAZAM] Track identified: ${track.title} by ${track.subtitle}`);

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

      logger.info(`[SHAZAM] Successfully identified and sent result`);
      return loadingMessage.edit({ embeds: [resultEmbed] });

    } catch (error) {
      logger.error(`[SHAZAM] Error occurred: ${error.message}`);
      logger.error(`[SHAZAM] Stack trace:`, error.stack);
      throw error; // Re-throw to trigger webhook logging
    }
  }
};
