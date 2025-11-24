const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { getGuildPrefix } = require('../../../../utils/commandProcessor');
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
  name: "deposit",
  aliases: ['dep'],
  description: 'Deposit money from your wallet to your bank',
  syntax: 'deposit [amount]',
  example: 'deposit 999',
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must give an **amount** to deposit!');
    }
    
    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;
      const bankBalance = gambling.bank || 0;
      const bankLimit = await userService.getBankLimit(message.author.id);
      
      if (walletBalance <= 0) {
        return embeds.deny(message, 'You don\'t have any money in your wallet to deposit');
      }
      
      // Parse amount
      const amount = parseAmount(args[0], walletBalance);
      
      if (amount === null || amount <= 0) {
        return embeds.deny(message, 'Please provide a valid amount to deposit');
      }
      
      if (amount > walletBalance) {
        return embeds.deny(message, `You only have **${formatCurrency(walletBalance)}** coins in your **wallet**`);
      }

      // Check bank limit
      if (bankBalance + amount > bankLimit) {
        const availableSpace = bankLimit - bankBalance;
        if (availableSpace <= 0) {
          return embeds.deny(message, `Your bank is full! Bank limit: **${formatCurrency(bankLimit)}** coins. Buy banknotes from the store to increase your limit.`);
        }
        return embeds.deny(message, `You can only deposit **${formatCurrency(availableSpace)}** more coins. Bank limit: **${formatCurrency(bankLimit)}** coins. Buy banknotes to increase your limit.`);
      }
      
      // Transfer money from wallet to bank using service layer
      const success = await userService.transferMoney(message.author.id, amount, true);

      if (!success) {
        return embeds.deny(message, 'Failed to deposit money. Please try again');
      }

      return embeds.success(message, `Deposited **${formatCurrency(amount)}** coins to your **bank account**`);
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while depositing money');
    }
  }
};
