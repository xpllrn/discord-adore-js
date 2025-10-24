const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { getGuildPrefix } = require('../../utils/commandProcessor');

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
  name: "withdraw",
  aliases: ['with'],
  description: 'Withdraw money from your bank to your wallet',
  usage: `{guildprefix}withdraw [amount]
{guildprefix}withdraw 1000
{guildprefix}withdraw all
{guildprefix}withdraw 50%`,
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must give an **amount** to withdraw!');
    }
    
    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);
      const bankBalance = gambling.bank || 0;
      
      if (bankBalance <= 0) {
        return embeds.deny(message, 'You don\'t have any money in your bank to withdraw');
      }
      
      // Parse amount
      const amount = parseAmount(args[0], bankBalance);
      
      if (amount === null || amount <= 0) {
        return embeds.deny(message, 'Please provide a valid amount to withdraw');
      }
      
      if (amount > bankBalance) {
        return embeds.deny(message, `You only have **${formatCurrency(bankBalance)}** coins in your **bank**`);
      }
      
      // Transfer money from bank to wallet using service layer
      const success = await userService.transferMoney(message.author.id, amount, false);

      if (!success) {
        return embeds.deny(message, 'Failed to withdraw money. Please try again');
      }

      return embeds.success(message, `Withdrew **${formatCurrency(amount)}** coins from your **bank account**`);
      
    } catch (error) {
      console.error('Error in withdraw command:', error);
      return embeds.deny(message, 'An error occurred while withdrawing money');
    }
  }
};
