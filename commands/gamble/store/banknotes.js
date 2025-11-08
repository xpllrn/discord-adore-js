const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');

// Utility function to format currency
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "banknotes",
  aliases: ['notes', 'bank-notes'],
  description: 'View and buy banknotes to increase your bank limit',
  syntax: 'banknotes',
  example: 'banknotes',
  
  run: async (client, message, args) => {
    try {
      const storeService = getService('store');
      
      // Get banknote items
      const banknotes = await storeService.getItemsByCategory('banknotes');
      
      if (banknotes.length === 0) {
        return embeds.warn(message, 'No banknotes available in the store right now.');
      }

      let description = `**Banknotes increase your bank storage limit!**\n\n`;
      
      banknotes.forEach((item) => {
        const itemNumber = String(item.id).padStart(2, '0');
        const bankIncrease = formatCurrency(item.bankLimitIncrease || 0);
        description += `**${itemNumber}** **${item.name}** — **${formatCurrency(item.price)}** coins\n`;
        description += `-# Increases bank limit by **${bankIncrease}** coins\n\n`;
      });
      
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 Banknotes Store')
        .setDescription(description)
        .setFooter({ text: 'Use buy <number> to purchase banknotes' });

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while loading banknotes');
    }
  }
};