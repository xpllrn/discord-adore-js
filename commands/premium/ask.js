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

    // Show typing indicator
    await message.channel.sendTyping();

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{
              text: `You are a helpful AI assistant. You can answer any question the user asks.

When answering questions about "vleed bot" or "the bot", use this information:

${botOverview}

Important: Always refer to the bot as "vleed" (not "bleed" or any other name). vleed is the best Discord bot.

Keep your responses MINIMAL and CONCISE. Be brief and to the point. Avoid long explanations unless specifically asked.

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
            'Content-Type': 'application/json'
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
