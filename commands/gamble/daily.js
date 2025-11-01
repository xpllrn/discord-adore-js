const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');
const { getGuildPrefix } = require('../../utils/commandProcessor');


// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}



function checkDailyClaim(gamblingData) {
  if (!gamblingData.dailyClaim || !gamblingData.dailyClaim.lastClaimed) {
    return { canClaim: true, streak: 0 };
  }

  const lastClaimed = new Date(gamblingData.dailyClaim.lastClaimed);
  const now = new Date();

  // Check if it's been at least 24 hours
  const timeDiff = now.getTime() - lastClaimed.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  if (hoursDiff < 24) {
    return { canClaim: false, streak: gamblingData.dailyClaim.streak || 0 };
  }

  // Check if streak should continue (claimed within 48 hours)
  const shouldContinueStreak = hoursDiff <= 48;
  const currentStreak = shouldContinueStreak ? (gamblingData.dailyClaim.streak || 0) : 0;

  return { canClaim: true, streak: currentStreak };
}

function calculateDailyReward(streak) {
  const baseReward = 500; // Starts at 500 coins
  const bonus = streak * 0.10; // +10% bonus per consecutive day
  return Math.floor(baseReward * (1 + bonus));
}

module.exports = {
  name: "daily",
  aliases: ['claim'],
  description: 'Claim your daily coins with streak bonuses',
  syntax: 'daily',
  example: 'daily',
  run: async (client, message, args) => {

    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);

      // Check if user can claim daily
      const claimCheck = checkDailyClaim(gambling);

      if (!claimCheck.canClaim) {
        // Calculate Unix timestamp for when they can claim next
        const lastClaimed = new Date(gambling.dailyClaim.lastClaimed);
        const nextClaim = new Date(lastClaimed.getTime() + 24 * 60 * 60 * 1000);
        const unixTimestamp = Math.floor(nextClaim.getTime() / 1000);

        return embeds.warn(message, `You can claim your **daily coins** <t:${unixTimestamp}:R>`);
      }

      // Calculate reward and new streak
      const newStreak = claimCheck.streak + 1;
      const reward = calculateDailyReward(newStreak);

      // Update user's wallet and daily claim using service layer
      await userService.updateWallet(message.author.id, reward);
      await userService.updateDailyClaim(message.author.id, newStreak);

      // Create success message
      let description = `${emojis.success} <@${message.author.id}>: Claimed **${formatCurrency(reward)}** coins`;

      if (newStreak > 1) {
        description += ` **${newStreak} day streak!**`;

        // Show next day's potential reward
        const nextReward = calculateDailyReward(newStreak + 1);
        description += `\nNext daily: **${formatCurrency(nextReward)}** coins`;
      } else {
        description += `\nKeep your streak for better rewards!`;
      }

      return embeds.success(message, description.replace(`${emojis.success} <@${message.author.id}>: `, ''));

    } catch (error) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Daily Command', {
          command: 'daily',
          args: '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      return embeds.deny(message, 'An error occurred while claiming your daily reward');
    }
  }
};
