const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "testcreate",
  aliases: [],
  description: 'Test creating a single store item',
  syntax: 'testcreate',
  permission: 'dev',
  run: async (client, message, args) => {
    
    try {
      const storeService = getService('store');
      
      const testItem = {
        id: '999',
        name: 'Test Item',
        description: 'A test item for debugging',
        price: 1000,
        sellPrice: 500,
        emoji: '🧪',
        category: 'banknotes',
        bankLimitIncrease: 1000,
        stackable: true,
        enabled: true
      };

      console.log('About to create test item:', testItem);
      
      const createdItem = await storeService.createOrUpdateItem(testItem);
      
      console.log('Created item:', createdItem);
      
      // Try to retrieve it
      const retrievedItem = await storeService.get('999');
      console.log('Retrieved item:', retrievedItem);
      
      // Check if it appears in getAllItems
      const allItems = await storeService.getAllItems();
      console.log('Total items after creation:', allItems.length);
      
      return embeds.success(message, `Test item created successfully!\n**ID:** ${createdItem.id}\n**Name:** ${createdItem.name}\n**Total items in store:** ${allItems.length}`);
      
    } catch (error) {
      console.error('Error creating test item:', error);
      return embeds.deny(message, `Failed to create test item: ${error.message}\n\nStack: ${error.stack}`);
    }
  }
};