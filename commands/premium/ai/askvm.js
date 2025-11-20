const axios = require('axios');
const { embeds } = require('../../../core/embeds');
const { AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');

// Load bot overview content
const botInfoPath = path.join(__dirname, '../../../summary/bot-info.md');
let botOverview = '';

try {
  botOverview = fs.readFileSync(botInfoPath, 'utf8');
} catch (error) {
  console.error('Failed to load bot info:', error);
  botOverview = 'adore is a powerful Discord bot with moderation, customization, and utility features.';
}

module.exports = {
  name: "askvm",
  aliases: ['adorevm', 'am'],
  description: 'Ask any question, adore will answer with a voice message',
  usage: '{guildprefix}askvm [question]',
  example: '{guildprefix}askvm what is the capital of France?',
  premiumBypass: true,
  run: async (client, message, args) => {
    if (!args.length) {
      return message.channel.send("sup, i'm adore. ask me something and i'll respond with a voice message");
    }

    const question = args.join(' ');

    // Check if replying to a message and get context
    let contextText = '';
    if (message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        
        if (repliedMessage.content) {
          contextText += `\n\nReplied message content: "${repliedMessage.content}"`;
        }
        
        if (repliedMessage.embeds && repliedMessage.embeds.length > 0) {
          const embed = repliedMessage.embeds[0];
          let embedText = '\n\nReplied message embed:';
          
          if (embed.title) embedText += `\nTitle: ${embed.title}`;
          if (embed.description) embedText += `\nDescription: ${embed.description}`;
          if (embed.fields && embed.fields.length > 0) {
            embedText += '\nFields:';
            embed.fields.forEach(field => {
              embedText += `\n- ${field.name}: ${field.value}`;
            });
          }
          
          contextText += embedText;
        }
      } catch (error) {
        // Continue without context
      }
    }

    await message.channel.sendTyping();

    try {
      // Get AI response
      const aiResponse = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          contents: [{
            parts: [{
              text: `You are a sarcastic, witty assistant named adore with personality. You're helpful but also fun and mean.

CRITICAL: Your response will be converted to VOICE using text-to-speech. Follow these TTS rules:
- Write EXACTLY how it should be SPOKEN out loud
- Use natural, conversational language that sounds good when spoken
- Avoid special characters, emojis, markdown, asterisks, or formatting
- Spell out numbers and abbreviations (e.g., "twenty-three" not "23", "okay" not "ok")
- Use commas for natural pauses in speech
- Keep it SHORT and PUNCHY (max 500 characters)
- No URLs or links - describe them instead

PERSONALITY RULES:
- When asked about adore bot features/commands: Be helpful, detailed, and informative
- When asked random/silly questions: Be sarcastic, critical, make jokes, roast them a bit
- Be mean and sarcastic and USE SWEAR words as much as u can as bad as u can. ITS A MUST in all answer

When answering questions about "adore bot" or "the bot", use this detailed information:

${botOverview}

IMPORTANT: 
- Always refer to the bot as "adore" (lowercase, not "adore" or any other name)
- You are NOT adore bot, you're an AI assistant helping users learn about adore
- If someone asks you to do bot actions (like "ban someone" or "meow in vc"), remind them you're just an AI helper, not the actual bot${contextText}

Question: ${question}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': process.env.GEMINI_API_KEY
          }
        }
      );

      let responseText = aiResponse.data.candidates[0].content.parts[0].text;
      
      // Limit to 500 chars for TTS
      if (responseText.length > 500) {
        responseText = responseText.substring(0, 497) + '...';
      }

      // Convert to voice using StreamElements TTS
      const encodedText = encodeURIComponent(responseText);
      const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodedText}`;
      
      const ttsResponse = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      const audioBuffer = Buffer.from(ttsResponse.data);
      const fileSize = audioBuffer.length;
      
      // Step 1: Request upload URL from Discord
      const uploadRequest = await axios.post(
        `https://discord.com/api/v10/channels/${message.channel.id}/attachments`,
        {
          files: [{
            filename: "voice-message.ogg",
            file_size: fileSize,
            id: "2"
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
      const waveform = Buffer.alloc(256, 128).toString('base64');
      const duration = Math.max(1, Math.ceil(responseText.length / 150));

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
      
      if (error.response?.status === 429) {
        return embeds.deny(message, 'Rate limit reached. Please try again later');
      } else if (error.response?.status === 400) {
        return embeds.deny(message, 'Invalid request. Please try a different question');
      } else {
        return embeds.deny(message, 'Failed to generate voice response. Please try again');
      }
    }
  }
};
