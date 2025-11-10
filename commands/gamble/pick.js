const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');
const { getGuildPrefix } = require('../../utils/commandProcessor');
const logger = require('../../utils/logger');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}



module.exports = {
  name: "pick",
  aliases: ['beg', 'grab'],
  description: 'Pick up coins from the streets with a cooldown',
  syntax: 'pick',
  example: 'pick',
  run: async(client, message, args) => {
    
    try {
      const userService = getService('user');
      
      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);
      
      // Check pick cooldown (20 minutes)
      const lastBeg = gambling.begCooldown ? new Date(gambling.begCooldown) : null;
      const now = new Date();
      const cooldownTime = 20 * 60 * 1000; // 20 minutes in milliseconds
      
      if (lastBeg && (now.getTime() - lastBeg.getTime()) < cooldownTime) {
        // Calculate Unix timestamp for when they can pick next
        const nextBeg = new Date(lastBeg.getTime() + cooldownTime);
        const unixTimestamp = Math.floor(nextBeg.getTime() / 1000);
        
        return embeds.warn(message, `You can **pick** again <t:${unixTimestamp}:R>`);
      }
      
      // Calculate pick amount (100-1000 coins)
      const begAmount = Math.floor(Math.random() * 901) + 100; // 100-1000 coins
      
      // Random pick messages
      const begMessages = [
        'You found some **crumpled bills** on the street:',
        'You picked up **loose change** from the sidewalk:',
        'You snatched **cash** from someone\'s **back pocket**:',
        'You spotted **money** lying in the gutter:',
        'You grabbed **bills** that fell out of someone\'s wallet:',
        'You found **coins** scattered on the ground:',
        'You pickpocketed someone and got',
        'You discovered **cash** under a park bench:',
        'You lifted **money** from an open purse:',
        'You found **bills** blowing in the wind:',
        'You swiped **cash** from a distracted tourist:',
        'You picked up **money** someone dropped:'
      ];
      
      const randomMessage = begMessages[Math.floor(Math.random() * begMessages.length)];
      
      // Update user's wallet and pick cooldown using service layer
      await userService.updateWallet(message.author.id, begAmount);
      await userService.setUserField(message.author.id, 'Gambling.begCooldown', now);
      
      // Send success message
      return embeds.success(message, `${randomMessage} **${formatCurrency(begAmount)}** coins!`);
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while picking');
    }
  }
};
