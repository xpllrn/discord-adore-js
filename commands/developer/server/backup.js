const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../../utils/permissions');
const { createConfirmation } = require('../../../core/buttons');
const { colors, emojis } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "backup",
  aliases: ['bk'],
  description: 'Backup and transfer media from categories',
  permission: 'developer',
  syntax: 'backup [subcommand] (parameters)',
  example: 'backup move 123456789 987654321',
  isGroupCommand: true,

  subcommands: {
    move: {
      name: 'move',
      aliases: ['transfer', 'mv'],
      description: 'Move all media from one category to another',
      syntax: '{guildprefix}backup move [source category id] [destination category id]',
      parameters: ['source category id', 'destination category id'],
      example: '{guildprefix}backup move 123456789012345678 987654321098765432',

      handler: async (client, message, args) => {
        return handleBackupMove(client, message, args);
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasPermissionLevel(message, 'dev')) return;

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'backup');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'backup');
  }
};

/**
 * Handle the backup move command
 * Transfers all media from source category channels to destination category
 */
async function handleBackupMove(client, message, args) {
  const sourceCategoryId = args[0];
  const destCategoryId = args[1];

  // Validate arguments
  if (!sourceCategoryId || !destCategoryId) {
    return embeds.warn(message, 
      `Please provide both **source** and **destination** category IDs\n` +
      `\`\`\`\n,backup move [source category id] [destination category id]\`\`\``
    );
  }

  // Validate IDs format
  if (!/^\d{17,19}$/.test(sourceCategoryId) || !/^\d{17,19}$/.test(destCategoryId)) {
    return embeds.warn(message, 'Please provide **valid Discord category IDs**!');
  }

  // Fetch categories
  const sourceCategory = message.guild.channels.cache.get(sourceCategoryId);
  const destCategory = message.guild.channels.cache.get(destCategoryId);

  if (!sourceCategory) {
    return embeds.warn(message, `Could not find **source category** with ID \`${sourceCategoryId}\``);
  }

  if (!destCategory) {
    return embeds.warn(message, `Could not find **destination category** with ID \`${destCategoryId}\``);
  }

  // Verify both are categories
  if (sourceCategory.type !== ChannelType.GuildCategory) {
    return embeds.warn(message, `**${sourceCategory.name}** is not a category!`);
  }

  if (destCategory.type !== ChannelType.GuildCategory) {
    return embeds.warn(message, `**${destCategory.name}** is not a category!`);
  }

  // Get all text channels in source category
  const sourceChannels = message.guild.channels.cache
    .filter(ch => ch.parentId === sourceCategoryId && ch.type === ChannelType.GuildText)
    .sort((a, b) => a.position - b.position);

  if (sourceChannels.size === 0) {
    return embeds.warn(message, `No text channels found in **${sourceCategory.name}**`);
  }

  // Build channel list for confirmation
  const channelList = sourceChannels.map((ch, idx) => 
    `\`${String(idx + 1).padStart(2, '0')}\` **#${ch.name}**`
  ).join('\n');

  const confirmEmbed = new EmbedBuilder()
    .setColor(colors.info)
    .setTitle('📦 Backup Transfer')
    .setDescription(
      `**Source Category:** ${sourceCategory.name}\n` +
      `**Destination Category:** ${destCategory.name}\n\n` +
      `**Channels to transfer (${sourceChannels.size}):**\n${channelList.slice(0, 1500)}`
    )
    .setFooter({ text: 'This will fetch all media links and transfer them to the new category' });

  await message.channel.send({ embeds: [confirmEmbed] });

  // Ask for confirmation
  await createConfirmation(
    message,
    `Are you sure you want to **transfer media** from **${sourceCategory.name}** to **${destCategory.name}**?\n\n` +
    `This will process **${sourceChannels.size}** channels.`,
    async (interaction) => {
      await interaction.deferUpdate();
      await startBackupTransfer(client, message, sourceCategory, destCategory, sourceChannels);
    }
  );
}


/**
 * Start the backup transfer process
 */
