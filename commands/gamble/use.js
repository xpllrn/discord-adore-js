const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');

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
  name: "use",
  aliases: ['consume'],
  description: 'Use items from your inventory',
  syntax: 'use <number|item_id> [quantity]',
  example: 'use 1 1',
  run: async (client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'Please specify an item to use! Use `inventory` to see your items.');
    }

    let itemId = args[0].toLowerCase();
    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 10) {
      return embeds.deny(message, 'Quantity must be between 1 and 10');
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

    const storeItem = STORE_ITEMS[itemId];
    if (!storeItem) {
      return embeds.deny(message, `Item **${itemId}** is not a valid item. Use \`inventory\` to see your items.`);
    }

    try {
      const userService = getService('user');

      // Get user's inventory
      const inventory = await userService.getInventory(message.author.id);
      
      // Find the item in inventory
      const userItem = inventory.find(item => item.id === itemId);
      if (!userItem) {
        return embeds.deny(message, `You don't have **${storeItem.name}** in your inventory.`);
      }

      const availableQuantity = userItem.quantity || 1;
      if (quantity > availableQuantity) {
        return embeds.deny(message, `You only have **${availableQuantity}** ${storeItem.name}(s) but tried to use **${quantity}**.`);
      }

      // Handle different item types
      let resultMessage = '';
      let success = false;

      if (storeItem.category === 'banknotes' && storeItem.bankLimitIncrease) {
        // Handle banknote usage
        const currentLimit = await userService.getBankLimit(message.author.id);
        const newLimit = currentLimit + (storeItem.bankLimitIncrease * quantity);
        
        const updateSuccess = await userService.updateBankLimit(message.author.id, newLimit);
        if (updateSuccess) {
          success = true;
          const quantityText = quantity > 1 ? ` x${quantity}` : '';
          const increaseAmount = storeItem.bankLimitIncrease * quantity;
          resultMessage = `Used **${storeItem.name}**${quantityText}! Your bank limit increased by **${formatCurrency(increaseAmount)}** coins to **${formatCurrency(newLimit)}** coins total.`;
        }
      } else {
        return embeds.deny(message, `**${storeItem.name}** cannot be used or its effect is not implemented yet.`);
      }

      if (!success) {
        return embeds.deny(message, 'Failed to use the item. Please try again.');
      }

      // Remove items from inventory
      const removeSuccess = await userService.removeInventoryItem(message.author.id, itemId, quantity);
      if (!removeSuccess) {
        // Try to revert the changes if inventory removal failed
        if (storeItem.category === 'banknotes' && storeItem.bankLimitIncrease) {
          const currentLimit = await userService.getBankLimit(message.author.id);
          const revertedLimit = currentLimit - (storeItem.bankLimitIncrease * quantity);
          await userService.updateBankLimit(message.author.id, revertedLimit);
        }
        return embeds.deny(message, 'Failed to remove items from inventory. Changes reverted.');
      }

      // Success message
      const embed = new EmbedBuilder()
        .setColor('#a4ec7c')
        .setDescription(`${emojis.success} <@${message.author.id}>: ${resultMessage}`);

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in use command:', error);
      return embeds.deny(message, 'An error occurred while using the item');
    }
  }
};