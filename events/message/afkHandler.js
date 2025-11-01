const { EmbedBuilder } = require('discord.js');
const { getService } = require('@services');
const { colors } = require('../../config/setup');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Skip bots and DMs
    if (message.author.bot || !message.guild) return;

    try {
      const { getService } = require('@services');
      const { isDatabaseReady } = require('../../database');
      
      // Check if database is ready (following reminder/giveaway pattern)
      const dbStatus = isDatabaseReady();
      if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) {
        return; // Don't process AFK when database isn't ready
      }

      const userService = getService('user');

      // Check if the message author is AFK and remove their status using service layer
      const authorAFK = await userService.getAFKStatus(message.author.id);

      if (authorAFK) {
        // Remove AFK status using service layer
        await userService.removeAFKStatus(message.author.id);

        // Calculate time since AFK
        const timeAgo = Date.now() - authorAFK.since.getTime();
        const timeString = formatTime(timeAgo);

        const embed = new EmbedBuilder()
          .setColor(colors.info)
          .setDescription(`👋 Welcome back **${message.author.username}**! You were AFK for **${timeString}**`);

        message.channel.send({ embeds: [embed] });
      }

      // Check if any mentioned users are AFK using service layer
      if (message.mentions.users.size > 0) {
        const afkUsers = [];

        for (const [userId, user] of message.mentions.users) {
          if (user.bot) continue;

          const afkData = await userService.getAFKStatus(userId);

          if (afkData) {
            afkUsers.push({
              user: user,
              message: afkData.message,
              since: afkData.since.getTime()
            });
          }
        }

        if (afkUsers.length > 0) {
          const afkList = afkUsers.map(afk =>
            `💤 **<@${afk.user.id}>** is AFK: **${afk.message}** - <t:${Math.floor(afk.since / 1000)}:R>`
          ).join('\n');

          const embed = new EmbedBuilder()
            .setColor(colors.embed)
            .setDescription(afkList);

          message.channel.send({ embeds: [embed] });
        }
      }

    } catch (error) {
      // Silent error handling for AFK system
    }
  },
};

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}
