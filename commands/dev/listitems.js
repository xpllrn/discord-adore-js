const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors } = require('../../config/setup');
const { getService } = require('@services');

module.exports = {
  name: "listitems",
  aliases: ['storeitems'],
  description: 'List all store items (admin)',
  syntax: 'listitems [category]',
  example: 'listitems banknotes',
  permission: 'dev',
  run: async (client, message, args) => {
    
    try {
      const storeService = getService('store');
      
      const category = args[0]?.toLowerCase();
      
      let items;
      let title;
      
      if (category) {
        items = await storeService.getItemsByCategory(category);
        title = `Store Items - ${category.charAt(0).toUpperCase() + category.slice(1)}`;
      } else {
        items = await storeService.getAllItems();
        title = 'All Store Items';
      }
      
      if (items.length === 0) {
        return embeds.warn(message, category ? 
          `No items found in category **${category}**` : 
          'No items found in the store');
      }

      let description = '';
      
      if (!category) {
        // Group by category
        const categories = {};
        items.forEach(item => {
          if (!categories[item.category]) {
            categories[item.category] = [];
          }
          categories[item.category].push(item);
        });

        Object.entries(categories).forEach(([cat, catItems]) => {
          const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
          description += `**${catName} (${catItems.length} items):**\n`;
          
          catItems.forEach(item => {
            const status = item.enabled ? '✅' : '❌';
            description += `${status} \`${item.id}\` - ${item.emoji} **${item.name}** (${item.price.toLocaleString()} coins)\n`;
          });
          description += '\n';
        });
      } else {
        // Show detailed view for single category
        items.forEach((item) => {
          const status = item.enabled ? '✅' : '❌';
          const number = String(item.id).padStart(2, '0');
          description += `${status} **${number}.** \`${item.id}\`\n`;
          description += `   ${item.emoji} **${item.name}** - ${item.price.toLocaleString()} coins\n`;
          description += `   ${item.description}\n`;
          if (item.bankLimitIncrease) {
            description += `   Bank Limit: +${item.bankLimitIncrease.toLocaleString()}\n`;
          }
          description += '\n';
        });
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: `Total: ${items.length} items` });

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error listing store items:', error);
      return embeds.deny(message, 'An error occurred while listing store items');
    }
  }
};