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
  return cleanText || 'emoji';
}

module.exports = {
  name: "emoji",
  aliases: ['emote'],
  description: "Manage server emojis",
  syntax: 'emoji [subcommand]',
  example: 'emoji steal (reply to message)',
  permission: 'manage_expressions',
  isGroupCommand: true,
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuildExpressions, 'Manage Emojis and Stickers')) return;

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return runHelpCommand(message, 'emoji');
    }

    switch (subcommand) {
      case 'steal':
      case 'add':
        return await handleSteal(client, message, args.slice(1));
      case 'remove':
      case 'delete':
        return await handleRemove(client, message, args.slice(1));
      case 'list':
        return await handleList(client, message, args.slice(1));
      case 'archive':
        return await handleArchive(client, message, args.slice(1));
      default:
        return runHelpCommand(message, 'emoji');
    }
  }
};

// Handle emoji steal/add subcommand
async function handleSteal(client, message, args) {
  // Check if this is a reply to another message
  if (!message.reference || !message.reference.messageId) {
    return embeds.warn(message, 'Please reply to a message containing emojis to steal them');
  }

  try {
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
    
    if (!referencedMessage) {
      return embeds.warn(message, 'Could not find the referenced message');
    }

    const emojisToSteal = [];
    const failedEmojis = [];
    const emojiRegex = /<a?:(\w+):(\d+)>/g;
    const foundEmojis = new Set();
    
    // Extract emojis from message content
    const emojiMatches = referencedMessage.content.match(emojiRegex);
    
    if (emojiMatches) {
      for (const emojiMatch of emojiMatches) {
        const [, name, id] = emojiMatch.match(/<a?:(\w+):(\d+)>/);
        
        if (foundEmojis.has(id)) continue;
        foundEmojis.add(id);
        
        const isAnimated = emojiMatch.startsWith('<a:');
        
        const existingEmoji = message.guild.emojis.cache.get(id);
        if (existingEmoji) {
          failedEmojis.push({
            name: name,
            reason: 'Already exists in this server'
          });
          continue;
        }

        emojisToSteal.push({
          name: name,
          id: id,
          animated: isAnimated
        });
      }
    }

    // Check for emojis in embeds
    if (referencedMessage.embeds && referencedMessage.embeds.length > 0) {
      for (const embed of referencedMessage.embeds) {
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
        
        for (const text of embedTexts) {
          const embedEmojiMatches = text.match(emojiRegex);
          
          if (embedEmojiMatches) {
            for (const emojiMatch of embedEmojiMatches) {
              const [, name, id] = emojiMatch.match(/<a?:(\w+):(\d+)>/);
              
              if (foundEmojis.has(id)) continue;
              foundEmojis.add(id);
              
              const isAnimated = emojiMatch.startsWith('<a:');
              
              const existingEmoji = message.guild.emojis.cache.get(id);
              if (existingEmoji) {
                failedEmojis.push({
                  name: name,
                  reason: 'Already exists in this server'
                });
                continue;
              }

              emojisToSteal.push({
                name: name,
                id: id,
                animated: isAnimated
              });
            }
          }
        }
      }
    }

    if (emojisToSteal.length === 0) {
      return embeds.warn(message, 'No emojis found in the referenced message');
    }

    const statusMessage = await embeds.loading(message, `Please wait, I'm stealing **${emojisToSteal.length} emoji${emojisToSteal.length === 1 ? '' : 's'}** for you`);

    let successCount = 0;
    let stolenEmojis = [];
    let emojiSlotsFull = false;

    for (const emoji of emojisToSteal) {
      try {
        if (message.guild.emojis.cache.size >= 500) {
          emojiSlotsFull = true;
          failedEmojis.push({
            name: emoji.name,
            reason: 'Server is at max slots for emojis'
          });
          continue;
        }

        const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`;
        const cleanName = removeInviteLinks(emoji.name);
        
        const createdEmoji = await message.guild.emojis.create({
          attachment: emojiUrl,
          name: cleanName
        });
        
        successCount++;
        stolenEmojis.push(createdEmoji);

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        if (error.code === 50013) {
          failedEmojis.push({
            name: emoji.name,
            reason: 'Insufficient permissions'
          });
        } else if (error.code === 30008) {
          // Maximum number of emojis reached
          emojiSlotsFull = true;
          failedEmojis.push({
            name: emoji.name,
            reason: 'Server is at **max slots** for emojis'
          });
        } else {
          failedEmojis.push({
            name: emoji.name,
            reason: error.message
          });
        }
      }
    }

    if (successCount > 0) {
      const message_text = stolenEmojis.length === 1 ?
        `Added emoji **\`${stolenEmojis[0].name}\`** to the server` :
        `Added **${stolenEmojis.length}** new emojis to the server`;

      await statusMessage.edit({
        embeds: [embeds.createSuccess(message, message_text)]
      });

      if (emojiSlotsFull) {
        await embeds.warn(message, 'Server is at **max slots** for emojis!');
      }
    } else {
      await statusMessage.edit({
        embeds: [embeds.createDeny(message, 'Failed to steal any emojis! Check bot permissions and try again.')]
      });
    }

  } catch (error) {
    throw error;
  }
}

// Handle emoji remove subcommand
async function handleRemove(client, message, args) {
  const guildEmojis = message.guild.emojis.cache;

  if (guildEmojis.size === 0) {
    return embeds.warn(message, 'This server has no custom emojis.');
  }

  const emojiArray = Array.from(guildEmojis.values());

  const formatPage = (pageEmojis, currentPage, totalPages) => {
    const startIndex = (currentPage - 1) * 10;

    const emojiList = pageEmojis.map((emoji, index) => {
      const number = (startIndex + index + 1).toString().padStart(2, '0');
      return `\`${number}\` ${emoji} **\`${emoji.name}\`** - ID: \`${emoji.id}\``;
    }).join('\n');

    return new EmbedBuilder()
      .setColor(colors.info)
      .setTitle(`${message.guild.name} Emojis - Select to Remove`)
      .setDescription(emojiList + '\n\n**To remove an emoji, use:** \`,emoji remove <emoji>\` or react with the emoji')
      .setFooter({ text: `${guildEmojis.size} emoji${guildEmojis.size === 1 ? '' : 's'} || page ${currentPage}/${totalPages}` });
  };

  const { createPagination } = require('../../../core/buttons');
  return await createPagination(message, emojiArray, formatPage, 10, `${message.guild.name} Emojis`);
}

// Handle emoji list subcommand
async function handleList(client, message, args) {
  const guildEmojis = message.guild.emojis.cache;

  if (guildEmojis.size === 0) {
    return embeds.warn(message, 'This server has no custom emojis.');
  }

  const emojiArray = Array.from(guildEmojis.values());

  const formatPage = (pageEmojis, currentPage, totalPages) => {
    const startIndex = (currentPage - 1) * 10;

    const emojiList = pageEmojis.map((emoji, index) => {
      const number = (startIndex + index + 1).toString().padStart(2, '0');
      const emojiUrl = emoji.imageURL();
      return `\`${number}\` ${emoji} **[\`${emoji.name}\`](${emojiUrl})**`;
    }).join('\n');

    return new EmbedBuilder()
      .setColor(colors.info)
      .setTitle(`${message.guild.name} Emojis`)
      .setDescription(emojiList)
      .setFooter({ text: `${guildEmojis.size} emoji${guildEmojis.size === 1 ? '' : 's'} || page ${currentPage}/${totalPages}` });
  };

  const { createPagination } = require('../../../core/buttons');
  return await createPagination(message, emojiArray, formatPage, 10, `${message.guild.name} Emojis`);
}

// Handle emoji archive subcommand
async function handleArchive(client, message, args) {
  const guildEmojis = message.guild.emojis.cache;

  if (guildEmojis.size === 0) {
    return embeds.warn(message, 'This server has no custom emojis to archive.');
  }

  const loadingMessage = await embeds.loading(message, `Please wait, I'm archiving **${guildEmojis.size} emoji${guildEmojis.size === 1 ? '' : 's'}** for you`);

  try {
    const tempDir = path.join(__dirname, '../../temp', `emojis_${message.guild.id}_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let downloaded = 0;
    let failed = 0;

    for (const [, emoji] of guildEmojis) {
      try {
        const extension = emoji.animated ? 'gif' : 'png';
        const fileName = `${emoji.name}.${extension}`;
        const filePath = path.join(tempDir, fileName);
        const emojiUrl = emoji.imageURL();

        await downloadFile(emojiUrl, filePath);
        downloaded++;
      } catch (error) {
        logger.webhook.error(error, message);
        failed++;
      }
    }

    if (downloaded === 0) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return embeds.deny(message, 'Failed to download any emojis. Please try again.');
    }

    const zipPath = path.join(__dirname, '../../temp', `${message.guild.name.replace(/[^a-z0-9]/gi, '_')}_emojis.zip`);
    await createZipArchive(tempDir, zipPath);

    const stats = fs.statSync(zipPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 25) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
      return embeds.deny(message, `The emoji archive is too large (${fileSizeMB.toFixed(2)}MB). Discord's file limit is 25MB.`);
    }

    const attachment = new AttachmentBuilder(zipPath, {
      name: `${message.guild.name.replace(/[^a-z0-9]/gi, '_')}_emojis.zip`
    });

    await message.channel.send({
      files: [attachment]
    });

    const successEmbed = new EmbedBuilder()
      .setColor(colors.success)
      .setDescription(`${emojis.success} <@${message.author.id}>: Successfully archived all **${downloaded}** emoji${downloaded === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''} and sent`);
    
    await loadingMessage.edit({ embeds: [successEmbed] });

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, `An error occurred while archiving emojis: ${error.message}`);
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
