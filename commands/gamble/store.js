const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors, emojis } = require('../../config/setup');
const { getService } = require('@services');

// Note: Specific store categories are now in ./store/ folder:
// - ./store/banknotes.js - For banknote items
// - ./store/items.js - For other consumable items and tools

// Utility function to format currency
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "store",
  aliases: ['shop'],
  description: 'View the gambling store to buy items',
  syntax: 'store [category]',
  example: 'store banknotes',

  run: async (client, message, args) => {
    
    try {
      const storeService = getService('store');
      
      // Get requested category or show all categories
      const requestedCategory = args[0]?.toLowerCase();
      
      if (requestedCategory) {
        // Show specific category
        const items = await storeService.getItemsByCategory(requestedCategory);
        
        if (items.length === 0) {
          return embeds.warn(message, `No items found in category **${requestedCategory}**. Use \`store\` to see all categories.`);
        }

        return await showCategoryItems(message, requestedCategory, items);
      } else {
        // Show all categories with pagination
        const categories = await storeService.getCategories();
        
        if (categories.length === 0) {
          return embeds.warn(message, 'The store is currently empty. Check back later!');
        }

        return await showCategoriesOverview(message, categories);
      }
      
    } catch (error) {
      console.error('Error in store command:', error);
      return embeds.deny(message, 'An error occurred while loading the store');
    }
  }
};

/**
 * Show overview of all categories
 */
async function showCategoriesOverview(message, categories) {
  let description = ``;
  
  categories.forEach((category, index) => {
    const categoryName = category.name.charAt(0).toUpperCase() + category.name.slice(1);
    description += `**${index + 1}.** ${categoryName} (${category.count} items)\n`;
  });
  
  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Gambling Store')
    .setDescription(description)
    .setFooter({ text: 'Use store <store name> to view items in a specific store' });

  // Add category buttons
  const buttons = [];
  categories.forEach((category, index) => {
    if (index < 5) { // Discord limit of 5 buttons per row
      const categoryName = category.name.charAt(0).toUpperCase() + category.name.slice(1);
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`store_category_${category.name}`)
          .setLabel(categoryName)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📦')
      );
    }
  });

  const actionRow = new ActionRowBuilder().addComponents(buttons);
  
  const sentMessage = await message.channel.send({ 
    embeds: [embed], 
    components: buttons.length > 0 ? [actionRow] : [] 
  });

  // Handle button interactions
  if (buttons.length > 0) {
    const collector = sentMessage.createMessageComponentCollector({
      time: 60000 // 1 minute
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ 
          content: 'Only the command user can use these buttons!', 
          ephemeral: true 
        });
      }

      const categoryName = interaction.customId.replace('store_category_', '');
      const storeService = getService('store');
      const items = await storeService.getItemsByCategory(categoryName);
      
      const categoryEmbed = await createCategoryEmbed(categoryName, items);
      await interaction.update({ embeds: [categoryEmbed], components: [] });
    });

    collector.on('end', () => {
      // Remove buttons after timeout
      sentMessage.edit({ components: [] }).catch(() => {});
    });
  }

  return sentMessage;
}

/**
 * Show items in a specific category
 */
async function showCategoryItems(message, categoryName, items) {
  const embed = await createCategoryEmbed(categoryName, items);
  return message.channel.send({ embeds: [embed] });
}

/**
 * Create embed for category items
 */
async function createCategoryEmbed(categoryName, items) {
  const categoryTitle = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  let description = ``;
  
  items.forEach((item) => {
    const itemNumber = String(item.id).padStart(2, '0');
    description += `**${itemNumber}** **${item.name}** — **${formatCurrency(item.price)}** coins\n`;
    description += `-# ${item.description}\n\n`;
  });
  
  return new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle(`${categoryTitle} Store`)
    .setDescription(description)
    .setFooter({ text: 'Use buy <number> to purchase items' });
} 