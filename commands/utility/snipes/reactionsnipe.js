const { EmbedBuilder } = require("discord.js");
const config = require('../../../config/setup');
const { embeds } = require('../../../core/embeds');
const snipeCache = require('../../../database/cache/snipeCache');

module.exports = {
  name: "reactionsnipe",
  aliases: ['rs', 'reactsnipe'],
  description: `snipes removed reactions`,
  syntax: 'reactionsnipe (number)',
  example: 'reactionsnipe 2',
  run: async(_, message, args) => {

    const reactionsnipes = snipeCache.getRemovedReactions(message.channel.id);

    if (!reactionsnipes || reactionsnipes.length === 0) {
      return embeds.warn(message, `There's **nothing** to snipe in this channel`);
    }

    // Determine which reactionsnipe to show
    let targetIndex = 0;
    if (args[0]) {
      const parsed = parseInt(args[0]);
      if (isNaN(parsed) || parsed < 1 || parsed > reactionsnipes.length) {
        return embeds.warn(message, `Please provide a **valid number** between 1 and ${reactionsnipes.length}`);
      }
      targetIndex = parsed - 1;
    }

    const msg = reactionsnipes[targetIndex];
    const emoji = msg.isCustom ? `<:${msg.emoji}:${msg.emojiId}>` : msg.emoji;

    // Create custom info embed
    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setDescription(`<@${message.author.id}>: **${msg.author}** reacted with ${emoji} <t:${Math.floor(msg.timestamp / 1000)}:R>`)

    try {
      const targetMessage = await message.channel.messages.fetch(msg.messageId);
      return targetMessage.reply({ embeds: [embed] });
    } catch (error) {
      // Message was deleted or not found, send directly
      return message.channel.send({ embeds: [embed] });
    }
  }
}
