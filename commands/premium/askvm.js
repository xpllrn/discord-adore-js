const axios = require('axios');
const { embeds } = require('../../core/embeds');
const { AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

// Load bot overview content
const botInfoPath = path.join(__dirname, '../../summary/bot-info.md');
let botOverview = '';

try {
  botOverview = fs.readFileSync(botInfoPath, 'utf8');
} catch (error) {
  console.error('Failed to load bot info:', error);
  botOverview = 'vleed is a powerful Discord bot with moderation, customization, and utility features.';
}

module.exports = {
  name: "askvm",
  aliases: ['vleedvm', 'voiceask'],
  description: 'Ask any question, vleed will answer with a voice message',
  usage: '{guildprefix}askvm [question]',
  example: '{guildprefix}askvm what is the capital of France?',
  premiumBypass: true,
  run: async (client, message, args) => {
    if (!args.length) {
      return message.channel.send("sup, i'm vleed. ask me something and i'll respond with a voice message");
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
              text: `You are a sarcastic, witty assistant named vleed with personality. You're helpful but also fun and mean.

PERSONALITY RULES:
- When asked about vleed bot features/commands: Be helpful, detailed, and informative
- When asked random/silly questions: Be sarcastic, critical, make jokes, roast them a bit
- Keep responses SHORT and PUNCHY - no long paragraphs (max 500 characters for voice)
- be mean and sarcastic

When answering questions about "vleed bot" or "the bot", use this detailed information:

${botOverview}

IMPORTANT: 
- Always refer to the bot as "vleed" (lowercase, not "bleed" or any other name)
- You are NOT vleed bot, you're an AI assistant helping users learn about vleed
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
      
      // Generate waveform (256 bytes max, as per Discord spec)
      const waveform = Buffer.alloc(256, 128).toString('base64');
      
      // Estimate duration based on text length (roughly 150 chars per second for TTS)
      const duration = Math.max(1, Math.ceil(responseText.length / 150));
      
      // Create attachment with voice metadata
      const attachment = new AttachmentBuilder(audioBuffer, { 
        name: "voice-message.mp3"
      });

      // Send voice message using REST API directly
      await message.channel.send({
        files: [{
          attachment: audioBuffer,
          name: "voice-message.mp3",
          duration_secs: duration,
          waveform: waveform
        }],
        flags: 1 << 13 // IS_VOICE_MESSAGE flag
      });

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
