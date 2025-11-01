const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../../handlers/finder');
const { emojis } = require('../../config/setup');
const { getGuildPrefix } = require('../../utils/commandProcessor');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}



function checkRobCooldown(gamblingData) {
  if (!gamblingData.robCooldown) {
    return { canRob: true };
  }

  const lastRob = new Date(gamblingData.robCooldown);
  const now = new Date();
  const cooldownTime = 60 * 60 * 1000; // 1 hour in milliseconds

  if ((now.getTime() - lastRob.getTime()) >= cooldownTime) {
    return { canRob: true };
  }

  return { canRob: false };
}

function calculateRobResult(targetWallet) {
  const success = Math.random() < 0.40; // 40% success rate

  if (success) {
    // Steal 5-30% of target's wallet
    const percentage = Math.random() * 0.25 + 0.05; // 5-30%
    let amount = Math.floor(targetWallet * percentage);

    // Min 100, max 10,000
    amount = Math.max(100, Math.min(amount, 10000));

    return { success: true, amount };
  }

  return { success: false, amount: 0 };
}

module.exports = {
  name: "rob",
  aliases: ['steal'],
  description: 'Attempt to rob money from another user',
  syntax: 'rob (user)',
  example: 'rob @vwsn',
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must specify a user to rob!');
    }
    
    try {
      const userService = getService('user');

      // Find target user
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }

      // Handle both guild members and global users
      const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;

      // Can't rob yourself
      if (targetUser.id === message.author.id) {
        return embeds.deny(message, 'You can\'t rob yourself');
      }

      // Can't rob the bot (specific check first)
      if (targetUser.id === message.guild.members.me.id) {
        return message.channel.send('Leave me alone!');
      }

      // Can't rob other bots
      if (targetUser.bot) {
        return embeds.deny(message, 'You can\'t rob bots');
      }
      
      // Get robber's gambling data (creates account if doesn't exist)
      const robberGambling = await userService.getGamblingData(message.author.id);
      
      // Check rob cooldown
      const cooldownCheck = checkRobCooldown(robberGambling);
      
      if (!cooldownCheck.canRob) {
        // Calculate Unix timestamp for when they can rob next
        const lastRob = new Date(robberGambling.robCooldown);
        const nextRob = new Date(lastRob.getTime() + 60 * 60 * 1000); // 1 hour later
        const unixTimestamp = Math.floor(nextRob.getTime() / 1000);

        return embeds.warn(message, `You can rob again <t:${unixTimestamp}:R>`);
      }
      
      // Get target's gambling data (creates account if doesn't exist)
      const targetGambling = await userService.getGamblingData(targetUser.id);

      const targetWallet = targetGambling.wallet || 0;

      // Target must have at least 500 coins to be robbed
      if (targetWallet < 500) {
        return embeds.deny(message, `**${targetUser.displayName || targetUser.username || 'User'}** is too **poor** to rob`);
      }
      
      // Update rob cooldown using service layer
      await userService.setUserField(message.author.id, 'Gambling.robCooldown', new Date());
      
      // Calculate rob result
      const result = calculateRobResult(targetWallet);
      
      let description;
      let color;
      
      if (result.success) {
        // Transfer money using service layer
        await userService.updateWallet(message.author.id, result.amount);
        await userService.updateWallet(targetUser.id, -result.amount);

        description = `${emojis.success} <@${message.author.id}>: Successfully robbed **${formatCurrency(result.amount)}** coins from **${targetUser.displayName || targetUser.username || 'User'}**`;
        color = '#a4ec7c';
      } else {
        // Rob failed - robber loses 5-30% of their wallet
        const robberWallet = robberGambling.wallet || 0;
        const penaltyPercentage = Math.random() * 0.25 + 0.05; // 5-30%
        const penalty = Math.floor(robberWallet * penaltyPercentage);

        if (robberWallet >= penalty && penalty > 0) {
          await userService.updateWallet(message.author.id, -penalty);

          // 50% of penalty goes to target, 50% goes to "police" (removed from system)
          const targetShare = Math.floor(penalty * 0.5);
          if (targetShare > 0) {
            await userService.updateWallet(targetUser.id, targetShare);
          }

          description = `${emojis.error} <@${message.author.id}>: Failed to rob **${targetUser.displayName || targetUser.username || 'User'}** and lost **${formatCurrency(penalty)}** coins as **penalty**`;
        } else {
          description = `${emojis.error} <@${message.author.id}>: Failed to rob **${targetUser.displayName || targetUser.username || 'User'}** and was too poor to pay the **penalty**`;
        }
        color = '#fc6464';
      }
      
      if (color === '#a4ec7c') {
        return embeds.success(message, description.replace(`${emojis.success} <@${message.author.id}>: `, ''));
      } else {
        return embeds.deny(message, description.replace(`${emojis.error} <@${message.author.id}>: `, ''));
      }
      
    } catch (error) {
      console.error('Error in rob command:', error);
      return embeds.deny(message, 'An error occurred while attempting to rob');
    }
  }
};
