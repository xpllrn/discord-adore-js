const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "storetest",
  aliases: [],
  description: 'Test store service functionality',
  syntax: 'storetest',
  permission: 'dev',
  run: async (client, message, args) => {
    
    try {
      const storeService = getService('store');
      
      let report = '**Store Service Test Report:**\n\n';
      
      // Test 1: Check if service is initialized
      report += `✅ Store service initialized: ${storeService.initialized}\n`;
      
      // Test 2: Get all items
      const allItems = await storeService.getAllItems();
      report += `📦 Total items in store: ${allItems.length}\n`;
      
      // Test 3: Get categories
      const categories = await storeService.getCategories();
      report += `📂 Categories found: ${categories.length}\n`;
      
      if (categories.length > 0) {
        categories.forEach(cat => {
          report += `   - ${cat.name}: ${cat.count} items\n`;
        });
      }
      
      // Test 4: Test item lookup
      const testItem = await storeService.findItemByIdentifier('1');
      report += `🔍 Item ID '1' found: ${testItem ? 'Yes' : 'No'}\n`;
      
      if (testItem) {
        report += `   - Name: ${testItem.name}\n`;
        report += `   - Price: ${testItem.price.toLocaleString()} coins\n`;
      }
      
      // Test 5: List first few items
      if (allItems.length > 0) {
        report += `\n**First few items:**\n`;
        allItems.slice(0, 3).forEach(item => {
          report += `${item.id}. ${item.emoji} ${item.name} - ${item.price.toLocaleString()} coins\n`;
        });
      }
      
      return embeds.success(message, report);
      
    } catch (error) {
      console.error('Error in store test:', error);
      return embeds.deny(message, `Store test failed: ${error.message}`);
    }
  }
};