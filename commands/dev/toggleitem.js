const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "toggleitem",
  aliases: [],
  description: 'Enable or disable a store item',
  syntax: 'toggleitem <item_id> [enable|disable]',
  example: 'toggleitem banknote_dirt disable',
  permission: 'dev',
  run: async (client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'Usage: `toggleitem <item_id> [enable|disable]`');
    }

    try {
      const storeService = getService('store');
      const itemId = args[0]; // Keep as provided (numeric or string)
      
      // Get the item first
      const item = await storeService.get(itemId);
      if (!item) {
        return embeds.deny(message, `Item **${itemId}** not found in store`);
      }

      let newStatus;
      if (args[1]) {
        const action = args[1].toLowerCase();
        if (action === 'enable' || action === 'true') {
          newStatus = true;
        } else if (action === 'disable' || action === 'false') {
          newStatus = false;
        } else {
          return embeds.warn(message, 'Use `enable` or `disable` as the second argument');
        }
      } else {
        // Toggle current status
        newStatus = !item.enabled;
      }

      const success = await storeService.setItemEnabled(itemId, newStatus);
      
      if (success) {
        const statusText = newStatus ? 'enabled' : 'disabled';
        const statusEmoji = newStatus ? '✅' : '❌';
        
        return embeds.success(message, `${statusEmoji} Successfully **${statusText}** item **${item.name}**`);
      } else {
        return embeds.deny(message, 'Failed to update item status');
      }
      
    } catch (error) {
      console.error('Error toggling store item:', error);
      return embeds.deny(message, `An error occurred: ${error.message}`);
    }
  }
};