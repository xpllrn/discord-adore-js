const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors, emojis } = require('../../../config/setup');
const logger = require('../../../utils/logger');
const { AssemblyAI } = require('assemblyai');

module.exports = {
  name: "transcript",
  aliases: ['transcribe', 'ts'],
  description: 'Transcribe voice notes and audio files to text',
  syntax: 'transcript {attach audio} or transcript {audio url}',
  example: 'transcript https://example.com/audio.mp3',
  run: async(client, message, args) => {
    
    let audioUrl = null;

    // Check for audio attachment
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      // Check if it's an audio file by contentType or file extension
      const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                      /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
      if (isAudio) {
        audioUrl = attachment.url;
      }
    }

    // Check for audio URL in args
    if (!audioUrl && args[0]) {
      const urlPattern = /^https?:\/\/.+\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)/i;
      if (urlPattern.test(args[0]) || args[0].startsWith('http')) {
        audioUrl = args[0];
      }
    }

    // Check for replied message with audio
    if (!audioUrl && message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage.attachments.size > 0) {
          const attachment = repliedMessage.attachments.first();
          const isAudio = (attachment.contentType && attachment.contentType.startsWith('audio/')) ||
                          /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(attachment.name);
          if (isAudio) {
            audioUrl = attachment.url;
          }
        }
      } catch (error) {
        // Ignore if can't fetch replied message
      }
    }

    if (!audioUrl) {
      return runHelpCommand(message, 'transcript');
    }

    try {
      // Show loading message
      const loadingEmbed = new EmbedBuilder()
        .setColor('#7985cd')
        .setDescription(`${emojis.loading} Transcribing audio...`);

      const loadingMessage = await message.channel.send({ embeds: [loadingEmbed] });

      // Transcribe with AssemblyAI
      const assemblyClient = new AssemblyAI({
        apiKey: 'YOUR_API_KEY'
      });

      const params = {
        audio: audioUrl,
      };

      const transcript = await assemblyClient.transcripts.transcribe(params);

      if (!transcript || !transcript.text || transcript.text.trim().length === 0) {
        await loadingMessage.delete().catch(() => {});
        return embeds.warn(message, 'No speech detected in the audio file');
      }

      // Create result embed
      const resultEmbed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: message.author.displayName || message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setTitle('Audio Transcription')
        .setDescription(`\`\`\`${transcript.text.length > 1900 ? transcript.text.substring(0, 1897) + '...' : transcript.text}\`\`\``)
        .setFooter({
          text: 'AssemblyAI',
          iconURL: 'https://cdn.discordapp.com/emojis/1385950785975746684.png'
        });

      return loadingMessage.edit({ embeds: [resultEmbed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while transcribing the audio');
    }
  }
};
