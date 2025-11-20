const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const logger = require('../../../../utils/logger');

// Utility function to format currency
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "items",
  aliases: ['consumables', 'tools', 'banknotes', 'notes', 'bank-notes', 'rings'],
  description: 'View and buy items from the store',
  syntax: 'items [category]',
  example: 'items banknotes\nitems rings\nitems items',
  
  run: async (client, message, args) => {
    try {
      const storeService = getService('store');
      const category = args[0]?.toLowerCase() || 'items';
      
      // Get items from specified category
      const items = await storeService.getItemsByCategory(category);
      
      if (items.length === 0) {
        return embeds.warn(message, `No items found in category **${category}**. Try \`store\` to see all categories.`);
      }

      // Customize display based on category
      let description = '';
      let color = '#0099ff';
      let emoji = '🛒';
      
      if (category === 'banknotes') {
        description = `**Banknotes increase your bank storage limit!**\n\n`;
        color = '#00ff00';
        emoji = '💰';
      } else if (category === 'rings') {
        description = `**Rings are used to propose marriage!**\n\n`;
        color = '#ff69b4';
        emoji = '💍';
      } else {
        description = `**${category.charAt(0).toUpperCase() + category.slice(1)} Store**\n\n`;
      }
      
      items.forEach((item) => {
        const itemNumber = String(item.id).padStart(2, '0');
        description += `**${itemNumber}** **${item.name}** — **${formatCurrency(item.price)}** coins\n`;
        
        // Special formatting for banknotes
        if (category === 'banknotes' && item.bankLimitIncrease) {
          description += `-# Increases bank limit by **${formatCurrency(item.bankLimitIncrease)}** coins\n\n`;
        } else {
          description += `-# ${item.description}\n\n`;
        }
      });
      
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)} Store`)
        .setDescription(description)
        .setFooter({ text: 'Use buy <number> to purchase items' });

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'There was an error executing that command. Please report this to here immediately.');
    }
  }
};