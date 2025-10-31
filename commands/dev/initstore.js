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
      
      // Try to create items manually with detailed error reporting
      const defaultItems = [
        {
          id: '1',
          name: 'Dirt Banknote',
          description: 'Increases your bank limit by 20,000 coins',
          price: 20000,
          sellPrice: 10000,
          emoji: '🌱',
          category: 'banknotes',
          bankLimitIncrease: 20000,
          stackable: true,
          enabled: true
        },
        {
          id: '2',
          name: 'Commoner Banknote',
          description: 'Increases your bank limit by 50,000 coins',
          price: 45000,
          sellPrice: 22500,
          emoji: '🪙',
          category: 'banknotes',
          bankLimitIncrease: 50000,
          stackable: true,
          enabled: true
        }
      ];

      let successCount = 0;
      let errors = [];

      for (const item of defaultItems) {
        try {
          console.log(`Creating item: ${item.id} - ${item.name}`);
          const createdItem = await storeService.createOrUpdateItem(item);
          console.log(`Successfully created: ${createdItem.id}`);
          successCount++;
        } catch (error) {
          console.error(`Failed to create item ${item.id}:`, error);
          errors.push(`${item.id}: ${error.message}`);
        }
      }
      
      // Get count of items
      const items = await storeService.getAllItems();
      
      let message = `Initialization complete!\n**Items created:** ${successCount}\n**Items in store:** ${items.length}`;
      
      if (errors.length > 0) {
        message += `\n**Errors:**\n${errors.join('\n')}`;
      }
      
      return embeds.success(message, message);
      
    } catch (error) {
      console.error('Error initializing store:', error);
      return embeds.deny(message, `An error occurred while initializing the store: ${error.message}`);
    }
  }
};