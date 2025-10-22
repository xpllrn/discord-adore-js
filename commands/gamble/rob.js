const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const userCache = require('../../database/cache/models/user');
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
  const success = Math.random() < 0.30; // 30% success rate

  if (success) {
    // Steal 10-30% of target's wallet
    const percentage = Math.random() * 0.20 + 0.10; // 10-30%
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
  description: 'Attempt to rob money from another user (30% success rate, 1 hour cooldown)',
  usage: `{guildprefix}rob [user]
{guildprefix}rob @user`,
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must specify a user to rob!');
    }
    
    try {
      // Check if robber has a gambling account
      const robberHasAccount = await userCache.hasGamblingAccount(message.author.id);

      if (!robberHasAccount) {
        const guildPrefix = await getGuildPrefix(message.guild.id);
        return embeds.deny(message, `You don\'t have a gambling account yet! Use \`${guildPrefix}account\` to create one`);
      }

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

      // Can't rob bots
      if (targetUser.bot) {
        return embeds.deny(message, 'You can\'t rob bots');
      }
      
      // Get robber's gambling data
      const robberGambling = await userCache.getGamblingData(message.author.id);
      
      // Check rob cooldown
      const cooldownCheck = checkRobCooldown(robberGambling);
      
      if (!cooldownCheck.canRob) {
        // Calculate Unix timestamp for when they can rob next
        const lastRob = new Date(robberGambling.robCooldown);
        const nextRob = new Date(lastRob.getTime() + 60 * 60 * 1000); // 1 hour later
        const unixTimestamp = Math.floor(nextRob.getTime() / 1000);

        const embed = new EmbedBuilder()
          .setColor('#fbd03b')
          .setDescription(`${emojis.warn} <@${message.author.id}>: You can rob again <t:${unixTimestamp}:R>`);

        return message.channel.send({ embeds: [embed] });
      }
      
      // Check if target has a gambling account
      const targetHasAccount = await userCache.hasGamblingAccount(targetUser.id);

      if (!targetHasAccount) {
        return embeds.deny(message, `**${targetUser.displayName || targetUser.username || 'User'}** doesn't have a gambling account yet`);
      }

      // Get target's gambling data
      const targetGambling = await userCache.getGamblingData(targetUser.id);

      const targetWallet = targetGambling.wallet || 0;

      // Target must have at least 500 coins to be robbed
      if (targetWallet < 500) {
        return embeds.deny(message, `**${targetUser.displayName || targetUser.username || 'User'}** doesn't have enough **money** to rob (minimum **500** coins)`);
      }
      
      // Ensure cache writes are enabled before saving
      const { getCacheManager } = require('../../database/cache/core/CacheManager');
      const cacheManager = getCacheManager();
      if (!cacheManager.userCache.areWritesEnabled()) {
        cacheManager.enableWrites();
      }

      // Update rob cooldown
      await userCache.updateRobCooldown(message.author.id);
      
      // Calculate rob result
      const result = calculateRobResult(targetWallet);
      
      let description;
      let color;
      
      if (result.success) {
        // Transfer money
        await userCache.updateWalletBalance(message.author.id, result.amount);
        await userCache.updateWalletBalance(targetUser.id, -result.amount);

        description = `${emojis.success} <@${message.author.id}>: Successfully robbed **${formatCurrency(result.amount)}** coins from **${targetUser.displayName || targetUser.username || 'User'}**`;
        color = '#a4ec7c';
      } else {
        // Rob failed - robber loses 10-30% of their wallet
        const robberWallet = robberGambling.wallet || 0;
        const penaltyPercentage = Math.random() * 0.20 + 0.10; // 10-30%
        const penalty = Math.floor(robberWallet * penaltyPercentage);

        if (robberWallet >= penalty && penalty > 0) {
          await userCache.updateWalletBalance(message.author.id, -penalty);

          // 50% of penalty goes to target, 50% goes to "police" (removed from system)
          const targetShare = Math.floor(penalty * 0.5);
          if (targetShare > 0) {
            await userCache.updateWalletBalance(targetUser.id, targetShare);
          }

          description = `${emojis.error} <@${message.author.id}>: Failed to rob **${targetUser.displayName || targetUser.username || 'User'}** and lost **${formatCurrency(penalty)}** coins as **penalty**`;
        } else {
          description = `${emojis.error} <@${message.author.id}>: Failed to rob **${targetUser.displayName || targetUser.username || 'User'}** and was too poor to pay the **penalty**`;
        }
        color = '#fc6464';
      }
      
      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(description);
      
      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in rob command:', error);
      return embeds.deny(message, 'An error occurred while attempting to rob');
    }
  }
};
