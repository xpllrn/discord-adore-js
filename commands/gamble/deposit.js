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
  name: "deposit",
  aliases: ['dep'],
  description: 'Deposit money from your wallet to your bank',
  usage: `{guildprefix}deposit [amount]
{guildprefix}deposit 1000
{guildprefix}deposit all
{guildprefix}deposit 50%`,
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must give an **amount** to deposit!');
    }
    
    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;
      
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
      
      // Transfer money from wallet to bank using service layer
      const success = await userService.transferMoney(message.author.id, amount, true);

      if (!success) {
        return embeds.deny(message, 'Failed to deposit money. Please try again');
      }

      return embeds.success(message, `Deposited **${formatCurrency(amount)}** coins to your **bank account**`);
      
    } catch (error) {
      console.error('Error in deposit command:', error);
      return embeds.deny(message, 'An error occurred while depositing money');
    }
  }
};
