const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../../handlers/finder');
const { getGuildPrefix } = require('../../utils/commandProcessor');
const { colors } = require('../../config/setup');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}



module.exports = {
  name: "bal",
  aliases: ['balance', 'money', 'cash'],
  description: 'Check your or someone else wallet and bank balance',
  usage: `{guildprefix}bal
{guildprefix}bal [user]`,
  run: async(client, message, args) => {
    
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

      // Get gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(targetUser.id);
      
      // Calculate and apply bank interest if method exists
      let interestEarned = 0;
      if (typeof userService.calculateBankInterest === 'function') {
        interestEarned = await userService.calculateBankInterest(targetUser.id);
      }

      const walletBalance = gambling.wallet || 0;
      const bankBalance = gambling.bank || 0;
      
      // Create embed with minimal format
      const isOwnBalance = targetUser.id === message.author.id;
      const userMention = isOwnBalance ? `<@${message.author.id}>` : `<@${targetUser.id}>`;
      const userText = isOwnBalance ? 'You have' : `**${targetUser.displayName || targetUser.username || 'User'}** has`;

      let description = `🏦 ${userMention}: ${userText} a **wallet** balance of **${formatCurrency(walletBalance)}** and a **bank** balance of **${formatCurrency(bankBalance)}** coins!`;

      // Add interest notification if earned
      if (interestEarned > 0) {
        description += `\n💰 You earned **${formatCurrency(interestEarned)}** coins in **bank interest**!`;
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(description);
      
      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in bal command:', error);
      return embeds.deny(message, 'An error occurred while checking the balance');
    }
  }
};
