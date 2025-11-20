const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../../../config/setup');
const logger = require('../../../../utils/logger');

module.exports = {
  name: "curse",
  aliases: [],
  description: 'Curse yourself or someone else to lose luck points',
  syntax: 'curse [user]',
  example: 'curse @user',
  run: async (client, message, args) => {
    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);

      // Check curse cooldown (1 hour = 3600000 ms)
      const curseCooldown = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
      const lastCursed = gambling.lastCursed || null;
      const now = Date.now();

      if (lastCursed && (now - lastCursed) < curseCooldown) {
        const timeLeft = curseCooldown - (now - lastCursed);
        const unixTimestamp = Math.floor((now + timeLeft) / 1000);

        return embeds.warn(message, `You can **curse** again <t:${unixTimestamp}:R>`);
      }

      // Determine target user
      let targetUser = message.author;
      let targetMember = message.member;
      let isTargetingSelf = true;

      if (message.mentions.users.first()) {
        targetUser = message.mentions.users.first();
        targetMember = message.guild.members.cache.get(targetUser.id);
        isTargetingSelf = false;
      }

      // Generate random luck loss (1-10 points)
      const luckLoss = Math.floor(Math.random() * 10) + 1; // 1-10 points

      // Update luck in database (subtract points)
      const newLuck = await userService.updateLuck(targetUser.id, -luckLoss);

      // Update curse timestamp
      await userService.updateCurseTimestamp(message.author.id);

      // Get display names
      const targetName = targetMember ? targetMember.displayName : targetUser.username;

      let resultMessage;

      if (isTargetingSelf) {
        resultMessage = `💀 <@${message.author.id}>: You cursed yourself! You lost **${luckLoss} luck** points! Current luck: **${newLuck}**`;
      } else {
        resultMessage = `💀 <@${message.author.id}>: You cursed **${targetName}**! They lost **${luckLoss} luck** points! Their luck is now: **${newLuck}**`;
      }

      return embeds.success(message, resultMessage.replace(`💀 <@${message.author.id}>: `, ''));
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while cursing');
    }
  }
};