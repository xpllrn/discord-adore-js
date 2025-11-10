const { AttachmentBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const https = require('https');
const http = require('http');

module.exports = {
  name: "enlarge",
  aliases: ['jumbo', 'bigemoji'],
  description: "Enlarge an emoji or emote and send it as a file",
  syntax: 'enlarge (emoji/emote) or reply to a message',
  example: 'enlarge :emoji:',
  run: async (client, message, args) => {
    
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
      const emoteUrl = `https://cdn.discordapp.com/emojis/${emoteId}.${extension}`;
      
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

    // Extract Unicode emoji
    const emojiMatch = content.match(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
    
    if (emojiMatch) {
      const emoji = emojiMatch[0];
      const codePoints = [...emoji].map(char => 
        char.codePointAt(0).toString(16)
      ).join('_');
      
      // Use emojik API for high-quality Unicode emojis (Google style, 256px)
      const emojiUrl = `https://emojik.vercel.app/s/${codePoints}?size=256`;
      
      try {
        const buffer = await downloadFile(emojiUrl);
        const attachment = new AttachmentBuilder(buffer, {
          name: `emoji_${codePoints}.png`
        });
        
        return await message.channel.send({ files: [attachment] });
      } catch (error) {
        return embeds.deny(message, 'Failed to download the emoji. Please try again.');
      }
    }

    return embeds.warn(message, 'No emoji or emote found in the message.');
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