async function startBackupTransfer(client, message, sourceCategory, destCategory, sourceChannels) {
  const startTime = Date.now();
  
  // Create transfer status channel in destination category
  let transferChannel;
  try {
    transferChannel = await message.guild.channels.create({
      name: 'transfer',
      type: ChannelType.GuildText,
      parent: destCategory.id,
      topic: `Media transfer from ${sourceCategory.name} | Started: ${new Date().toISOString()}`,
      permissionOverwrites: [
        {
          id: message.guild.id,
          deny: [PermissionFlagsBits.SendMessages],
          allow: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageWebhooks]
        }
      ]
    });
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to create **transfer** channel in destination category');
  }

  // Send initial status embed
  const statusEmbed = new EmbedBuilder()
    .setColor(colors.info)
    .setTitle('📦 Media Transfer Started')
    .setDescription(
      `**Source:** ${sourceCategory.name}\n` +
      `**Destination:** ${destCategory.name}\n` +
      `**Total Channels:** ${sourceChannels.size}\n\n` +
      `${emojis.loading} **Initializing transfer...**`
    )
    .setTimestamp();

  const statusMessage = await transferChannel.send({ embeds: [statusEmbed] });

  // Statistics tracking
  const stats = {
    totalChannels: sourceChannels.size,
    processedChannels: 0,
    totalMedia: 0,
    transferredMedia: 0,
    failedMedia: 0,
    errors: []
  };

  // Process each channel
  const channelArray = Array.from(sourceChannels.values());
  
  for (let i = 0; i < channelArray.length; i++) {
    const sourceChannel = channelArray[i];
    
    try {
      // Update status
      await updateStatusEmbed(statusMessage, sourceCategory, destCategory, stats, sourceChannel, 'fetching');
      
      // Create corresponding channel in destination
      const newChannel = await message.guild.channels.create({
        name: sourceChannel.name,
        type: ChannelType.GuildText,
        parent: destCategory.id,
        topic: sourceChannel.topic || `Transferred from ${sourceCategory.name}`,
        nsfw: sourceChannel.nsfw,
        rateLimitPerUser: sourceChannel.rateLimitPerUser
      });

      // Fetch all messages with media from source channel
      const mediaMessages = await fetchAllMediaMessages(sourceChannel);
      stats.totalMedia += mediaMessages.length;

      // Send channel processing info
      const channelInfoEmbed = new EmbedBuilder()
        .setColor(colors.info)
        .setDescription(
          `**Processing:** #${sourceChannel.name}\n` +
          `**Media found:** ${mediaMessages.length} items`
        );
      await transferChannel.send({ embeds: [channelInfoEmbed] });

      // Transfer media to new channel
      if (mediaMessages.length > 0) {
        await updateStatusEmbed(statusMessage, sourceCategory, destCategory, stats, sourceChannel, 'transferring');
        
        const transferResult = await transferMediaToChannel(newChannel, mediaMessages);
        stats.transferredMedia += transferResult.success;
        stats.failedMedia += transferResult.failed;
      }

      stats.processedChannels++;
      
      // Update status after each channel
      await updateStatusEmbed(statusMessage, sourceCategory, destCategory, stats, null, 'progress');

    } catch (error) {
      logger.webhook.error(error, message);
      stats.errors.push(`#${sourceChannel.name}: ${error.message}`);
      stats.processedChannels++;
      
      const errorEmbed = new EmbedBuilder()
        .setColor(colors.error)
        .setDescription(`${emojis.error} Failed to process **#${sourceChannel.name}**: ${error.message}`);
      await transferChannel.send({ embeds: [errorEmbed] }).catch(() => {});
    }

    // Small delay to avoid rate limits
    await sleep(1000);
  }

  // Final status update
  const duration = Math.round((Date.now() - startTime) / 1000);
  const finalEmbed = new EmbedBuilder()
    .setColor(stats.failedMedia > 0 ? colors.warn : colors.success)
    .setTitle('📦 Media Transfer Complete')
    .setDescription(
      `**Source:** ${sourceCategory.name}\n` +
      `**Destination:** ${destCategory.name}\n\n` +
      `**📊 Statistics:**\n` +
      `> Channels Processed: **${stats.processedChannels}/${stats.totalChannels}**\n` +
      `> Total Media Found: **${stats.totalMedia}**\n` +
      `> Successfully Transferred: **${stats.transferredMedia}**\n` +
      `> Failed: **${stats.failedMedia}**\n` +
      `> Duration: **${formatDuration(duration)}**`
    )
    .setTimestamp();

  if (stats.errors.length > 0) {
    finalEmbed.addFields({
      name: '⚠️ Errors',
      value: stats.errors.slice(0, 5).join('\n').slice(0, 1000) + 
             (stats.errors.length > 5 ? `\n...and ${stats.errors.length - 5} more` : '')
    });
  }

  await statusMessage.edit({ embeds: [finalEmbed] });
  
  // Notify in original channel
  return embeds.success(message, 
    `Transfer complete! Check ${transferChannel} for details.\n` +
    `**${stats.transferredMedia}** media items transferred in **${formatDuration(duration)}**`
  );
}


