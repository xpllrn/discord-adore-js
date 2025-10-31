const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "initstore",
  aliases: [],
  description: 'Initialize the store with default items',
  syntax: 'initstore',
  permission: 'dev',
  run: async (client, message, args) => {
    
    try {
      const storeService = getService('store');
      
      // Initialize all default banknotes
      await storeService.initializeDefaultItems();
      
      // Get count of items
      const items = await storeService.getAllItems();
      
      return embeds.success(message, `Successfully initialized store with **${items.length}** items!`);


      
    } catch (error) {
      console.error('Error initializing store:', error);
      return embeds.deny(message, `An error occurred while initializing the store: ${error.message}`);
    }
  }
};