const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { AssemblyAI } = require('assemblyai');

const client = new AssemblyAI({
  apiKey: 'YOUR_API_KEY'
});

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
          if (attachment.contentType && attachment.contentType.startsWith('audio/')) {
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
      message.channel.sendTyping();

      // Transcribe with AssemblyAI
      const params = {
        audio: audioUrl,
        speech_model: 'best',
      };

      const transcript = await client.transcripts.transcribe(params);

      if (!transcript || !transcript.text || transcript.text.trim().length === 0) {
        return embeds.warn(message, 'No speech detected in the audio file.');
      }

      // Reply with the transcribed text
      return message.reply(transcript.text.length > 2000 ? transcript.text.substring(0, 1997) + '...' : transcript.text);

    } catch (error) {
      throw error;
    }
  }
};
