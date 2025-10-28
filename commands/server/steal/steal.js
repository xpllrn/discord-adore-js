const { embeds } = require('../../../core/embeds');

// Helper function to remove invite links from text
function removeInviteLinks(text) {
  if (!text) return text;

  // Remove various invite link patterns
  const invitePatterns = [
    /discord\.gg\/[\w-]+/gi,
    /discordapp\.com\/invite\/[\w-]+/gi,
    /discord\.com\/invite\/[\w-]+/gi,
    /dsc\.gg\/[\w-]+/gi,
    /invite\.gg\/[\w-]+/gi,
    /\bgg\/[\w-]+/gi, // Remove patterns 
    /\/[\w-]+(?=\s|$)/g // Remove patterns
  ];

  let cleanText = text;
  invitePatterns.forEach(pattern => {
    cleanText = cleanText.replace(pattern, '').trim();
  });

  // Clean up extra spaces and trim
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  return cleanText || 'sticker'; // Fallback if name becomes empty
}

// Helper function to format rate limit time
function formatRateLimitTime(retryAfter) {
  if (retryAfter < 60) {
    return `${Math.ceil(retryAfter)} second${Math.ceil(retryAfter) === 1 ? '' : 's'}`;
  } else if (retryAfter < 3600) {
    const minutes = Math.ceil(retryAfter / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  } else {
    const hours = Math.ceil(retryAfter / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
}

module.exports = {
  name: "steal",
  aliases: ['stealemoji', 'stealsticker'],
  description: `Steal stickers and emotes from messages by replying to them`,
  syntax: 'steal (reply to message)',
  example: 'steal (reply to a message with stickers/emotes)',
  permission: "Manage Expressions",

  run: async(client, message, args) => {

    // Check if this is a reply to another message
    if (!message.reference || !message.reference.messageId) {
      return embeds.warn(message, 'Please reply to a message containing stickers or emotes to steal them');
    }

    try {
      // Fetch the referenced message
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      
      if (!referencedMessage) {
        return embeds.warn(message, 'Could not find the referenced message');
      }

      const itemsToSteal = [];
      const failedItems = [];

      // Check for stickers
      if (referencedMessage.stickers && referencedMessage.stickers.size > 0) {
        for (const sticker of referencedMessage.stickers.values()) {
          itemsToSteal.push({
            type: 'sticker',
            name: sticker.name,
            url: sticker.url,
            id: sticker.id
          });
        }
      }

      // Check for emotes (custom emojis) in message content
      const emojiRegex = /<a?:(\w+):(\d+)>/g;
      const foundEmojis = new Set(); // Track found emojis to avoid duplicates
      
      // Extract emojis from message content
      const emojiMatches = referencedMessage.content.match(emojiRegex);
      
      if (emojiMatches) {
        for (const emojiMatch of emojiMatches) {
          const [, name, id] = emojiMatch.match(/<a?:(\w+):(\d+)>/);
          foundEmojis.add(id); // Track this emoji
          
          const isAnimated = emojiMatch.startsWith('<a:');
          
          // Check if emoji already exists in the guild
          const existingEmoji = message.guild.emojis.cache.get(id);
          if (existingEmoji) {
            failedItems.push({
              type: 'emoji',
              name: name,
              reason: 'Already exists in this server'
            });
            continue;
          }

          itemsToSteal.push({
            type: 'emoji',
            name: name,
            id: id,
            animated: isAnimated
          });
        }
      }

      // Check for emotes in embeds
      if (referencedMessage.embeds && referencedMessage.embeds.length > 0) {
        for (const embed of referencedMessage.embeds) {
          // Collect all text fields from the embed
          const embedTexts = [];
          
          if (embed.title) embedTexts.push(embed.title);
          if (embed.description) embedTexts.push(embed.description);
          if (embed.footer?.text) embedTexts.push(embed.footer.text);
          if (embed.author?.name) embedTexts.push(embed.author.name);
          
          if (embed.fields) {
            for (const field of embed.fields) {
              if (field.name) embedTexts.push(field.name);
              if (field.value) embedTexts.push(field.value);
            }
          }
          
          // Search for emojis in all embed text
          for (const text of embedTexts) {
            const embedEmojiMatches = text.match(emojiRegex);
            
            if (embedEmojiMatches) {
              for (const emojiMatch of embedEmojiMatches) {
                const [, name, id] = emojiMatch.match(/<a?:(\w+):(\d+)>/);
                
                // Skip if we already found this emoji
                if (foundEmojis.has(id)) continue;
                foundEmojis.add(id);
                
                const isAnimated = emojiMatch.startsWith('<a:');
                
                // Check if emoji already exists in the guild
                const existingEmoji = message.guild.emojis.cache.get(id);
                if (existingEmoji) {
                  failedItems.push({
                    type: 'emoji',
                    name: name,
                    reason: 'Already exists in this server'
                  });
                  continue;
                }

                itemsToSteal.push({
                  type: 'emoji',
                  name: name,
                  id: id,
                  animated: isAnimated
                });
              }
            }
          }
        }
      }

      if (itemsToSteal.length === 0) {
        return embeds.warn(message, 'No stickers or emotes found in the referenced message');
      }

      // Start stealing process with loading message
      const itemType = itemsToSteal.length === 1 ?
        (itemsToSteal[0].type === 'sticker' ? 'sticker' : 'emote') :
        (itemsToSteal.every(item => item.type === 'sticker') ? 'stickers' :
         itemsToSteal.every(item => item.type === 'emoji') ? 'emotes' : 'items');

      const statusMessage = await embeds.loading(message, `Please wait, I'm stealing **${itemsToSteal.length} ${itemType}** for you`);

      let successCount = 0;
      let stolenStickers = [];
      let stolenEmojis = [];
      let stickerSlotsFull = false;
      let emojiSlotsFull = false;
      let rateLimitedItems = [];

      for (let i = 0; i < itemsToSteal.length; i++) {
        const item = itemsToSteal[i];
        
        try {
          if (item.type === 'sticker') {
            // Check if sticker slots are full
            if (message.guild.stickers.cache.size >= 60) {
              stickerSlotsFull = true;
              failedItems.push({
                type: 'sticker',
                name: item.name,
                reason: 'Server is at max slots for stickers'
              });
              continue;
            }

            // Clean the sticker name and create description
            const cleanName = removeInviteLinks(item.name);
            const description = 'Sticker added using Adore bot';

            // Steal sticker
            const sticker = await message.guild.stickers.create({
              file: item.url,
              name: cleanName,
              description: description,
              tags: 'stolen'
            });
            successCount++;
            stolenStickers.push(sticker.name);

          } else if (item.type === 'emoji') {
            // Check if emoji slots are full
            if (message.guild.emojis.cache.size >= 500) {
              emojiSlotsFull = true;
              failedItems.push({
                type: 'emoji',
                name: item.name,
                reason: 'Server is at max slots for emotes'
              });
              continue;
            }

            // Steal emoji
            const emojiUrl = `https://cdn.discordapp.com/emojis/${item.id}.${item.animated ? 'gif' : 'png'}`;
            
            const emoji = await message.guild.emojis.create({
              attachment: emojiUrl,
              name: item.name
            });
            successCount++;
            stolenEmojis.push(emoji);
          }

          // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          if (error.code === 29) {
            // Rate limited - extract retry after time
            const retryAfter = error.retryAfter || 5; // Default to 5 seconds if not provided
            const timeString = formatRateLimitTime(retryAfter);

            rateLimitedItems.push({
              type: item.type,
              name: item.name,
              retryAfter: retryAfter,
              timeString: timeString
            });

            failedItems.push({
              type: item.type,
              name: item.name,
              reason: `Rate limited - retry in ${timeString}`
            });

            // Update status message with rate limit info if multiple items
            if (itemsToSteal.length > 1) {
              const remaining = itemsToSteal.length - i - 1;
              if (remaining > 0) {
                await statusMessage.edit({
                  embeds: [embeds.createLoading(message, `Rate limited! Waiting ${timeString} before continuing with ${remaining} remaining items...`)]
                }).catch(() => {});
              }
            }

            // Wait for the rate limit to expire
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

          } else if (error.code === 50013) {
            failedItems.push({
              type: item.type,
              name: item.name,
              reason: 'Insufficient permissions'
            });
          } else {
            // Other errors
            failedItems.push({
              type: item.type,
              name: item.name,
              reason: error.message
            });
          }
        }
      }

      // Final message
      if (successCount > 0) {
        // Create success message based on what was stolen
        if (stolenStickers.length > 0 && stolenEmojis.length > 0) {
          // Both stickers and emotes stolen - show combined message
          let finalMessage = '';
          if (stolenStickers.length === 1) {
            finalMessage += `Added sticker **${stolenStickers[0]}** to the server`;
          } else {
            finalMessage += `Added **${stolenStickers.length} new stickers** to the server`;
          }
          finalMessage += '\n\n';
          if (stolenEmojis.length === 1) {
            finalMessage += `Added emote **${stolenEmojis[0].name}** to the server`;
          } else {
            finalMessage += `Added **${stolenEmojis.length} new emotes** to the server`;
          }

          await statusMessage.edit({
            embeds: [embeds.createSuccess(message, finalMessage)]
          }).catch(() => {});

        } else if (stolenStickers.length > 0) {
          // Only stickers stolen
          const message_text = stolenStickers.length === 1 ?
            `Added sticker **${stolenStickers[0]}** to the server` :
            `Added **${stolenStickers.length} new stickers** to the server`;

          await statusMessage.edit({
            embeds: [embeds.createSuccess(message, message_text)]
          }).catch(() => {});

        } else if (stolenEmojis.length > 0) {
          // Only emotes stolen
          const message_text = stolenEmojis.length === 1 ?
            `Added emote **${stolenEmojis[0].name}** to the server` :
            `Added **${stolenEmojis.length} new emotes** to the server`;

          await statusMessage.edit({
            embeds: [embeds.createSuccess(message, message_text)]
          }).catch(() => {});
        }

        // Show slot full warnings as separate messages if needed
        if (stickerSlotsFull) {
          await embeds.warn(message, 'Server is at **max slots** for stickers!');
        }

        if (emojiSlotsFull) {
          await embeds.warn(message, 'Server is at **max slots** for emotes!');
        }

        // Show rate limit information if there were any rate limited items
        if (rateLimitedItems.length > 0) {
          const rateLimitMessage = rateLimitedItems.length === 1 ?
            `⏰ **Rate Limited**: ${rateLimitedItems[0].name} (${rateLimitedItems[0].type}) - retry in ${rateLimitedItems[0].timeString}` :
            `⏰ **Rate Limited**: ${rateLimitedItems.length} items were rate limited. Try again later.`;

          await embeds.warn(message, rateLimitMessage);
        }

      } else {
        // Edit the status message with specific failure reason
        let failureMessage = 'Failed to steal any items.';

        // Check if all failures were due to full slots
        const stickerSlotFailures = failedItems.filter(item => item.reason === 'Server is at max slots for stickers');
        const emojiSlotFailures = failedItems.filter(item => item.reason === 'Server is at max slots for emotes');
        const rateLimitFailures = failedItems.filter(item => item.reason.includes('Rate limited'));
        const totalSlotFailures = stickerSlotFailures.length + emojiSlotFailures.length;

        if (totalSlotFailures === failedItems.length && failedItems.length > 0) {
          // All failures were due to full slots
          if (stickerSlotFailures.length > 0 && emojiSlotFailures.length > 0) {
            failureMessage = 'Server is at **max slots** for both stickers and emotes!';
          } else if (stickerSlotFailures.length > 0) {
            failureMessage = 'Server is at **max slots** for stickers!';
          } else if (emojiSlotFailures.length > 0) {
            failureMessage = 'Server is at **max slots** for emotes!';
          }
        } else if (rateLimitFailures.length === failedItems.length && failedItems.length > 0) {
          // All failures were due to rate limits
          if (rateLimitFailures.length === 1) {
            failureMessage = `⏰ **Rate Limited**: ${rateLimitFailures[0].reason}`;
          } else {
            failureMessage = `⏰ **Rate Limited**: All ${rateLimitFailures.length} items were rate limited. Please try again later.`;
          }
        } else {
          // Other types of failures
          failureMessage = 'Failed to steal any items. Check bot permissions and try again.';
        }

        await statusMessage.edit({
          embeds: [embeds.createDeny(message, failureMessage)]
        }).catch(() => {});
      }

    } catch (error) {
      return embeds.deny(message, 'An error occurred while trying to steal the items');
    }
  }
}



