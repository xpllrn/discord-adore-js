const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { colors, emojis } = require('../../config/setup');
const { findUser } = require('../../handlers/finder');
const logger = require('../../utils/logger');

// Utility functions
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "inventory",
  aliases: ['inv', 'items'],
  description: 'View your or someone else\'s inventory',
  syntax: 'inventory [user]',
  example: 'inventory @vwsn',
  run: async (client, message, args) => {
    
    let targetUser = message.author;
    
    // If user specified someone else
    if (args[0]) {
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }

      // Handle both guild members and global users
      targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    }

    try {
      const userService = getService('user');

      // Get user's inventory
      const inventory = await userService.getInventory(targetUser.id);
      
      const isOwnInventory = targetUser.id === message.author.id;
      const userMention = isOwnInventory ? `<@${message.author.id}>` : `<@${targetUser.id}>`;
      const possessive = isOwnInventory ? 'Your' : `**${targetUser.displayName || targetUser.username}**'s`;

      if (inventory.length === 0) {
        return embeds.warn(message, `${possessive} inventory is empty! Visit the \`store\` to buy items.`);
      }

      // Group items by type and calculate total value
      const itemGroups = {};
      let totalValue = 0;

      inventory.forEach(item => {
        const key = item.id;
        if (!itemGroups[key]) {
          itemGroups[key] = {
            ...item,
            totalQuantity: 0
          };
        }
        itemGroups[key].totalQuantity += item.quantity || 1;
        
        // Calculate value (use sellPrice if available, otherwise 50% of price)
        const itemValue = item.sellPrice || (item.price * 0.5) || 0;
        totalValue += itemValue * (item.quantity || 1);
      });

      let description = '';

      // Display items
      Object.values(itemGroups).forEach(item => {
        const itemNumber = String(item.id).padStart(2, '0');
        const quantityText = item.totalQuantity > 1 ? ` x${item.totalQuantity}` : '';
        
        description += `**${itemNumber}** ${item.emoji || '📦'} **${item.name}**${quantityText}\n`;
        if (item.description) {
          description += `-# ${item.description}\n`;
        }
        description += '\n';
      });

      if (isOwnInventory) {
        description += `Use \`use <number>\` to use items or \`sell <number> [quantity]\` to sell them.`;
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`🎒 ${possessive} Inventory`)
        .setDescription(description);

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while loading the inventory');
    }
  }
};