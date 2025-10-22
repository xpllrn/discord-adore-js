const { embeds } = require('../../core/embeds');
const userCache = require('../../database/cache/models/user');
const { findUser } = require('../../handlers/finder');
const { runHelpCommand, getGuildPrefix } = require('../../utils/commandProcessor');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

function parseAmount(input, balance) {
  if (!input || typeof input !== 'string') return null;

  const cleanInput = input.toLowerCase().replace(/[,\s]/g, '');

  if (cleanInput === 'all') return balance;
  if (cleanInput === 'half') return Math.floor(balance / 2);

  if (cleanInput.endsWith('%')) {
    const percentage = parseFloat(cleanInput.slice(0, -1));
    if (isNaN(percentage) || percentage < 0 || percentage > 100) return null;
    return Math.floor((percentage / 100) * balance);
  }

  const amount = parseInt(cleanInput);
  if (isNaN(amount) || amount < 0) return null;
  return amount;
}



module.exports = {
  name: "transfer",
  aliases: ['give', 'pay'],
  description: 'Transfer money from your wallet to another user',
  usage: `{guildprefix}transfer [user] [amount]
{guildprefix}transfer @user 1000
{guildprefix}transfer @user all`,
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must specify a **user** to transfer money to!');
    }

    if (!args[1]) {
      return embeds.warn(message, 'You must give an **amount** to transfer!');
    }
    
    try {
      // Check if sender has a gambling account
      const senderHasAccount = await userCache.hasGamblingAccount(message.author.id);

      if (!senderHasAccount) {
        const guildPrefix = await getGuildPrefix(message.guild.id);
        return embeds.deny(message, `You don\'t have a gambling account yet! Use \`${guildPrefix}account\` to create one`);
      }

      // Find target user
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        // Check if they put the arguments in wrong order (amount first, then user)
        const amountCheck = parseAmount(args[0], 999999999);
        if (amountCheck !== null && amountCheck > 0) {
          return runHelpCommand(message, 'transfer');
        }
        return embeds.deny(message, userResult.error);
      }

      // Handle both guild members and global users
      const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;

      // Can't give money to yourself
      if (targetUser.id === message.author.id) {
        return embeds.deny(message, 'You can\'t give money to yourself');
      }

      // Can't give money to bots
      if (targetUser.bot) {
        return embeds.deny(message, 'You can\'t give money to bots');
      }

      // Check if target has a gambling account
      const targetHasAccount = await userCache.hasGamblingAccount(targetUser.id);

      if (!targetHasAccount) {
        return embeds.deny(message, `**${targetUser.displayName || targetUser.username || 'User'}** doesn't have a **gambling account** yet`);
      }
      
      // Get sender's gambling data
      const senderGambling = await userCache.getGamblingData(message.author.id);
      const walletBalance = senderGambling.wallet || 0;
      
      if (walletBalance <= 0) {
        return embeds.deny(message, 'You don\'t have any money in your wallet to give');
      }
      
      // Parse amount
      const amount = parseAmount(args[1], walletBalance);
      
      if (amount === null || amount <= 0) {
        return embeds.deny(message, 'Please provide a valid amount to give');
      }
      
      if (amount > walletBalance) {
        return embeds.deny(message, `You only have **${formatCurrency(walletBalance)}** coins in your **wallet**`);
      }
      
      // Minimum transfer amount
      if (amount < 10) {
        return embeds.deny(message, 'Minimum transfer amount is 10 coins');
      }
      
      // Ensure cache writes are enabled before saving
      const { getCacheManager } = require('../../database/cache/core/CacheManager');
      const cacheManager = getCacheManager();
      if (!cacheManager.userCache.areWritesEnabled()) {
        cacheManager.enableWrites();
      }

      // Transfer money
      await userCache.updateWalletBalance(message.author.id, -amount);
      await userCache.updateWalletBalance(targetUser.id, amount);
      
      return embeds.success(message, `Transferred **${formatCurrency(amount)}** coins to **${targetUser.displayName || targetUser.username || 'User'}**`);
      
    } catch (error) {
      console.error('Error in give command:', error);
      return embeds.deny(message, 'An error occurred while transferring money');
    }
  }
};
