const { EmbedBuilder } = require("discord.js");
const config = require('../../../config/setup');
const { embeds } = require('../../../core/embeds');
const snipeCache = require('../../../database/cache/snipeCache');
const logger = require('../../../utils/logger');

// Helper function to get relative time
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `edited ${days} day${days > 1 ? 's' : ''} before`;
  } else if (hours > 0) {
    return `edited ${hours} hour${hours > 1 ? 's' : ''} before`;
  } else if (minutes > 0) {
    return `edited ${minutes} min${minutes > 1 ? 's' : ''} before`;
  } else {
    return `edited ${seconds} sec${seconds > 1 ? 's' : ''} before`;
  }
}

module.exports = {
  name: "editsnipe",
  aliases: ['es'],
  description: `snipes edited messages`,
  syntax: 'editsnipe (number)',
  example: 'editsnipe 2',
  run: async (_, message, args) => {
    try {

    const editsnipes = snipeCache.getEditedMessages(message.channel.id);

    if (!editsnipes || editsnipes.length === 0) {
      return embeds.warn(message, `There's **nothing** to snipe in this channel`);
    }

    // Determine which editsnipe to show and prepare data
    let msg, footerText;

    if (args[0]) {
      const parsed = parseInt(args[0]);
      if (isNaN(parsed) || parsed < 1 || parsed > editsnipes.length) {
        return embeds.warn(message, `Please provide a **valid number** between 1 and ${editsnipes.length}`);
      }

      msg = editsnipes[parsed - 1];

      footerText = `Editsnipe ${parsed}/${editsnipes.length}`;
    } else {
      msg = editsnipes[0];
      footerText = editsnipes.length > 1 ? `Editsnipe 1/${editsnipes.length}` : 'Editsnipe';
    }

    const relativeTime = getRelativeTime(msg.timestamp);

    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setAuthor({
        name: msg.author,
        iconURL: msg.authorAvatar
      })
      .setDescription(`**Before:**\n${msg.oldContent || '*No content*'}\n\n**After:**\n${msg.newContent || '*No content*'}`)
      .setFooter({ text: footerText })
      .setTimestamp(msg.timestamp);

    return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching editsnipe');
    }
  }
}
      footerText = `${parsed}/${editsnipes.length} edits`;
    } else {
      // For no arguments, show the first editsnipe with text content
      const textEditSnipes = editsnipes.filter(msg => msg.oldContent && msg.oldContent.trim());

      if (textEditSnipes.length === 0) {
        return;
      }

      msg = textEditSnipes[0];
      footerText = `1/${textEditSnipes.length} edits`;
    }

    // Skip if the old content was only an image (no text)
    if (!msg.oldContent || !msg.oldContent.trim()) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setAuthor({ name: `${msg.author}`, iconURL: msg.authorAvatar })
      .setDescription(msg.oldContent)
      .setFooter({ text: `${footerText} • ${getRelativeTime(msg.timestamp)}` })


    try {
      const targetMessage = await message.channel.messages.fetch(msg.messageId);
      return targetMessage.reply({ embeds: [embed] });
    } catch (error) {
      // Message was deleted or not found, send directly
      return message.channel.send({ embeds: [embed] });
    }
  }
}