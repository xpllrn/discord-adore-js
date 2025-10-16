const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const userCache = require('../../database/cache/models/user');
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
      // Check if user already has an account
      const hasAccount = await userCache.hasGamblingAccount(message.author.id);

      if (hasAccount) {
        return embeds.warn(message, 'You already have a **gambling account**!');
      }
      
      // Create the account by setting the default gambling data to the database
      const newAccountData = {
        wallet: 1000,
        bank: 0,
        dailyClaim: {
          lastClaimed: null,
          streak: 0
        },
        robCooldown: null,
        totalGambled: 0,
        totalWon: 0,
        totalLost: 0
      };
      
      await userCache.setGamblingData(message.author.id, newAccountData);
      
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
