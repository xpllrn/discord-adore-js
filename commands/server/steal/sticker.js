const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const fetch = require('node-fetch');
const Jimp = require('jimp');

// Helper function to remove invite links from text
function removeInviteLinks(text) {
  if (!text) return text;

  // Remove various invite link patterns (but not vanity tags)
  const invitePatterns = [
    /discord\.gg\/[\w-]+/gi,
    /discordapp\.com\/invite\/[\w-]+/gi,
    /discord\.com\/invite\/[\w-]+/gi,
    /dsc\.gg\/[\w-]+/gi,
    /invite\.gg\/[\w-]+/gi,
    /\bgg\/[\w-]+/gi // Remove patterns like gg/bleed (word boundary)
  ];

  let cleanText = text;
  invitePatterns.forEach(pattern => {
    cleanText = cleanText.replace(pattern, '').trim();
  });

  // Clean up extra spaces and trim
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  return cleanText || 'sticker'; // Fallback if name becomes empty
}

// Helper function to parse message links
function parseMessageLink(link) {
  const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const match = link.match(messageLinkRegex);

  if (match) {
    return {
      guildId: match[1],
      channelId: match[2],
      messageId: match[3]
    };
  }
  return null;
}

// Helper function to validate and process image
async function processImage(imageUrl, maxSize = 512) {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }

    const buffer = await response.buffer();

    // Check file size (Discord limit is 512KB for stickers)
    if (buffer.length > 512 * 1024) {
      // Process with Jimp to resize and compress
      const image = await Jimp.read(buffer);

      // Get current dimensions
      const { width, height } = image.bitmap;

      // Calculate new dimensions maintaining aspect ratio
      let newWidth, newHeight;
      if (width > height) {
        newWidth = Math.min(width, maxSize);
        newHeight = Math.round((height * newWidth) / width);
      } else {
        newHeight = Math.min(height, maxSize);
        newWidth = Math.round((width * newHeight) / height);
      }

      // Resize and compress
      image.resize(newWidth, newHeight);

      // Convert to PNG and compress
      const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

      // If still too large, reduce quality further
      if (processedBuffer.length > 512 * 1024) {
        // Further reduce size
        const smallerSize = Math.floor(maxSize * 0.8);
        if (width > height) {
          newWidth = smallerSize;
          newHeight = Math.round((height * newWidth) / width);
        } else {
          newHeight = smallerSize;
          newWidth = Math.round((width * newHeight) / height);
        }

        image.resize(newWidth, newHeight);
        return await image.getBufferAsync(Jimp.MIME_PNG);
      }

      return processedBuffer;
    }

    return buffer;
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

module.exports = {
  name: "sticker",
  description: "Manage server stickers - add, remove, and tag stickers",
  permission: "Manage Expressions",
  isGroupCommand: true,

  run: async (client, message, args) => {
    await ensureGuildData(message.guild.id);

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuildExpressions, 'Manage Expressions')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      return embeds.deny(message, 'I need **Manage Expressions** permission to use this command');
    }

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return runHelpCommand(message, 'sticker');
    }

    // Handle different subcommands
    switch (subcommand) {
      case 'add': {
        const subcommandInfo = {
          description: 'Add a sticker to the server',
          usage: '{guildprefix}sticker add [name] [image/url]',
          aliases: [],
          parameters: ['name', 'image'],
          example: '{guildprefix}sticker add cool_sticker [attach image]'
        };
        return await handleAdd(client, message, args.slice(1));
      }
      case 'remove':
      case 'delete': {
        const subcommandInfo = {
          description: 'Remove a sticker from the server',
          usage: '{guildprefix}sticker remove [message_link]',
          aliases: ['delete'],
          parameters: ['message_link'],
          example: '{guildprefix}sticker remove https://discord.com/channels/...'
        };
        return await handleRemove(client, message, args.slice(1));
      }
      case 'tag': {
        const subcommandInfo = {
          description: 'Tag all stickers with server vanity',
          usage: '{guildprefix}sticker tag',
          aliases: [],
          parameters: [],
          example: '{guildprefix}sticker tag'
        };
        return await handleTag(client, message, args.slice(1));
      }
      default:
        return runHelpCommand(message, 'sticker');
    }
  }
};

