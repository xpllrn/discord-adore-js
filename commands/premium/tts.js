const axios = require('axios');
const { embeds } = require('../../core/embeds');
const { AttachmentBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  name: "tts",
  aliases: ['speak', 'voice', 'say'],
  description: 'Convert text to high-quality voice message',
  usage: '{guildprefix}tts [voice] [text]',
  example: '{guildprefix}tts Kore Hello, this is a test message',
  premiumBypass: true, // Free for everyone
  run: async (client, message, args) => {
    if (!args.length) {
      const voiceList = [
        '**Available Voices (Google Gemini TTS - Free):**',
        '',
        '`Puck` - Warm and friendly',
        '`Charon` - Deep and authoritative',
        '`Kore` - Clear and professional',
        '`Fenrir` - Strong and confident',
        '`Aoede` - Soft and gentle',
        '',
        '**Usage:** `{guildprefix}tts [voice] [text]`',
        '**Example:** `{guildprefix}tts Kore Hello everyone!`'
      ].join('\n');
      
      return message.channel.send(voiceList.replace(/{guildprefix}/g, message.prefix || ','));
    }

    const voice = args[0];
    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];
    
    if (!validVoices.includes(voice)) {
      return embeds.deny(message, `Invalid voice. Choose from: ${validVoices.join(', ')}`);
    }

    const text = args.slice(1).join(' ');
    
    if (!text) {
      return embeds.deny(message, 'Please provide text to convert to speech');
    }

    if (text.length > 5000) {
      return embeds.deny(message, 'Text is too long. Maximum 5000 characters');
    }

    await message.channel.sendTyping();

    try {
      // Using Google Gemini 2.5 Flash TTS (completely free!)
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{ text: text }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const audioData = response.data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!audioData) {
        throw new Error('No audio data received from API');
      }

      const audioBuffer = Buffer.from(audioData, 'base64');
      const attachment = new AttachmentBuilder(audioBuffer, { name: 'voice.wav' });

      await message.channel.send({
        content: `🎙️ **${voice}** voice:`,
        files: [attachment]
      });

    } catch (error) {
      logger.webhook.error(error, message);
      
      if (error.response?.status === 400) {
        return embeds.deny(message, 'Invalid request. The text might contain unsupported characters');
      } else if (error.response?.status === 429) {
        return embeds.deny(message, 'Rate limit reached. Please try again later');
      } else {
        return embeds.deny(message, 'Failed to generate voice message. Please try again');
      }
    }
  }
};
