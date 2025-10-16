const { EmbedBuilder } = require("discord.js");
const config = require('./../../config/setup');
const { embeds } = require('../../core/embeds');
const { createPagination } = require('../../core/buttons');
const snipeCache = require('../../database/cache/snipe');

// Helper function to get relative time
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `deleted ${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `deleted ${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `deleted ${minutes} min${minutes > 1 ? 's' : ''} ago`;
  } else {
    return `deleted ${seconds} sec${seconds > 1 ? 's' : ''} ago`;
  }
}

module.exports = {
  name: "snipe",
  aliases: ['s'],
  description: `snipes deleted messages`,
  usage: `{guildprefix}snipe [number]`,
  run: async(_, message, args) => {

    const snipes = snipeCache.getDeletedMessages(message.channel.id);

    if (!snipes || snipes.length === 0) {
      return embeds.warn(message, `there's nothing to snipe in this channel`);
    }

    if (args[0]) {
      const parsed = parseInt(args[0]);
      if (isNaN(parsed) || parsed < 1 || parsed > snipes.length) {
        return embeds.warn(message, `Please provide a valid number between 1 and ${snipes.length}`);
      }

      const msg = snipes[parsed - 1];
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setAuthor({ name: `${msg.author}`, iconURL: msg.authorAvatar })
        .setFooter({ text: `snipe ${parsed}/${snipes.length} • ${getRelativeTime(msg.timestamp)}` })

      let description = '';
      if (msg.content && msg.content.trim() && msg.content !== '*No content*') {
        description = msg.content;
      }

      // Handle attachments
      let messageOptions = { embeds: [embed] };

      if (msg.attachments && msg.attachments.length > 0) {
        // Check if any attachment is an image
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const imageAttachments = msg.attachments.filter(url =>
          imageExtensions.some(ext => url.toLowerCase().includes(ext))
        );

        if (imageAttachments.length === 1 && msg.attachments.length === 1) {
          // Single image - show directly in embed
          embed.setImage(imageAttachments[0]);
          if (!description) {
            description = '*Image*';
          }
        } else if (msg.attachments.length > 1) {
          // Multiple attachments - send as attachments
          try {
            const attachmentFiles = msg.attachments.map((url, index) => ({
              attachment: url,
              name: `attachment_${index + 1}.${url.split('.').pop()}`
            }));
            messageOptions.files = attachmentFiles;

            if (!description) {
              description = `*${msg.attachments.length} attachments*`;
            }
          } catch (error) {
            // Fallback to links if attachment sending fails
            if (description) description += '\n\n';
            description += `📎 **Attachments (${msg.attachments.length} files):**\n`;
            description += msg.attachments.slice(0, 5).map((url, index) => `[File ${index + 1}](${url})`).join(' • ');
            if (msg.attachments.length > 5) {
              description += ` • +${msg.attachments.length - 5} more`;
            }
          }
        } else {
          // Single non-image attachment
          if (description) description += '\n\n';
          description += `📎 **Attachment:** [View File](${msg.attachments[0]})`;
        }
      }

      if (description) {
        embed.setDescription(description);
      } else {
        // Only show "No content" if there are truly no attachments
        if (!msg.attachments || msg.attachments.length === 0) {
          embed.setDescription('*No content*');
        }
      }

      return message.channel.send(messageOptions);
    }

    const formatPage = (_, currentPage, totalPages) => {
      const msg = snipes[currentPage - 1];
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setAuthor({ name: `${msg.author}`, iconURL: msg.authorAvatar })
        .setFooter({ text: `snipe ${currentPage}/${totalPages} • ${getRelativeTime(msg.timestamp)}` })

      let description = '';
      if (msg.content && msg.content.trim() && msg.content !== '*No content*') {
        description = msg.content;
      }

      // Handle attachments for pagination
      if (msg.attachments && msg.attachments.length > 0) {
        // Check if any attachment is an image
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const imageAttachments = msg.attachments.filter(url =>
          imageExtensions.some(ext => url.toLowerCase().includes(ext))
        );

        if (imageAttachments.length === 1 && msg.attachments.length === 1) {
          // Single image - show directly in embed
          embed.setImage(imageAttachments[0]);
          if (!description) {
            description = '*Image*';
          }
        } else {
          // Multiple attachments or non-image - show as links
          if (description) description += '\n\n';
          if (msg.attachments.length === 1) {
            description += `📎 **Attachment:** [View File](${msg.attachments[0]})`;
          } else {
            description += `📎 **Attachments (${msg.attachments.length} files):**\n`;
            description += msg.attachments.slice(0, 5).map((url, index) => `[File ${index + 1}](${url})`).join(' • ');
            if (msg.attachments.length > 5) {
              description += ` • +${msg.attachments.length - 5} more`;
            }
          }
        }
      }

      if (description) {
        embed.setDescription(description);
      } else {
        // Only show "No content" if there are truly no attachments
        if (!msg.attachments || msg.attachments.length === 0) {
          embed.setDescription('*No content*');
        }
      }

      return embed;
    };

    await createPagination(message, snipes, formatPage, 1, 'Deleted Messages');
  }
}