const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "additem",
  aliases: [],
  description: 'Add a new item to the store',
  syntax: 'additem <id> <name> <price> <category> <emoji> <description>',
  example: 'additem test_item "Test Item" 1000 banknotes 🧪 "A test item for testing"',
  permission: 'dev',
  run: async (client, message, args) => {
    
    if (args.length < 6) {
      return embeds.warn(message, 'Usage: `additem <id> <name> <price> <category> <emoji> <description>`');
    }

    try {
      const storeService = getService('store');
      
      const itemId = args[0].toLowerCase();
      const itemName = args[1].replace(/"/g, ''); // Remove quotes
      const price = parseInt(args[2]);
      const category = args[3].toLowerCase();
      const emoji = args[4];
      const description = args.slice(5).join(' ').replace(/"/g, ''); // Remove quotes

      if (isNaN(price) || price < 0) {
        return embeds.deny(message, 'Price must be a valid positive number');
      }

      const itemData = {
        id: itemId,
        name: itemName,
        description: description,
        price: price,
        sellPrice: Math.floor(price * 0.5), // Default 50% sell price
        emoji: emoji,
        category: category,
        stackable: true,
        enabled: true
      };

      // Add category-specific properties
      if (category === 'banknotes') {
        // For banknotes, ask for bank limit increase
        const bankLimitIncrease = parseInt(args[6]) || price; // Default to price if not specified
        itemData.bankLimitIncrease = bankLimitIncrease;
      }

      const createdItem = await storeService.createOrUpdateItem(itemData);
      
      return embeds.success(message, `Successfully added **${createdItem.name}** to the store!\n\n` +
        `**ID:** ${createdItem.id}\n` +
        `**Price:** ${createdItem.price.toLocaleString()} coins\n` +
        `**Category:** ${createdItem.category}\n` +
        `**Description:** ${createdItem.description}`);
      
    } catch (error) {
      console.error('Error adding store item:', error);
      return embeds.deny(message, `An error occurred while adding the item: ${error.message}`);
    }
  }
};