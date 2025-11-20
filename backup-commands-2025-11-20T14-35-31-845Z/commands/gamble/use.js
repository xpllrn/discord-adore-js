const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');
const logger = require('../../utils/logger');

// Utility function to format currency
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "use",
  aliases: ['consume'],
  description: 'Use items from your inventory',
  syntax: 'use <number> [quantity]',
  example: 'use 1 1',
  run: async (client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'Please specify an item to use! Use `inventory` to see your items.');
    }

    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 10) {
      return embeds.deny(message, 'Quantity must be between 1 and 10');
    }

    // Find item by identifier (number or name)
    const storeService = getService('store');
    const storeItem = await storeService.findItemByIdentifier(args[0]);
    
    if (!storeItem) {
      return embeds.deny(message, `Item **${args[0]}** is not a valid item. Use \`inventory\` to see your items.`);
    }

    const itemId = storeItem.id;

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

      // Use the item through StoreService
      const useResult = await storeService.useItem(message.author.id, storeItem, quantity, userService);
      
      if (!useResult.success) {
        return embeds.deny(message, useResult.message);
      }

      const resultMessage = useResult.message;

      // Remove items from inventory
      const removeSuccess = await userService.removeInventoryItem(message.author.id, itemId, quantity);
      if (!removeSuccess) {
        // Try to revert the changes if inventory removal failed
        if (useResult.oldLimit !== undefined && useResult.newLimit !== undefined) {
          await userService.updateBankLimit(message.author.id, useResult.oldLimit);
        }
        return embeds.deny(message, 'Failed to remove items from inventory. Changes reverted.');
      }

      // Success message
      return embeds.success(message, resultMessage);
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'There was an error executing that command. Please report this to here immediately.');
    }
  }
};