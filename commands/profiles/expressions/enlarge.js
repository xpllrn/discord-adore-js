const { AttachmentBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const https = require('https');
const http = require('http');
const logger = require('../../../utils/logger');

module.exports = {
  name: "enlarge",
  aliases: ['jumbo', 'e'],
  description: "Enlarge an emoji or emote and send it as a file.",
  syntax: 'enlarge (emoji/emote)',
  example: 'enlarge 🥹',
  run: async (client, message, args) => {
    try {
    
    let content = args.join(' ');
    
    // Check if replying to a message
    if (message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage && repliedMessage.content) {
          content = repliedMessage.content;
        }
      } catch (error) {
        // Ignore if can't fetch replied message
      }
    }

    if (!content) {
      return embeds.warn(message, 'Please provide an emoji/emote or reply to a message containing one.');
    }

    // Extract custom Discord emote (animated or static)
    const customEmoteMatch = content.match(/<a?:(\w+):(\d+)>/);
    
    if (customEmoteMatch) {
      const emoteName = customEmoteMatch[1];
      const emoteId = customEmoteMatch[2];
      const isAnimated = content.match(/<a:/);
      const extension = isAnimated ? 'gif' : 'png';
      // Add size parameter to get larger emotes (max 4096 for Discord)
      const emoteUrl = `https://cdn.discordapp.com/emojis/${emoteId}.${extension}?size=512&quality=lossless`;
      
      try {
        const buffer = await downloadFile(emoteUrl);
        const attachment = new AttachmentBuilder(buffer, {
          name: `${emoteName}.${extension}`
        });
        
        return await message.channel.send({ files: [attachment] });
      } catch (error) {
        return embeds.deny(message, 'Failed to download the emote. Please try again.');
      }
    }

    // Extract all Unicode emojis
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji})/gu;
    const emojiMatches = content.match(emojiRegex);
    
    if (emojiMatches && emojiMatches.length > 0) {
      // If 2+ emojis, try kitchen mix first
      if (emojiMatches.length >= 2) {
        const emoji1 = emojiMatches[0];
        const emoji2 = emojiMatches[1];
        const mixedEmojis = `${emoji1}_${emoji2}`;
        
        // Try emojik kitchen API to mix emojis (max size 512)
        const kitchenUrl = `https://emojik.vercel.app/s/${encodeURIComponent(mixedEmojis)}?size=512`;
        
        try {
          const buffer = await downloadFile(kitchenUrl);
          const attachment = new AttachmentBuilder(buffer, {
            name: `emoji_kitchen_mix.png`
          });
          
          return await message.channel.send({ files: [attachment] });
        } catch (error) {
          // Kitchen failed, fall through to enlarge first emoji
        }
      }
      
      // Single emoji or kitchen not available - enlarge first emoji
      const emoji = emojiMatches[0];
      
      // Convert emoji to codepoints properly
      const codePoints = [];
      for (const char of emoji) {
        const codePoint = char.codePointAt(0);
        if (codePoint) {
          codePoints.push(codePoint.toString(16));
        }
      }
      
      const codePointStr = codePoints.join('_');
      
      // Use emojik API for high-quality Unicode emojis (max size 512)
      const emojiUrl = `https://emojik.vercel.app/s/${encodeURIComponent(emoji)}?size=512`;
      
      try {
        const buffer = await downloadFile(emojiUrl);
        const attachment = new AttachmentBuilder(buffer, {
          name: `emoji_${codePointStr}.png`
        });
        
        return await message.channel.send({ files: [attachment] });
      } catch (error) {
        return embeds.deny(message, 'Failed to download the emoji. Please try again.');
      }
    }

    return embeds.warn(message, 'No emoji or emote found in the message.');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while processing the emoji');
    }
  }
};

/**
 * Download a file from URL and return as buffer
 * @param {string} url - File URL
 * @returns {Promise<Buffer>}
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      response.on('error', (err) => {
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}