/**
 * Update the status embed with current progress
 */
async function updateStatusEmbed(statusMessage, sourceCategory, destCategory, stats, currentChannel, phase) {
  const progressBar = createProgressBar(stats.processedChannels, stats.totalChannels);
  const percentage = Math.round((stats.processedChannels / stats.totalChannels) * 100);

  let statusText = '';
  switch (phase) {
    case 'fetching':
      statusText = `${emojis.loading} **Fetching media from #${currentChannel.name}...**`;
      break;
    case 'transferring':
      statusText = `${emojis.loading} **Transferring media from #${currentChannel.name}...**`;
      break;
    case 'progress':
      statusText = `${emojis.loading} **Processing channels...**`;
      break;
    default:
      statusText = `${emojis.loading} **Working...**`;
  }

  const embed = new EmbedBuilder()
    .setColor(colors.info)
    .setTitle('📦 Media Transfer In Progress')
    .setDescription(
      `**Source:** ${sourceCategory.name}\n` +
      `**Destination:** ${destCategory.name}\n\n` +
      `**Progress:** ${progressBar} ${percentage}%\n` +
      `**Channels:** ${stats.processedChannels}/${stats.totalChannels}\n` +
      `**Media Found:** ${stats.totalMedia}\n` +
      `**Transferred:** ${stats.transferredMedia}\n\n` +
      statusText
    )
    .setTimestamp();

  try {
    await statusMessage.edit({ embeds: [embed] });
  } catch (error) {
    // Ignore edit errors
  }
}

/**
 * Fetch all messages containing media from a channel
 */
async function fetchAllMediaMessages(channel) {
  const mediaMessages = [];
  let lastMessageId = null;
  let hasMore = true;

  // Media URL patterns
  const mediaPatterns = [
    /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv|mp3|wav|ogg)/gi,
    /https?:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/[^\s]+/gi,
    /https?:\/\/(i\.imgur\.com|imgur\.com)\/[^\s]+/gi,
    /https?:\/\/(pbs\.twimg\.com|video\.twimg\.com)\/[^\s]+/gi,
    /https?:\/\/[^\s]+\.(gifv)/gi
  ];

  while (hasMore) {
    try {
      const options = { limit: 100 };
      if (lastMessageId) {
        options.before = lastMessageId;
      }

      const messages = await channel.messages.fetch(options);
      
      if (messages.size === 0) {
        hasMore = false;
        break;
      }

      for (const msg of messages.values()) {
        const mediaUrls = [];

        // Check attachments
        if (msg.attachments.size > 0) {
          msg.attachments.forEach(attachment => {
            if (isMediaUrl(attachment.url)) {
              mediaUrls.push({
                url: attachment.url,
                type: getMediaType(attachment.url),
                filename: attachment.name
              });
            }
          });
        }

        // Check embeds
        if (msg.embeds.length > 0) {
          msg.embeds.forEach(embed => {
            if (embed.image?.url && isMediaUrl(embed.image.url)) {
              mediaUrls.push({
                url: embed.image.url,
                type: 'image',
                filename: null
              });
            }
            if (embed.video?.url && isMediaUrl(embed.video.url)) {
              mediaUrls.push({
                url: embed.video.url,
                type: 'video',
                filename: null
              });
            }
            if (embed.thumbnail?.url && isMediaUrl(embed.thumbnail.url)) {
              mediaUrls.push({
                url: embed.thumbnail.url,
                type: 'image',
                filename: null
              });
            }
          });
        }

        // Check message content for media URLs
        for (const pattern of mediaPatterns) {
          const matches = msg.content.match(pattern);
          if (matches) {
            matches.forEach(url => {
              if (!mediaUrls.some(m => m.url === url)) {
                mediaUrls.push({
                  url: url,
                  type: getMediaType(url),
                  filename: null
                });
              }
            });
          }
        }

        if (mediaUrls.length > 0) {
          mediaMessages.push({
            author: msg.author?.tag || 'Unknown',
            authorId: msg.author?.id,
            timestamp: msg.createdTimestamp,
            content: msg.content,
            media: mediaUrls
          });
        }
      }

      lastMessageId = messages.last().id;
      
      // Small delay to avoid rate limits
      await sleep(500);

    } catch (error) {
      hasMore = false;
    }
  }

  return mediaMessages;
}


