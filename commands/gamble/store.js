const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors, emojis } = require('../../config/setup');
const { STORE_ITEMS, formatCurrency } = require('../../config/store-items');

module.exports = {
  name: "store",
  aliases: ['shop'],
  description: 'View the gambling store to buy items',
  syntax: 'store',

  run: async (client, message, args) => {
    
    try {
      const items = Object.values(STORE_ITEMS);
      
      if (items.length === 0) {
        return embeds.warn(message, 'The store is currently empty. Check back later!');
      }

      // Group items by category
      const categories = {};
      items.forEach(item => {
        if (!categories[item.category]) {
          categories[item.category] = [];
        }
        categories[item.category].push(item);
      });

      let description = '';
      
      // Display items by category with position numbers
      let itemPosition = 1;
      Object.entries(categories).forEach(([category, categoryItems]) => {
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        description += `**${categoryName}:**\n`;
        
        categoryItems.forEach(item => {
          description += `**${itemPosition}.** ${item.emoji} **${item.name}** - **${formatCurrency(item.price)}** coins\n`;
          description += `-# ${item.description}\n\n`;
          itemPosition++;
        });
      });

      description += `-# Use \`buy <number>\` to purchase and \`inventory\` to view your items`;

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle('Welcome to the Gambling Store!')
        .setDescription(description);

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in store command:', error);
      return embeds.deny(message, 'An error occurred while loading the store');
    }
  }
};