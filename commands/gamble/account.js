const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}



module.exports = {
  name: "account",
  aliases: ['create', 'open'],
  description: 'Create a gambling account to start using gambling commands',
  usage: `{guildprefix}account`,
  run: async(client, message, args) => {
    
    try {
      const userService = getService('user');

      // Get gambling data - this will auto-create account if it doesn't exist
      const gambling = await userService.getGamblingData(message.author.id);
      
      // Check if account already existed (wallet would be > 0 if it did)
      if (gambling.wallet > 0 || gambling.bank > 0 || gambling.totalGambled > 0) {
        return embeds.warn(message, 'You already have a **gambling account**!');
      }
      
      // Send success message
      const embed = new EmbedBuilder()
        .setColor('#a4ec7c')
        .setDescription(`${emojis.success} <@${message.author.id}>: Successfully created your **gambling account**! You start with **${formatCurrency(1000)}** coins in your **wallet**.`);
      
      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in account command:', error);
      return embeds.deny(message, 'An error occurred while creating your account');
    }
  }
};
