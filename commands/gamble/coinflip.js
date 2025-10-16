const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const userCache = require('../../database/cache/models/user');
const { getGuildPrefix } = require('../../utils/commandProcessor');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

function parseAmount(input, balance) {
  if (!input || typeof input !== 'string') return null;

  const cleanInput = input.toLowerCase().replace(/[,\s]/g, '');

  if (cleanInput === 'all') return balance;
  if (cleanInput === 'half') return Math.floor(balance / 2);

  if (cleanInput.endsWith('%')) {
    const percentage = parseFloat(cleanInput.slice(0, -1));
    if (isNaN(percentage) || percentage < 0 || percentage > 100) return null;
    return Math.floor((percentage / 100) * balance);
  }

  const amount = parseInt(cleanInput);
  if (isNaN(amount) || amount < 0) return null;
  return amount;
}

module.exports = {
  name: "coinflip",
  aliases: ['cf', 'flip', 'gamble'],
  description: 'Flip a coin and bet on the outcome (bot chooses heads or tails randomly)',
  usage: `{guildprefix}coinflip [amount]
{guildprefix}cf 1000
{guildprefix}cf all
{guildprefix}cf half`,
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must give an **amount** to bet!');
    }
    
    try {
      // Check if user has a gambling account
      const hasAccount = await userCache.hasGamblingAccount(message.author.id);

      if (!hasAccount) {
        const guildPrefix = await getGuildPrefix(message.guild.id);
        return embeds.deny(message, `You don\'t have a **gambling account** yet! Use \`${guildPrefix}account\` to create one`);
      }

      // Get user's gambling data
      const gambling = await userCache.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;

      // Parse amount
      let amount = parseAmount(args[0], walletBalance);

      if (amount === null || amount <= 0) {
        return embeds.deny(message, 'Please provide a valid amount');
      }

      if (amount > walletBalance) {
        return embeds.deny(message, `You only have **${formatCurrency(walletBalance)}** coins in your **wallet**`);
      }

      // Cap amount at 100,000 coins maximum
      if (amount > 100000) {
        amount = 100000;
      }

      // Create loading embed
      const loadingEmbed = new EmbedBuilder()
        .setColor('#7985cd')
        .setDescription(`🪙 <@${message.author.id}>: Flipping coin for **${formatCurrency(amount)}** coins...`);

      const loadingMessage = await message.channel.send({ embeds: [loadingEmbed] });

      // Wait for excitement (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Bot randomly chooses heads or tails for the user
      const userChoice = Math.random() < 0.5 ? 'heads' : 'tails';

      // Determine coin result (50% win chance)
      const playerWins = Math.random() < 0.50;

      // Determine coin result based on whether player should win
      let coinResult;
      if (playerWins) {
        coinResult = userChoice; // Player wins - coin shows their choice
      } else {
        coinResult = userChoice === 'heads' ? 'tails' : 'heads'; // Player loses - coin shows opposite
      }

      const won = userChoice === coinResult;

      let description, color;

      if (won) {
        // User wins - double their money
        const winAmount = amount;
        await userCache.updateWalletBalance(message.author.id, winAmount);
        await userCache.updateGamblingStats(message.author.id, amount, winAmount, 0);

        // Get updated wallet balance
        const updatedGambling = await userCache.getGamblingData(message.author.id);
        const newWallet = updatedGambling.wallet || 0;

        description = `🪙 <@${message.author.id}>: You chose **${userChoice}** and it's **${coinResult}**!\nYou won **${formatCurrency(winAmount)}** 💵, in total you have **${formatCurrency(newWallet)}** 💵`;
        color = '#a4ec7c';
      } else {
        // User loses
        await userCache.updateWalletBalance(message.author.id, -amount);
        await userCache.updateGamblingStats(message.author.id, amount, 0, amount);

        // Get updated wallet balance
        const updatedGambling = await userCache.getGamblingData(message.author.id);
        const newWallet = updatedGambling.wallet || 0;

        description = `🪙 <@${message.author.id}>: You chose **${userChoice}**, but it's **${coinResult}**!\nYou lost **${formatCurrency(amount)}** 💵, in total you have **${formatCurrency(newWallet)}** 💵`;
        color = '#fc6464';
      }
      
      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(description);

      return loadingMessage.edit({ embeds: [embed] });
      
    } catch (error) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Coinflip Command', {
          command: 'coinflip',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      return embeds.deny(message, 'An error occurred while gambling');
    }
  }
};
