const axios = require('axios');
const { embeds } = require('../../core/embeds');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { ensureUserData, User } = require('../../database');

// Load bot overview content
const botInfoPath = path.join(__dirname, '../../summary/bot-info.md');
let botOverview = '';

try {
  botOverview = fs.readFileSync(botInfoPath, 'utf8');
} catch (error) {
  console.error('Failed to load bot info:', error);
  botOverview = 'vleed is a powerful Discord bot with moderation, customization, and utility features.';
}

// Helper function to format time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
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

    // Ensure user data exists
    await ensureUserData(message.author.id);

    // Get user's conversation memory (last 5 conversations)
    let userData = await User.findOne({ UserID: message.author.id });
    let memoryContext = '';
    
    if (userData && userData.ConversationMemory && userData.ConversationMemory.length > 0) {
      // Get recent memories (last 5, sorted by most recent)
      const recentMemories = userData.ConversationMemory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
      
      if (recentMemories.length > 0) {
        memoryContext = '\n\nPREVIOUS CONVERSATIONS WITH THIS USER:\n';
        recentMemories.forEach(mem => {
          const timeAgo = getTimeAgo(mem.timestamp);
          memoryContext += `- ${timeAgo}: ${mem.summary}\n`;
          if (mem.context) {
            memoryContext += `  Context: ${mem.context}\n`;
          }
        });
        memoryContext += '\nUse this context naturally if relevant. Bring up past topics when appropriate.';
      }
    }

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
- If you notice relevant past conversations, naturally reference them (e.g., "btw, didn't you have class? how'd that go?")
- Be proactive about time-sensitive info from past conversations

When answering questions about "vleed bot" or "the bot", use this detailed information:

${botOverview}

IMPORTANT: 
- Always refer to the bot as "vleed" (lowercase, not "bleed" or any other name)
- You are NOT vleed bot, you're an AI assistant helping users learn about vleed
- If someone asks you to do bot actions (like "ban someone" or "meow in vc"), remind them you're just an AI helper, not the actual bot${memoryContext}${contextText}

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

      // Generate a summary for memory storage
      try {
        const summaryResponse = await axios.post(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
          {
            contents: [{
              parts: [{
                text: `Summarize this conversation in 1-2 short lines (max 150 chars). Extract key info like events, times, preferences, or important facts.

Question: ${question}
Answer: ${aiResponse}

Summary:`
              }]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 100,
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': process.env.GEMINI_API_KEY
            }
          }
        );

        const summary = summaryResponse.data.candidates[0].content.parts[0].text.trim();

        // Save to user's conversation memory (keep last 10)
        await User.findOneAndUpdate(
          { UserID: message.author.id },
          {
            $push: {
              ConversationMemory: {
                $each: [{
                  summary: summary.substring(0, 200),
                  timestamp: new Date(),
                  context: question.substring(0, 500)
                }],
                $slice: -10 // Keep only last 10 memories
              }
            }
          }
        );
      } catch (memoryError) {
        // Silent fail for memory storage - don't interrupt user experience
        console.error('Failed to store conversation memory:', memoryError.message);
      }

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
