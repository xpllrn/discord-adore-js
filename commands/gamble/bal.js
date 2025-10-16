const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const userCache = require('../../database/cache/models/user');
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
      // Check if target user has a gambling account
      const hasAccount = await userCache.hasGamblingAccount(targetUser.id);

      if (!hasAccount) {
        const isOwnBalance = targetUser.id === message.author.id;
        const userText = isOwnBalance ? 'You don\'t' : `**${targetUser.displayName || targetUser.username || 'User'}** doesn't`;
        let suggestion = '';
        if (isOwnBalance) {
          const guildPrefix = await getGuildPrefix(message.guild.id);
          suggestion = ` Use \`${guildPrefix}account\` to create one!`;
        }
        return embeds.deny(message, `${userText} have a **gambling account** yet${suggestion}`);
      }

      // Calculate and apply bank interest first
      const interestEarned = await userCache.calculateBankInterest(targetUser.id);

      // Get updated gambling data
      const gambling = await userCache.getGamblingData(targetUser.id);

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