/**
 * Transfer media messages to a new channel
 */
async function transferMediaToChannel(targetChannel, mediaMessages) {
  const result = { success: 0, failed: 0 };
  
  // Create webhook for sending messages (preserves author info better)
  let webhook = null;
  try {
    webhook = await targetChannel.createWebhook({
      name: 'Media Transfer',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
    });
  } catch (error) {
    // Fall back to regular messages if webhook creation fails
  }

  // Sort messages by timestamp (oldest first)
  mediaMessages.sort((a, b) => a.timestamp - b.timestamp);

  // Batch media to avoid rate limits
  const batchSize = 5;
  
  for (let i = 0; i < mediaMessages.length; i += batchSize) {
    const batch = mediaMessages.slice(i, i + batchSize);
    
    for (const mediaMsg of batch) {
      try {
        // Build message content
        const mediaUrls = mediaMsg.media.map(m => m.url).join('\n');
        const timestamp = new Date(mediaMsg.timestamp).toLocaleDateString();
        
        if (webhook) {
          // Send via webhook to preserve some author context
          await webhook.send({
            content: mediaUrls,
            username: `${mediaMsg.author} (${timestamp})`,
            allowedMentions: { parse: [] }
          });
        } else {
          // Fallback to regular message
          const embed = new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(mediaUrls)
            .setFooter({ text: `From: ${mediaMsg.author} | ${timestamp}` });
          
          await targetChannel.send({ embeds: [embed] });
        }
        
        result.success += mediaMsg.media.length;
        
      } catch (error) {
        result.failed += mediaMsg.media.length;
      }
    }
    
    // Delay between batches
    await sleep(2000);
  }

  // Clean up webhook
  if (webhook) {
    try {
      await webhook.delete();
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  return result;
}

/**
 * Check if URL is a media file
 */
function isMediaUrl(url) {
  if (!url) return false;
  const mediaExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.gifv',
    '.mp4', '.webm', '.mov', '.avi', '.mkv',
    '.mp3', '.wav', '.ogg', '.flac'
  ];
  const lowerUrl = url.toLowerCase();
  
  // Check for media extensions
  if (mediaExtensions.some(ext => lowerUrl.includes(ext))) {
    return true;
  }
  
  // Check for Discord CDN
  if (lowerUrl.includes('cdn.discordapp.com') || lowerUrl.includes('media.discordapp.net')) {
    return true;
  }
  
  // Check for common image hosts
  if (lowerUrl.includes('imgur.com') || lowerUrl.includes('i.imgur.com')) {
    return true;
  }
  
  return false;
}

/**
 * Get media type from URL
 */
function getMediaType(url) {
  if (!url) return 'unknown';
  const lowerUrl = url.toLowerCase();
  
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.gifv'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac'];
  
  if (imageExts.some(ext => lowerUrl.includes(ext))) return 'image';
  if (videoExts.some(ext => lowerUrl.includes(ext))) return 'video';
  if (audioExts.some(ext => lowerUrl.includes(ext))) return 'audio';
  
  return 'unknown';
}

/**
 * Create a visual progress bar
 */
function createProgressBar(current, total, length = 10) {
  const percentage = current / total;
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
