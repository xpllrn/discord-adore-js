const axios = require('axios');
const { embeds } = require('../../core/embeds');
const { AttachmentBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  name: "tts",
  aliases: ['speak', 'voice', 'say'],
  description: 'Convert text to high-quality voice message',
  usage: '{guildprefix}tts [text]',
  example: '{guildprefix}tts Hello, this is a test message',
  premiumBypass: true, // Free for everyone
  run: async (client, message, args) => {
    if (!args.length) {
      return message.channel.send(
        '**Text-to-Speech (Free & No API Key Required)**\n\n' +
        '**Usage:** `{guildprefix}tts [text]`\n' +
        '**Example:** `{guildprefix}tts Hello everyone!`\n\n' +
        'Uses high-quality TTS from StreamElements (completely free!)'.replace(/{guildprefix}/g, message.prefix || ',')
      );
    }

    const text = args.join(' ');
    
    if (text.length > 500) {
      return embeds.deny(message, 'Text is too long. Maximum 500 characters');
    }

    await message.channel.sendTyping();

    try {
      // Using StreamElements TTS API (completely free, no API key needed!)
      const encodedText = encodeURIComponent(text);
      const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodedText}`;
      
      const response = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      const audioBuffer = Buffer.from(response.data);
      
      // Generate simple waveform (base64 encoded byte array)
      const waveform = Buffer.from(new Array(64).fill(128)).toString('base64');
      
      // Estimate duration (rough: 150 chars per second)
      const duration = Math.max(1, Math.ceil(text.length / 150));
      
      // Send as voice message with metadata
      const attachment = new AttachmentBuilder(audioBuffer, { 
        name: 'voice-message.ogg'
      });

      await message.channel.send({
        files: [attachment],
        flags: 8192, // MessageFlags.IsVoiceMessage
        attachments: [{
          id: '0',
          filename: 'voice-message.ogg',
          duration_secs: duration,
          waveform: waveform
        }]
      });

    } catch (error) {
      logger.webhook.error(error, message);
      
      if (error.response?.status === 429) {
        return embeds.deny(message, 'Rate limit reached. Please try again in a moment');
      } else {
        return embeds.deny(message, 'Failed to generate voice message. Please try again');
      }
    }
  }
};
