const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const guildCache = require('../../database/cache/models/guild');
const { colors } = require('../../config/setup');

module.exports = {
  name: "afk",
  description: `Set an AFK status for when you are mentioned`,
  usage: `{guildprefix}afk [reason]`,
  run: async(client, message, args) => {

    const content = args.join(" ") || "AFK";

    try {
      // Check if user is already AFK using cache system
      const existingAFK = await guildCache.getAFKStatus(message.guild.id, message.author.id);

      if (existingAFK) {
        // User is already AFK, remove AFK status
        await guildCache.removeAFKStatus(message.guild.id, message.author.id);

        return embeds.success(message, 'Your **AFK** status has been removed');
      } else {
        // Set user as AFK using cache system
        await guildCache.setAFKStatus(message.guild.id, message.author.id, content);

        const embed = new EmbedBuilder()
          .setColor(colors.success)
          .setDescription(`<@${message.author.id}>: You're now **AFK** with the status: **${content}**`);

        return message.channel.send({ embeds: [embed] });
      }

    } catch (error) {
      return embeds.warn(message, 'An error occurred while setting your AFK status.');
    }
  }
}
