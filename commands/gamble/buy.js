const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const { colors, emojis } = require('../../config/setup');

// Store items configuration (same as store.js)
const STORE_ITEMS = {
  'banknote_commoner': {
    id: 'banknote_commoner',
    name: 'Commoner Banknote',
    description: 'Increases your bank limit by 50,000 coins',
    price: 50000,
    emoji: '🪙',
    category: 'banknotes',
    bankLimitIncrease: 50000,
    sellPrice: 25000,
    stackable: true
  },
  'banknote_regular': {
    id: 'banknote_regular',
    name: 'Regular Banknote',
    description: 'Increases your bank limit by 100,000 coins',
    price: 90000,
    emoji: '💵',
    category: 'banknotes',
    bankLimitIncrease: 100000,
    sellPrice: 45000,
    stackable: true
  },
  'banknote_noble': {
    id: 'banknote_noble',
    name: 'Noble Banknote',
    description: 'Increases your bank limit by 500,000 coins',
    price: 400000,
    emoji: '👑',
    category: 'banknotes',
    bankLimitIncrease: 500000,
    sellPrice: 200000,
    stackable: true
  },
  'banknote_royal': {
    id: 'banknote_royal',
    name: 'Royal Banknote',
    description: 'Increases your bank limit by 1,000,000 coins',
    price: 800000,
    emoji: '💎',
    category: 'banknotes',
    bankLimitIncrease: 1000000,
    sellPrice: 400000,
    stackable: true
  },
  'banknote_mythical': {
    id: 'banknote_mythical',
    name: 'Mythical Banknote',
    description: 'Increases your bank limit by 10,000,000 coins',
    price: 8000000,
    emoji: '🌌',
    category: 'banknotes',
    bankLimitIncrease: 10000000,
    sellPrice: 4000000,
    stackable: true
  }
};

// Utility functions
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "buy",
  aliases: ['purchase'],
  description: 'Buy items from the gambling store',
  syntax: 'buy <number> [quantity]',
  example: 'buy 1 2',
  run: async (client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'Please specify an item to buy! Use `store` to see available items.');
    }

    let itemId = args[0].toLowerCase();
    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 100) {
      return embeds.deny(message, 'Quantity must be between 1 and 100');
    }

    // Check if user provided a number (position in store)
    const itemNumber = parseInt(args[0]);
    if (!isNaN(itemNumber)) {
      const itemKeys = Object.keys(STORE_ITEMS);
      if (itemNumber >= 1 && itemNumber <= itemKeys.length) {
        itemId = itemKeys[itemNumber - 1]; // Convert to 0-based index
      } else {
        return embeds.deny(message, `Invalid item number. Use 1-${itemKeys.length} or the item ID.`);
      }
    }

    const item = STORE_ITEMS[itemId];
    if (!item) {
      return embeds.deny(message, `Item **${itemId}** not found in store. Use \`store\` to see available items.`);
    }

    try {
      const userService = getService('user');

      // Get user's gambling data
      const gambling = await userService.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;
      
      const totalCost = item.price * quantity;

      if (walletBalance < totalCost) {
        return embeds.deny(message, `You need **${formatCurrency(totalCost)}** coins but only have **${formatCurrency(walletBalance)}** coins in your wallet.`);
      }

      // Create confirmation message
      const quantityText = quantity > 1 ? ` x${quantity}` : '';
      const confirmationText = `Are you sure you want to buy **${item.name}**${quantityText} for **${formatCurrency(totalCost)}** coins?\n\n${item.emoji} **${item.name}**\n${item.description}\n\n**Cost:** ${formatCurrency(totalCost)} coins`;

      // Show confirmation dialog
      await createConfirmation(
        message,
        confirmationText,
        async (interaction) => {
          try {
            // Re-check balance in case it changed during confirmation
            const updatedGambling = await userService.getGamblingData(message.author.id);
            const currentBalance = updatedGambling.wallet || 0;

            if (currentBalance < totalCost) {
              const errorEmbed = embeds.createDeny(message, `You no longer have enough coins. You need **${formatCurrency(totalCost)}** but only have **${formatCurrency(currentBalance)}**.`);
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Deduct money from wallet
            const deductSuccess = await userService.updateWallet(message.author.id, -totalCost);
            if (!deductSuccess) {
              const errorEmbed = embeds.createDeny(message, 'Failed to process payment. Please try again.');
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Add item to inventory
            const itemToAdd = {
              ...item,
              quantity: quantity
            };
            
            const addSuccess = await userService.addInventoryItem(message.author.id, itemToAdd);
            if (!addSuccess) {
              // Refund the money if inventory addition failed
              await userService.updateWallet(message.author.id, totalCost);
              const errorEmbed = embeds.createDeny(message, 'Failed to add item to inventory. Payment refunded.');
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Success message
            const successEmbed = embeds.createSuccess(message, `Successfully purchased **${item.name}**${quantityText} for **${formatCurrency(totalCost)}** coins!`);
            await interaction.editReply({ embeds: [successEmbed], components: [] });

          } catch (error) {
            console.error('Error in buy confirmation:', error);
            const errorEmbed = embeds.createDeny(message, 'An error occurred while processing your purchase.');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        }
      );
      
    } catch (error) {
      console.error('Error in buy command:', error);
      return embeds.deny(message, 'An error occurred while purchasing the item');
    }
  }
};