const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');

// Utility function to format currency
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "items",
  aliases: ['consumables', 'tools'],
  description: 'View and buy consumable items and tools',
  syntax: 'items [category]',
  example: 'items tools',
  
  run: async (client, message, args) => {
    try {
      const storeService = getService('store');
      const category = args[0]?.toLowerCase() || 'items';
      
      // Get items from specified category (excluding banknotes)
      const items = await storeService.getItemsByCategory(category);
      const filteredItems = items.filter(item => item.category !== 'banknotes');
      
      if (filteredItems.length === 0) {
        return embeds.warn(message, `No items found in category **${category}**. Try \`store\` to see all categories.`);
      }

      let description = `**${category.charAt(0).toUpperCase() + category.slice(1)} Store**\n\n`;
      
      filteredItems.forEach((item) => {
        const itemNumber = String(item.id).padStart(2, '0');
        description += `**${itemNumber}** **${item.name}** — **${formatCurrency(item.price)}** coins\n`;
        description += `-# ${item.description}\n\n`;
      });
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🛒 ${category.charAt(0).toUpperCase() + category.slice(1)} Store`)
        .setDescription(description)
        .setFooter({ text: 'Use buy <number> to purchase items' });

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while loading items');
    }
  }
};