const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../../../../handlers/finder');
const { runHelpCommand, getGuildPrefix } = require('../../../../utils/commandProcessor');
const { checkBotAction } = require('../../../../utils/permissions');
const logger = require('../../../../utils/logger');

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

  // Handle "k" notation (e.g., 3k = 3000, 500k50 = 500050, 100k500 = 100500)
  if (cleanInput.includes('k')) {
    const parts = cleanInput.split('k');
    if (parts.length === 2) {
      const beforeK = parseFloat(parts[0]);
      const afterK = parseFloat(parts[1]) || 0;
      
      if (isNaN(beforeK) || beforeK < 0) return null;
      if (isNaN(afterK) || afterK < 0) return null;
      
      const amount = Math.floor(beforeK * 1000 + afterK);
      return amount;
    }
  }

  const amount = parseInt(cleanInput);
  if (isNaN(amount) || amount < 0) return null;
  return amount;
}



module.exports = {
  name: "transfer",
  aliases: ['give', 'pay'],
  description: 'Transfer money from your wallet to another user',
  syntax: 'transfer [user] [amount]',
  example: 'transfer @vwsn 999',
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must specify a **user** to transfer money to!');
    }

    if (!args[1]) {
      return embeds.warn(message, 'You must give an **amount** to transfer!');
    }
    
    try {
      const userService = getService('user');

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

      // Can't give money to the bot (specific check first)
      if (!checkBotAction(message, targetUser)) return;

      // Can't give money to other bots
      if (targetUser.bot) {
        return embeds.deny(message, 'You can\'t give money to bots');
      }

      // Get sender's gambling data (creates account if doesn't exist)
      const senderGambling = await userService.getGamblingData(message.author.id);
      
      // Ensure target has an account (creates if doesn't exist)
      await userService.getGamblingData(targetUser.id);
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
      
      // Transfer money using service layer
      await userService.updateWallet(message.author.id, -amount);
      await userService.updateWallet(targetUser.id, amount);
      
      return embeds.success(message, `Transferred **${formatCurrency(amount)}** coins to **${targetUser.displayName || targetUser.username || 'User'}**`);
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while transferring money');
    }
  }
};