// Handle sticker add subcommand
async function handleAdd(client, message, args) {
  try {
    let imageUrl = null;
    let stickerName = null;

    // Check if there's an attachment
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();

      // Validate file type
      const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(attachment.contentType)) {
        return embeds.warn(message, 'Invalid file type. Please use PNG, JPG, JPEG, GIF, or WEBP format.');
      }

      imageUrl = attachment.url;
      stickerName = args.join(' ') || 'sticker';
    } else if (args.length >= 2) {
      // Check if first argument is a URL
      const firstArg = args[0];
      if (firstArg.startsWith('http://') || firstArg.startsWith('https://')) {
        imageUrl = firstArg;
        stickerName = args.slice(1).join(' ');
      } else {
        return embeds.warn(message, 'Please provide an image URL or attach an image file.');
      }
    } else {
      return embeds.warn(message, 'Please provide a sticker name and attach an image, or provide an image URL and name.');
    }

    // Validate sticker name
    if (!stickerName || stickerName.trim().length === 0) {
      return embeds.warn(message, 'Please provide a valid sticker name.');
    }

    // Clean the sticker name
    const cleanName = removeInviteLinks(stickerName.trim());

    if (cleanName.length < 2 || cleanName.length > 30) {
      return embeds.warn(message, 'Sticker name must be between 2 and 30 characters long.');
    }

    // Check if sticker slots are full
    if (message.guild.stickers.cache.size >= 60) {
      return embeds.warn(message, 'Server is at maximum sticker limit (60 stickers).');
    }

    // Show loading message
    const statusMessage = await embeds.loading(message, `Processing and adding sticker **${cleanName}**...`);

    try {
      // Process the image
      const processedBuffer = await processImage(imageUrl);

      // Create the sticker
      const sticker = await message.guild.stickers.create({
        file: processedBuffer,
        name: cleanName,
        description: 'Sticker added using Adore bot',
        tags: 'adore'
      });

      await statusMessage.edit({
        embeds: [embeds.createSuccess(message, `Successfully added sticker **${sticker.name}** to the server!`)]
      });

    } catch (error) {
      let errorMessage = 'Failed to add sticker. ';

      if (error.code === 50035) {
        errorMessage += 'Invalid image format or file too large.';
      } else if (error.code === 50013) {
        errorMessage += 'Insufficient permissions.';
      } else if (error.code === 30039) {
        errorMessage += 'Maximum number of stickers reached.';
      } else if (error.message.includes('Image processing failed')) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again with a different image.';
      }

      await statusMessage.edit({
        embeds: [embeds.createDeny(message, errorMessage)]
      });
    }

  } catch (error) {
    return embeds.deny(message, 'An error occurred while processing the sticker.');
  }
}

// Handle sticker remove subcommand
async function handleRemove(client, message, args) {
  try {
    if (!args[0]) {
      return embeds.warn(message, 'Please provide a message link containing the sticker to remove.');
    }

    const messageLink = args[0];
    const parsedLink = parseMessageLink(messageLink);

    if (!parsedLink) {
      return embeds.warn(message, 'Invalid message link format. Please provide a valid Discord message link.');
    }

    // Check if the message is from the same guild
    if (parsedLink.guildId !== message.guild.id) {
      return embeds.warn(message, 'The message link must be from this server.');
    }

    try {
      // Fetch the channel and message
      const channel = await client.channels.fetch(parsedLink.channelId);
      if (!channel) {
        return embeds.warn(message, 'Could not find the specified channel.');
      }

      const targetMessage = await channel.messages.fetch(parsedLink.messageId);
      if (!targetMessage) {
        return embeds.warn(message, 'Could not find the specified message.');
      }

      // Check if the message has stickers
      if (!targetMessage.stickers || targetMessage.stickers.size === 0) {
        return embeds.warn(message, 'The specified message does not contain any stickers.');
      }

      const stickersToRemove = [];
      const failedRemovals = [];

      // Process each sticker in the message
      for (const sticker of targetMessage.stickers.values()) {
        // Check if the sticker belongs to this guild
        if (sticker.guildId === message.guild.id) {
          try {
            await message.guild.stickers.delete(sticker.id);
            stickersToRemove.push(sticker.name);
          } catch (deleteError) {
            failedRemovals.push({
              name: sticker.name,
              reason: deleteError.code === 50013 ? 'Insufficient permissions' : 'Unknown error'
            });
          }
        } else {
          failedRemovals.push({
            name: sticker.name,
            reason: 'Not from this server'
          });
        }
      }

      // Create response message
      if (stickersToRemove.length > 0) {
        let successMessage = `Successfully removed **${stickersToRemove.length}** sticker${stickersToRemove.length > 1 ? 's' : ''}`;
        if (stickersToRemove.length === 1) {
          successMessage = `Successfully removed sticker **${stickersToRemove[0]}**`;
        }

        if (failedRemovals.length > 0) {
          successMessage += `\n\n**Failed to remove ${failedRemovals.length} sticker${failedRemovals.length > 1 ? 's' : ''}:**`;
          failedRemovals.forEach(failed => {
            successMessage += `\n• ${failed.name} - ${failed.reason}`;
          });
        }

        return embeds.success(message, successMessage);
      } else {
        let errorMessage = 'Failed to remove any stickers.';
        if (failedRemovals.length > 0) {
          errorMessage += '\n\n**Reasons:**';
          failedRemovals.forEach(failed => {
            errorMessage += `\n• ${failed.name} - ${failed.reason}`;
          });
        }
        return embeds.warn(message, errorMessage);
      }

    } catch (fetchError) {
      return embeds.warn(message, 'Could not access the specified message. Make sure the link is valid and I have permission to view that channel.');
    }

  } catch (error) {
    return embeds.deny(message, 'An error occurred while removing the sticker.');
  }
}

