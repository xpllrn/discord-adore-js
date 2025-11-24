const axios = require('axios');
const { embeds } = require('../../../core/embeds');
const logger = require('../../../utils/logger');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Helper function to convert MP3 to Opus OGG for mobile compatibility
async function convertToOpus(inputBuffer) {
  const tempInput = path.join(__dirname, `temp-${Date.now()}.mp3`);
  const tempOutput = path.join(__dirname, `temp-${Date.now()}.ogg`);
  
  return new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(tempInput, inputBuffer);
      
      ffmpeg(tempInput)
        .audioCodec('libopus')
        .audioBitrate('64k')
        .audioFrequency(48000)
        .format('ogg')
        .on('end', () => {
          try {
            const outputBuffer = fs.readFileSync(tempOutput);
            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);
            resolve(outputBuffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
          reject(error);
        })
        .save(tempOutput);
    } catch (error) {
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      reject(error);
    }
  });
}

module.exports = {
  name: "tts",
  aliases: ['speak', 'voice', 'say'],
  description: 'Convert text to high-quality voice message',
  syntax: 'tts [text]',
  example: 'tts Hello, this is a test message',
  premiumBypass: true, // Free for everyone
  run: async (client, message, args) => {
    if (!args.length) {
      return message.channel.send(
        '**Text-to-Speech (Free & No API Key Required)**\n\n' +
        '**Syntax:** `{guildprefix}tts [text]`\n' +
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

      // Convert MP3 to Opus OGG for mobile compatibility
      const audioBuffer = await convertToOpus(Buffer.from(response.data));
      const fileSize = audioBuffer.length;
      
      // Step 1: Request upload URL from Discord
      const uploadRequest = await axios.post(
        `https://discord.com/api/v10/channels/${message.channel.id}/attachments`,
        {
          files: [{
            filename: "voice-message.ogg",
            file_size: fileSize,
            id: 0
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${client.token}`
          }
        }
      );

      const { upload_url, upload_filename } = uploadRequest.data.attachments[0];

      // Step 2: Upload the audio file to Discord's CDN
      await axios.put(upload_url, audioBuffer, {
        headers: {
          'Content-Type': 'audio/ogg'
        }
      });

      // Step 3: Generate waveform and duration
      const waveform = Buffer.from(Array.from({length: 256}, () => Math.floor(Math.random() * 256))).toString('base64');
      const duration = Math.max(1, Math.ceil(text.length / 150));

      // Step 4: Send the voice message
      await axios.post(
        `https://discord.com/api/v10/channels/${message.channel.id}/messages`,
        {
          flags: 8192, // IS_VOICE_MESSAGE flag
          attachments: [{
            id: "0",
            filename: "voice-message.ogg",
            uploaded_filename: upload_filename,
            duration_secs: duration,
            waveform: waveform
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${client.token}`
          }
        }
      );

    } catch (error) {
      logger.webhook.error(error, message);
      
      if (error.message.includes('ffmpeg')) {
        return embeds.deny(message, 'Voice message feature requires ffmpeg. Please contact bot admin');
      } else if (error.response?.status === 429) {
        return embeds.deny(message, 'Rate limit reached. Please try again in a moment');
      } else {
        return embeds.deny(message, 'Failed to generate voice message. Please try again');
      }
    }
  }
};
