const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const userCache = require('../../database/cache/models/user');
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
  usage: `{guildprefix}beg`,
  run: async(client, message, args) => {
    
    try {
      // Check if user has a gambling account
      const hasAccount = await userCache.hasGamblingAccount(message.author.id);
      
      if (!hasAccount) {
        const guildPrefix = await getGuildPrefix(message.guild.id);
        return embeds.deny(message, `You don\'t have a **gambling account** yet! Use \`${guildPrefix}account\` to create one`);
      }
      
      // Get user's gambling data
      const gambling = await userCache.getGamblingData(message.author.id);
      
      // Check beg cooldown (30 minutes)
      const lastBeg = gambling.begCooldown ? new Date(gambling.begCooldown) : null;
      const now = new Date();
      const cooldownTime = 30 * 60 * 1000; // 30 minutes in milliseconds
      
      if (lastBeg && (now.getTime() - lastBeg.getTime()) < cooldownTime) {
        // Calculate Unix timestamp for when they can beg next
        const nextBeg = new Date(lastBeg.getTime() + cooldownTime);
        const unixTimestamp = Math.floor(nextBeg.getTime() / 1000);
        
        const embed = new EmbedBuilder()
          .setColor('#fbd03b')
          .setDescription(`${emojis.warn} <@${message.author.id}>: You can **beg** again <t:${unixTimestamp}:R>`);
        
        return message.channel.send({ embeds: [embed] });
      }
      
      // Calculate beg amount based on total wealth (wallet + bank)
      const walletBalance = gambling.wallet || 0;
      const bankBalance = gambling.bank || 0;
      const totalWealth = walletBalance + bankBalance;

      let begAmount;

      if (totalWealth === 0) {
        // If total balance = 0 → Guaranteed 100 coins
        begAmount = 100;
      } else if (totalWealth < 5000) {
        // If total balance < 5,000 → 10–15% of total balance
        const percentage = (Math.random() * 5 + 10) / 100; // 10-15%
        begAmount = Math.floor(totalWealth * percentage);
        begAmount = Math.max(10, begAmount); // Minimum 10 coins
      } else {
        // If total > 5,000 → Slowly decreases payout
        const basePercentage = 10; // Start at 10%
        const reductionFactor = Math.min((totalWealth - 5000) / 50000, 0.8); // Reduce up to 80%
        const finalPercentage = basePercentage * (1 - reductionFactor);
        begAmount = Math.floor(totalWealth * (finalPercentage / 100));
        begAmount = Math.max(10, Math.min(begAmount, 1000)); // Min 10, max 1000
      }
      
      // Random beg messages
      const begMessages = [
        'A kind stranger gave you',
        'You found some coins on the ground:',
        'Someone felt sorry for you and gave you',
        'You received a small donation of',
        'A generous person handed you',
        'You discovered some loose change:',
        'Someone dropped some coins and you got',
        'A passerby took pity on you and gave you'
      ];
      
      const randomMessage = begMessages[Math.floor(Math.random() * begMessages.length)];
      
      // Update user's wallet and beg cooldown
      await userCache.updateWalletBalance(message.author.id, begAmount);
      await userCache.updateBegCooldown(message.author.id);
      
      // Send success message
      const embed = new EmbedBuilder()
        .setColor('#a4ec7c')
        .setDescription(`${emojis.success} <@${message.author.id}>: ${randomMessage} **${formatCurrency(begAmount)}** coins!`);
      
      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in beg command:', error);
      return embeds.deny(message, 'An error occurred while begging');
    }
  }
};