// Handle sticker tag subcommand
async function handleTag(client, message, args) {
  try {
    // Get guild vanity directly from Discord
    let vanity = null;
    try {
      const guildVanity = await message.guild.fetchVanityData();
      vanity = guildVanity.code;
    } catch (vanityError) {
      // Guild doesn't have vanity URL or bot lacks permissions
    }

    if (!vanity) {
      return embeds.warn(message, 'Your server doesn\'t have a vanity URL set. Please set one in Server Settings first.');
    }

    // Get all server stickers
    const stickers = message.guild.stickers.cache;

    if (stickers.size === 0) {
      return embeds.warn(message, 'This server has no stickers to tag.');
    }

    const statusMessage = await embeds.loading(message, `Checking and tagging **${stickers.size}** stickers...`);

    let processedCount = 0;
    let taggedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const sticker of stickers.values()) {
      try {
        processedCount++;

        // Clean the current sticker name by removing existing vanity tags
        let cleanedName = sticker.name;

        // Remove existing vanity tags (any /word pattern at the end)
        cleanedName = cleanedName.replace(/\s*\/\w+\s*$/, '').trim();

        // Remove invite links
        cleanedName = removeInviteLinks(cleanedName);

        // Check if it already has the current vanity tag
        if (sticker.name.includes(`/${vanity}`)) {
          skippedCount++;
        } else {
          // Add the server vanity tag
          const newName = `${cleanedName} /${vanity}`;

          // Ensure the new name doesn't exceed Discord's limit
          const finalName = newName.length > 30 ? newName.substring(0, 30) : newName;

          try {
            await sticker.edit({ name: finalName });
            taggedCount++;
          } catch (editError) {
            errors.push(`${sticker.name}: ${editError.message}`);
          }
        }

        // Add delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        errors.push(`${sticker.name}: ${error.message}`);
      }
    }

    // Create final response
    let resultMessage = `**Sticker Tagging Complete**\n\n`;
    resultMessage += `• **Processed:** ${processedCount} stickers\n`;
    resultMessage += `• **Tagged:** ${taggedCount} stickers\n`;
    resultMessage += `• **Skipped:** ${skippedCount} stickers (already tagged)\n`;

    if (errors.length > 0) {
      resultMessage += `• **Errors:** ${errors.length} stickers\n\n`;
      resultMessage += `**Error Details:**\n`;
      errors.slice(0, 5).forEach(error => {
        resultMessage += `• ${error}\n`;
      });
      if (errors.length > 5) {
        resultMessage += `• ... and ${errors.length - 5} more errors`;
      }
    }

    await statusMessage.edit({
      embeds: [taggedCount > 0 ? embeds.createSuccess(message, resultMessage) : embeds.createInfo(message, resultMessage)]
    });

  } catch (error) {
    return embeds.deny(message, 'An error occurred while tagging stickers.');
  }
}
