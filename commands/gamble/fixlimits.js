const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

// Utility functions
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

function calculateRequiredLimit(bankBalance) {
  // Round up to next tier that can accommodate the balance
  if (bankBalance <= 50000) return 50000;
  if (bankBalance <= 100000) return 150000; // 50k base + 100k from regular
  if (bankBalance <= 200000) return 200000;
  if (bankBalance <= 650000) return 650000; // 50k + 100k + 500k from noble
  if (bankBalance <= 1150000) return 1150000; // + 1M from royal
  return Math.ceil(bankBalance / 10000000) * 10000000 + 1150000; // + mythical banknotes
}

module.exports = {
  name: "fixlimits",
  aliases: [],
  description: 'Fix bank limits for existing players (Admin only)',
  syntax: 'fixlimits',
  example: 'fixlimits',
  run: async (client, message, args) => {
    
    // Check if user is admin/owner (you can modify this check)
    if (message.author.id !== '771255831021944832') { // Replace with your user ID
      return embeds.deny(message, 'This command is for administrators only.');
    }

    try {
      const userService = getService('user');
      
      // Get all users from database
      const allUsers = await userService.getAllUsers();
      let fixedCount = 0;
      let totalChecked = 0;

      const loadingMsg = await message.channel.send({ embeds: [embeds.createLoading(message, 'Checking and fixing bank limits...')] });

      for (const [userId, userData] of allUsers) {
        totalChecked++;
        
        if (userData.Gambling) {
          const bankBalance = userData.Gambling.bank || 0;
          const currentLimit = userData.Gambling.bankLimit || 50000;
          
          if (bankBalance > currentLimit) {
            const requiredLimit = calculateRequiredLimit(bankBalance);
            
            // Update the bank limit
            await userService.updateBankLimit(userId, requiredLimit);
            fixedCount++;
            
            console.log(`Fixed ${userId}: Bank ${formatCurrency(bankBalance)} -> Limit ${formatCurrency(requiredLimit)}`);
          }
        }
      }

      const embed = embeds.createSuccess(message, 
        `Bank limit fix completed!\n\n` +
        `**Users checked:** ${totalChecked}\n` +
        `**Limits fixed:** ${fixedCount}\n\n` +
        `All players with bank balances exceeding 50k now have appropriate limits.`
      );

      return loadingMsg.edit({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in fixlimits command:', error);
      return embeds.deny(message, 'An error occurred while fixing bank limits');
    }
  }
};