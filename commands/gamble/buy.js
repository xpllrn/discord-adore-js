const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const { colors, emojis } = require('../../config/setup');

// Utility function to format currency
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "buy",
  aliases: ['purchase'],
  description: 'Buy items from the gambling store',
  syntax: 'buy <number> [quantity]',
  example: 'buy 1 2',
  run: async (client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'Please specify an item to buy! Use `store` to see available items.');
    }

    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 100) {
      return embeds.deny(message, 'Quantity must be between 1 and 100');
    }

    // Find item by identifier (number or name)
    const storeService = getService('store');
    const item = await storeService.findItemByIdentifier(args[0]);
    
    if (!item) {
      return embeds.deny(message, `Item **${args[0]}** not found in store. Use \`store\` to see available items.`);
    }

    const itemId = item.id;

    try {
      const userService = getService('user');

      // Get user's gambling data
      const gambling = await userService.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;
      
      const totalCost = item.price * quantity;

      if (walletBalance < totalCost) {
        return embeds.deny(message, `You need **${formatCurrency(totalCost)}** coins but only have **${formatCurrency(walletBalance)}** coins in your wallet.`);
      }

      // Create confirmation message
      const quantityText = quantity > 1 ? ` x${quantity}` : '';
      const confirmationText = `Are you sure you want to buy **${item.name}**${quantityText} for **${formatCurrency(totalCost)}** coins?\n\n${item.emoji} **${item.name}**\n${item.description}\n\n**Cost:** ${formatCurrency(totalCost)} coins`;

      // Show confirmation dialog
      await createConfirmation(
        message,
        confirmationText,
        async (interaction) => {
          try {
            // Use atomic transaction to prevent race conditions
            const itemToAdd = {
              ...item,
              id: itemId,
              stackable: item.stackable !== false
            };

            const result = await userService.atomicPurchase(
              message.author.id,
              itemToAdd,
              quantity,
              totalCost
            );

            if (!result.success) {
              const errorEmbed = embeds.createDeny(message, result.message);
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Success message with new balance
            const successMessage = `Successfully purchased **${item.name}**${quantityText} for **${formatCurrency(totalCost)}** coins!\n\n**New Balance:** ${formatCurrency(result.newBalance)} coins`;
            const successEmbed = embeds.createSuccess(message, successMessage);
            await interaction.editReply({ embeds: [successEmbed], components: [] });

          } catch (error) {
            logger.webhook.error(error, message);
            const errorEmbed = embeds.createDeny(message, 'An error occurred while processing your purchase.');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        }
      );
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while purchasing the item');
    }
  }
};