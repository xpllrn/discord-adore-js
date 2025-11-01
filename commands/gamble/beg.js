const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');
const { getGuildPrefix } = require('../../utils/commandProcessor');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}



module.exports = {
  name: "beg",
  aliases: ['plead'],
  description: 'Beg for coins with a cooldown',
  syntax: 'beg',
  example: 'beg',
  run: async(client, message, args) => {
    
    try {
      const userService = getService('user');
      
      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);
      
      // Check beg cooldown (20 minutes)
      const lastBeg = gambling.begCooldown ? new Date(gambling.begCooldown) : null;
      const now = new Date();
      const cooldownTime = 20 * 60 * 1000; // 20 minutes in milliseconds
      
      if (lastBeg && (now.getTime() - lastBeg.getTime()) < cooldownTime) {
        // Calculate Unix timestamp for when they can beg next
        const nextBeg = new Date(lastBeg.getTime() + cooldownTime);
        const unixTimestamp = Math.floor(nextBeg.getTime() / 1000);
        
        return embeds.warn(message, `You can **beg** again <t:${unixTimestamp}:R>`);
      }
      
      // Calculate beg amount (100-1000 coins)
      const begAmount = Math.floor(Math.random() * 901) + 100; // 100-1000 coins
      
      // Random beg messages
      const begMessages = [
        'A **kind stranger** gave you',
        'You found some **coins** on the ground:',
        'Someone felt **sorry** for you and gave you',
        'You received a small **donation** of',
        'A **generous person** handed you',
        'You discovered some **loose change**:',
        'Someone **dropped** some coins and you got',
        'A passerby took **pity** on you and gave you'
      ];
      
      const randomMessage = begMessages[Math.floor(Math.random() * begMessages.length)];
      
      // Update user's wallet and beg cooldown using service layer
      await userService.updateWallet(message.author.id, begAmount);
      await userService.setUserField(message.author.id, 'Gambling.begCooldown', now);
      
      // Send success message
      return embeds.success(message, `${randomMessage} **${formatCurrency(begAmount)}** coins!`);
      
    } catch (error) {
      console.error('Error in beg command:', error);
      return embeds.deny(message, 'An error occurred while begging');
    }
  }
};
