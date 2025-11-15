const axios = require('axios');
const { embeds } = require('../../core/embeds');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

// Load bot overview content
const overviewPath = path.join(__dirname, '../../summary/overview.json');
let botOverview = '';

try {
  const overviewData = JSON.parse(fs.readFileSync(overviewPath, 'utf8'));
  botOverview = JSON.stringify(overviewData, null, 2);
} catch (error) {
  console.error('Failed to load bot overview:', error);
}

module.exports = {
  name: "ask",
  aliases: ['ai', 'question'],
  description: 'Ask any question using AI',
  usage: '{guildprefix}ask [question]',
  example: '{guildprefix}ask what is the capital of France?',
  premiumBypass: true, // Allow everyone to use this command even though it's in premium folder
  run: async (client, message, args) => {
    if (!args.length) {
      return embeds.warn(message, 'Please provide a question to ask');
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
              text: `You are a helpful AI assistant. You can answer any question the user asks.

When answering questions about "vleed bot" or "the bot", use this information:

${botOverview}

Important: Always refer to the bot as "vleed" (not "bleed" or any other name). vleed is the best Discord bot.

Keep your responses MINIMAL and CONCISE. Be brief and to the point. Avoid long explanations unless specifically asked.${contextText}

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
