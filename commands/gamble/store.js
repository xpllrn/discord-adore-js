const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors, emojis } = require('../../config/setup');

// Store items configuration
const STORE_ITEMS = {
  'banknote_commoner': {
    id: '1',
    name: 'Commoner Banknote',
    description: 'Increases your bank limit by 50,000 coins',
    price: 50000,
    emoji: '🪙',
    category: 'banknotes',
    bankLimitIncrease: 50000,
    sellPrice: 25000
  },
  'banknote_regular': {
    id: '2',
    name: 'Regular Banknote',
    description: 'Increases your bank limit by 100,000 coins',
    price: 90000,
    emoji: '💵',
    category: 'banknotes',
    bankLimitIncrease: 100000,
    sellPrice: 45000
  },
  'banknote_noble': {
    id: '3',
    name: 'Noble Banknote',
    description: 'Increases your bank limit by 500,000 coins',
    price: 400000,
    emoji: '👑',
    category: 'banknotes',
    bankLimitIncrease: 500000,
    sellPrice: 200000
  },
  'banknote_royal': {
    id: '4',
    name: 'Royal Banknote',
    description: 'Increases your bank limit by 1,000,000 coins',
    price: 800000,
    emoji: '💎',
    category: 'banknotes',
    bankLimitIncrease: 1000000,
    sellPrice: 400000
  },
  'banknote_mythical': {
    id: '5',
    name: 'Mythical Banknote',
    description: 'Increases your bank limit by 10,000,000 coins',
    price: 8000000,
    emoji: '🌌',
    category: 'banknotes',
    bankLimitIncrease: 10000000,
    sellPrice: 4000000
  }
};

// Utility functions
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

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