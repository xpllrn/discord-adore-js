const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "nextid",
  aliases: [],
  description: 'Get the next available item ID for the store',
  syntax: 'nextid',
  permission: 'dev',
  run: async (client, message, args) => {
    
    try {
      const storeService = getService('store');
      
      // Get all items to find the highest ID
      const allItems = await storeService.getAllItems();
      
      let maxId = 0;
      allItems.forEach(item => {
        const itemId = parseInt(item.id);
        if (!isNaN(itemId) && itemId > maxId) {
          maxId = itemId;
        }
      });
      
      const nextId = maxId + 1;
      
      return embeds.success(message, `Next available item ID: **${nextId}**\n\nUse: \`additem ${nextId} "Item Name" <price> <category> <emoji> "Description"\``);
      
    } catch (error) {
      console.error('Error getting next ID:', error);
      return embeds.deny(message, 'An error occurred while getting the next ID');
    }
  }
};