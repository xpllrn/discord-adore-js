const { PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { colors, emojis } = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const logger = require('../../../utils/logger');

// Helper function to remove invite links from text
function removeInviteLinks(text) {
  if (!text) return text;

  const invitePatterns = [
    /discord\.gg\/[\w-]+/gi,
    /discordapp\.com\/invite\/[\w-]+/gi,
    /discord\.com\/invite\/[\w-]+/gi,
    /dsc\.gg\/[\w-]+/gi,
    /invite\.gg\/[\w-]+/gi,
    /\bgg\/[\w-]+/gi
  ];

  let cleanText = text;
  invitePatterns.forEach(pattern => {
    cleanText = cleanText.replace(pattern, '').trim();
  });

  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  return cleanText || 'sticker';
}

module.exports = {
  name: "sticker",
  aliases: [],
  description: "Manage server stickers - add, steal, remove, and archive",
  syntax: 'sticker [subcommand]',
  example: 'sticker add <url> <name>',
  permission: 'manage_expressions',
  isGroupCommand: true,
  run: async (client, message, args) => {
    try {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuildExpressions, 'Manage Emojis and Stickers')) return;

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return runHelpCommand(message, 'sticker');
    }

    switch (subcommand) {
      case 'add':
        return await handleAdd(client, message, args.slice(1));
      case 'steal':
        return await handleSteal(client, message, args.slice(1));
      case 'remove':
      case 'delete':
        return await handleRemove(client, message, args.slice(1));
      case 'archive':
        return await handleArchive(client, message, args.slice(1));
      default:
        return runHelpCommand(message, 'sticker');
    }
    } catch (error) {
      throw error;
    }
  }
};


// Handle sticker add subcommand
async function handleAdd(client, message, args) {
  let stickerUrl;
  let stickerName;

  // Check for attachment first
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    
    // Validate attachment is an image
    if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
      return embeds.warn(message, 'Please attach a valid image file (png, jpg, jpeg, gif, or webp)');
    }

    stickerUrl = attachment.url;
    stickerName = args.join(' ') || attachment.name.split('.')[0];
  } else {
    // No attachment, check for URL in args
    if (args.length < 2) {
      return embeds.warn(message, 'Please provide a sticker URL and name, or attach an image\n**Usage:** `sticker add <url> <name>` or `sticker add <name>` (with attachment)');
    }

    stickerUrl = args[0];
    stickerName = args.slice(1).join(' ');

    // Validate URL
    if (!stickerUrl.match(/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)$/i)) {
      return embeds.warn(message, 'Please provide a valid image URL (png, jpg, jpeg, gif, or webp)');
    }
  }

  // Validate name length (2-30 characters)
  if (stickerName.length < 2 || stickerName.length > 30) {
    return embeds.warn(message, 'Sticker name must be between 2 and 30 characters');
  }

  try {
    // Check if server is at max stickers
    if (message.guild.stickers.cache.size >= 60) {
      return embeds.warn(message, 'Server is at **max slots** for stickers (60/60)');
    }

    const statusMessage = await embeds.loading(message, `Please wait, I'm adding sticker **\`${stickerName}\`** to the server`);

    const cleanName = removeInviteLinks(stickerName);
    const description = 'Sticker added using adore bot';

    const createdSticker = await message.guild.stickers.create({
      file: stickerUrl,
      name: cleanName,
      description: description,
      tags: 'custom'
    });

    await statusMessage.edit({
      embeds: [embeds.createSuccess(message, `Added sticker **\`${createdSticker.name}\`** to the server`)]
    });

  } catch (error) {
    if (error.code === 50013) {
      return embeds.deny(message, 'I don\'t have permission to manage stickers in this server');
    } else if (error.code === 30039) {
      return embeds.warn(message, 'Server is at **max slots** for stickers (60/60)');
    } else if (error.message.includes('File cannot be larger than')) {
      return embeds.warn(message, 'The sticker file is too large. Maximum size is 512KB');
    } else {
      throw error;
    }
  }
}

// Handle sticker steal subcommand
async function handleSteal(client, message, args) {
  // Check if this is a reply to another message
  if (!message.reference || !message.reference.messageId) {
    return embeds.warn(message, 'Please reply to a message containing stickers to steal them');
  }

  try {
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
    
    if (!referencedMessage) {
      return embeds.warn(message, 'Could not find the referenced message');
    }

    // Check for stickers
    if (!referencedMessage.stickers || referencedMessage.stickers.size === 0) {
      return embeds.warn(message, 'No stickers found in the referenced message');
    }

    const stickersToSteal = [];
    const failedStickers = [];

    for (const sticker of referencedMessage.stickers.values()) {
      stickersToSteal.push({
        name: sticker.name,
        url: sticker.url,
        id: sticker.id
      });
    }

    const statusMessage = await embeds.loading(message, `Please wait, I'm stealing **${stickersToSteal.length} sticker${stickersToSteal.length === 1 ? '' : 's'}** for you`);

    let successCount = 0;
    let stolenStickers = [];
    let stickerSlotsFull = false;

    for (const sticker of stickersToSteal) {
      try {
        if (message.guild.stickers.cache.size >= 60) {
          stickerSlotsFull = true;
          failedStickers.push({
            name: sticker.name,
            reason: 'Server is at max slots for stickers'
          });
          continue;
        }

        const cleanName = removeInviteLinks(sticker.name);
        const description = 'Sticker added using adore bot';

        const createdSticker = await message.guild.stickers.create({
          file: sticker.url,
          name: cleanName,
          description: description,
          tags: 'stolen'
        });
        
        successCount++;
        stolenStickers.push(createdSticker.name);

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        if (error.code === 50013) {
          failedStickers.push({
            name: sticker.name,
            reason: 'Insufficient permissions'
          });
        } else if (error.code === 30039) {
          // Maximum number of stickers reached
          stickerSlotsFull = true;
          failedStickers.push({
            name: sticker.name,
            reason: 'Server is at **max slots** for stickers'
          });
        } else {
          failedStickers.push({
            name: sticker.name,
            reason: error.message
          });
        }
      }
    }

    if (successCount > 0) {
      const message_text = stolenStickers.length === 1 ?
        `Added sticker **\`${stolenStickers[0]}\`** to the server` :
        `Added **${stolenStickers.length}** new stickers to the server`;

      await statusMessage.edit({
        embeds: [embeds.createSuccess(message, message_text)]
      });

      if (stickerSlotsFull) {
        await embeds.warn(message, 'Server is at **max slots** for stickers!');
      }
    } else {
      await statusMessage.edit({
        embeds: [embeds.createDeny(message, 'Failed to steal any stickers! Check bot permissions and try again.')]
      });
    }

  } catch (error) {
    throw error;
  }
}

