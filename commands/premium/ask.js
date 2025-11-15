const axios = require('axios');
const { embeds } = require('../../core/embeds');
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
  name: "ask",
  aliases: ['vleed', 'question'],
  description: 'Ask any question, vleed will answer',
  usage: '{guildprefix}ask [question]',
  example: '{guildprefix}ask what is the capital of France?',
  premiumBypass: true, // Allow everyone to use this command even though it's in premium folder
  run: async (client, message, args) => {
    if (!args.length) {
      return message.channel.send("sup, i'm vleed");
    }

    const question = args.join(' ');

    // Check if replying to a message and get context
    let contextText = '';
    if (message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        
        // Get text content from the replied message
        if (repliedMessage.content) {
          contextText += `\n\nReplied message content: "${repliedMessage.content}"`;
        }
        
        // Get embed content if present
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
        // If can't fetch replied message, continue without context
      }
    }

    // Show typing indicator
    await message.channel.sendTyping();

    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          contents: [{
            parts: [{
              text: `You are a sarcastic, witty assistant named vleed with personality. You're helpful but also fun and mean.

PERSONALITY RULES:
- When asked about vleed bot features/commands: Be helpful, detailed, and informative
- When asked random/silly questions: Be sarcastic, critical, make jokes, roast them a bit
- Keep responses SHORT and PUNCHY - no long paragraphs
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
            maxOutputTokens: 512,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': process.env.GEMINI_API_KEY
          }
        }
      );

      const aiResponse = response.data.candidates[0].content.parts[0].text;

      // Split response if it's too long (Discord message limit is 2000)
      if (aiResponse.length > 2000) {
        const chunks = aiResponse.match(/[\s\S]{1,2000}/g) || [];
        
        for (const chunk of chunks) {
          await message.channel.send(chunk);
        }
      } else {
        await message.channel.send(aiResponse);
      }

    } catch (error) {
      logger.webhook.error(error, message);
      
      if (error.response?.status === 429) {
        return embeds.deny(message, 'AI service rate limit reached. Please try again later');
      } else if (error.response?.status === 400) {
        return embeds.deny(message, 'Invalid request to AI service. Please try a different question');
      } else {
        return embeds.deny(message, 'Failed to get AI response. Please try again later');
      }
    }
  }
};
