const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');
const { STORE_ITEMS, findItemByIdentifier, formatCurrency } = require('../../config/store-items');

module.exports = {
  name: "sell",
  aliases: [],
  description: 'Sell items from your inventory',
  syntax: 'sell <number> [quantity]',
  example: 'sell 1 2',
  run: async (client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'Please specify an item to sell! Use `inventory` to see your items.');
    }

    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 100) {
      return embeds.deny(message, 'Quantity must be between 1 and 100');
    }

    // Find item by identifier (number or name)
    const itemResult = findItemByIdentifier(args[0]);
    if (!itemResult) {
      return embeds.deny(message, `Item **${args[0]}** is not a valid item. Use \`inventory\` to see your items.`);
    }

    const { key: itemId, item: storeItem } = itemResult;

    try {
      const userService = getService('user');

      // Get user's inventory
      const inventory = await userService.getInventory(message.author.id);
      
      // Find the item in inventory
      const userItem = inventory.find(item => item.id === itemId);
      if (!userItem) {
        return embeds.deny(message, `You don't have **${storeItem.name}** in your inventory.`);
      }

      const availableQuantity = userItem.quantity || 1;
      if (quantity > availableQuantity) {
        return embeds.deny(message, `You only have **${availableQuantity}** ${storeItem.name}(s) but tried to sell **${quantity}**.`);
      }

      // Calculate sell value
      const sellPrice = storeItem.sellPrice || Math.floor(storeItem.price * 0.5);
      const totalValue = sellPrice * quantity;

      // Create confirmation message
      const quantityText = quantity > 1 ? ` x${quantity}` : '';
      const confirmationText = `Are you sure you want to sell **${storeItem.name}**${quantityText} for **${formatCurrency(totalValue)}** coins?\n\n${storeItem.emoji} **${storeItem.name}**\n${storeItem.description}\n\n**You will receive:** ${formatCurrency(totalValue)} coins\n**Original price:** ${formatCurrency(storeItem.price * quantity)} coins`;

      // Show confirmation dialog
      await createConfirmation(
        message,
        confirmationText,
        async (interaction) => {
          try {
            // Re-check inventory in case it changed during confirmation
            const updatedInventory = await userService.getInventory(message.author.id);
            const currentItem = updatedInventory.find(item => item.id === itemId);
            
            if (!currentItem) {
              const errorEmbed = embeds.createDeny(message, `You no longer have **${storeItem.name}** in your inventory.`);
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            const currentQuantity = currentItem.quantity || 1;
            if (quantity > currentQuantity) {
              const errorEmbed = embeds.createDeny(message, `You only have **${currentQuantity}** ${storeItem.name}(s) but tried to sell **${quantity}**.`);
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Remove items from inventory
            const removeSuccess = await userService.removeInventoryItem(message.author.id, itemId, quantity);
            if (!removeSuccess) {
              const errorEmbed = embeds.createDeny(message, 'Failed to remove items from inventory. Please try again.');
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Add money to wallet
            const addSuccess = await userService.updateWallet(message.author.id, totalValue);
            if (!addSuccess) {
              // Try to add the items back if wallet update failed
              await userService.addInventoryItem(message.author.id, { ...userItem, quantity: quantity });
              const errorEmbed = embeds.createDeny(message, 'Failed to add money to wallet. Please try again.');
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Success message
            const successEmbed = embeds.createSuccess(message, `Successfully sold **${storeItem.name}**${quantityText} for **${formatCurrency(totalValue)}** coins!`);
            await interaction.editReply({ embeds: [successEmbed], components: [] });

          } catch (error) {
            console.error('Error in sell confirmation:', error);
            const errorEmbed = embeds.createDeny(message, 'An error occurred while processing your sale.');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        }
      );
      
    } catch (error) {
      console.error('Error in sell command:', error);
      return embeds.deny(message, 'An error occurred while selling the item');
    }
  }
};