// Handle sticker remove subcommand
async function handleRemove(client, message, args) {
  // Check if this is a reply to another message
  if (!message.reference || !message.reference.messageId) {
    return embeds.warn(message, 'Please reply to a message containing stickers to remove them');
  }

  try {
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
    
    if (!referencedMessage) {
      return embeds.warn(message, 'Could not find the referenced message');
    }

    // Check for stickers
    if (!referencedMessage.stickers || referencedMessage.stickers.size === 0) {
      return embeds.warn(message, 'The specified message does not contain any stickers');
    }

    const stickersToRemove = [];
    const failedRemovals = [];

    for (const sticker of referencedMessage.stickers.values()) {
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

    if (stickersToRemove.length > 0) {
      let successMessage = `Successfully removed **${stickersToRemove.length}** sticker${stickersToRemove.length > 1 ? 's' : ''}`;
      if (stickersToRemove.length === 1) {
        successMessage = `Successfully removed sticker **\`${stickersToRemove[0]}\`**`;
      }

      if (failedRemovals.length > 0) {
        successMessage += `\n\n**Failed to remove ${failedRemovals.length} sticker${failedRemovals.length > 1 ? 's' : ''}:**`;
        failedRemovals.forEach(failed => {
          successMessage += `\n• **\`${failed.name}\`** - ${failed.reason}`;
        });
      }

      return embeds.success(message, successMessage);
    } else {
      let errorMessage = 'Failed to remove any stickers!';
      if (failedRemovals.length > 0) {
        errorMessage += '\n\n**Reasons:**';
        failedRemovals.forEach(failed => {
          errorMessage += `\n• **\`${failed.name}\`** - ${failed.reason}`;
        });
      }
      return embeds.warn(message, errorMessage);
    }

  } catch (error) {
    throw error;
  }
}

// Handle sticker archive subcommand
async function handleArchive(client, message, args) {
  const guildStickers = message.guild.stickers.cache;

  if (guildStickers.size === 0) {
    return embeds.warn(message, 'This server has no custom stickers to archive.');
  }

  const loadingMessage = await embeds.loading(message, `Please wait, I'm archiving **${guildStickers.size} sticker${guildStickers.size === 1 ? '' : 's'}** for you`);

  try {
    const tempDir = path.join(__dirname, '../../temp', `stickers_${message.guild.id}_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let downloaded = 0;
    let failed = 0;

    for (const [, sticker] of guildStickers) {
      try {
        const extension = 'png'; // Stickers are typically PNG
        const fileName = `${sticker.name}.${extension}`;
        const filePath = path.join(tempDir, fileName);
        const stickerUrl = sticker.url;

        await downloadFile(stickerUrl, filePath);
        downloaded++;
      } catch (error) {
        logger.webhook.error(error, message);
        failed++;
      }
    }

    if (downloaded === 0) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return embeds.deny(message, 'Failed to download any stickers. Please try again.');
    }

    const zipPath = path.join(__dirname, '../../temp', `${message.guild.name.replace(/[^a-z0-9]/gi, '_')}_stickers.zip`);
    await createZipArchive(tempDir, zipPath);

    const stats = fs.statSync(zipPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 25) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
      return embeds.deny(message, `The sticker archive is too large (${fileSizeMB.toFixed(2)}MB). Discord's file limit is 25MB.`);
    }

    const attachment = new AttachmentBuilder(zipPath, {
      name: `${message.guild.name.replace(/[^a-z0-9]/gi, '_')}_stickers.zip`
    });

    await message.channel.send({
      files: [attachment]
    });

    const successEmbed = new EmbedBuilder()
      .setColor(colors.success)
      .setDescription(`${emojis.success} <@${message.author.id}>: Successfully archived all **${downloaded}** sticker${downloaded === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''} and sent`);
    
    await loadingMessage.edit({ embeds: [successEmbed] });

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, `An error occurred while archiving stickers: ${error.message}`);
  }
}

/**
 * Download a file from URL
 * @param {string} url - File URL
 * @param {string} filePath - Destination file path
 * @returns {Promise<void>}
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => { });
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Create a zip archive from a directory
 * @param {string} sourceDir - Source directory
 * @param {string} outputPath - Output zip file path
 * @returns {Promise<void>}
 */
function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
