const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const { colors } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "afk",
  description: `Set an AFK status for when you are mentioned`,
  syntax: 'afk (reason)',
  example: 'afk sleeping',
  run: async (client, message, args) => {
    const userService = getService('user');
    const content = args.join(" ") || "AFK";

    try {
      // Check if user is already AFK using service layer
      const existingAFK = await userService.getAFKStatus(message.author.id);

      if (existingAFK) {
        // User is already AFK, remove AFK status
        await userService.removeAFKStatus(message.author.id);

        return embeds.success(message, 'Your **AFK** status has been removed');
      } else {
        // Set user as AFK using service layer
        await userService.setAFKStatus(message.author.id, content);

        const embed = new EmbedBuilder()
          .setColor(colors.success)
          .setDescription(`<@${message.author.id}>: You're now **AFK** with the status: **${content}**`);

        return message.channel.send({ embeds: [embed] });
      }

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while setting your AFK status');
    }
  }
}
