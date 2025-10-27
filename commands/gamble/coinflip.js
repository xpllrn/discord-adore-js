const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { getGuildPrefix } = require('../../utils/commandProcessor');

// Cooldown map to track user cooldowns
const cooldowns = new Map();

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
    // Check cooldown
    const cooldownTime = 5000; // 5 seconds
    const now = Date.now();
    const userId = message.author.id;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownTime;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        return embeds.warn(message, `Please wait **${timeLeft}** seconds before flipping again`);
      }
    }

    // Set cooldown
    cooldowns.set(userId, now);
    setTimeout(() => cooldowns.delete(userId), cooldownTime);
    
    if (!args[0]) {
      return embeds.warn(message, 'You must give an **amount** to bet!');
    }
    
    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;

      // Parse amount
      let amount = parseAmount(args[0], walletBalance);

      if (amount === null || amount <= 0) {
        return embeds.deny(message, 'Please provide a valid amount');
      }

      if (amount > walletBalance) {
        return embeds.deny(message, `You only have **${formatCurrency(walletBalance)}** coins in your **wallet**`);
      }

      // Cap amount at 250,000 coins maximum
      if (amount > 250000) {
        amount = 250000;
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
        await userService.updateWallet(message.author.id, winAmount);
        await userService.updateGamblingStats(message.author.id, amount, winAmount, 0);

        // Get updated wallet balance
        const updatedGambling = await userService.getGamblingData(message.author.id);
        const newWallet = updatedGambling.wallet || 0;

        description = `🪙 <@${message.author.id}>: You chose **${userChoice}** and it's **${coinResult}**!\nYou won **${formatCurrency(winAmount)}** 💵, in total you have **${formatCurrency(newWallet)}** 💵`;
        color = '#a4ec7c';
      } else {
        // User loses
        await userService.updateWallet(message.author.id, -amount);
        await userService.updateGamblingStats(message.author.id, amount, 0, amount);

        // Get updated wallet balance
        const updatedGambling = await userService.getGamblingData(message.author.id);
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
