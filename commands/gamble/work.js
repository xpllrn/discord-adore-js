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
  name: "work",
  aliases: ['job'],
  description: 'Work to earn coins with a cooldown',
  syntax: 'work',
  example: 'work',
  run: async (client, message, args) => {

    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);

      // Check work cooldown (1 hour = 3600000 ms)
      const workCooldown = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
      const lastWorked = gambling.lastWorked || null;
      const now = Date.now();

      if (lastWorked && (now - lastWorked) < workCooldown) {
        const timeLeft = workCooldown - (now - lastWorked);
        const unixTimestamp = Math.floor((now + timeLeft) / 1000);

        const embed = new EmbedBuilder()
          .setColor('#fc6464')
          .setDescription(`${emojis.warn} <@${message.author.id}>: You can **work** again <t:${unixTimestamp}:R>`);

        return message.channel.send({ embeds: [embed] });
      }

      // Calculate earnings based on total wealth (wallet + bank)
      const walletBalance = gambling.wallet || 0;
      const bankBalance = gambling.bank || 0;
      const totalWealth = walletBalance + bankBalance;

      let baseEarnings;

      if (totalWealth === 0) {
        // If user has no money, give them 100-500 coins to get started
        baseEarnings = Math.floor(Math.random() * 401) + 100; // 100-500 coins
      } else {
        // Payout: 8–20% of total balance (amount decreases as user gets richer)
        const basePercentage = 20; // Start at 20%
        const reductionFactor = Math.min(totalWealth / 100000, 0.6); // Reduce up to 60% as wealth increases
        const finalPercentage = basePercentage * (1 - reductionFactor);
        const actualPercentage = Math.max(finalPercentage, 8); // Minimum 8%

        baseEarnings = Math.floor(totalWealth * (actualPercentage / 100));
        baseEarnings = Math.max(100, Math.min(baseEarnings, 5000)); // Min 100, max 5000
      }

      // Work jobs with different multipliers
      const jobs = [
        { name: 'delivery driver', multiplier: 1.0, emoji: '🚗' },
        { name: 'cashier', multiplier: 1.1, emoji: '🏪' },
        { name: 'waiter', multiplier: 1.2, emoji: '🍽️' },
        { name: 'programmer', multiplier: 1.3, emoji: '💻' },
        { name: 'doctor', multiplier: 1.5, emoji: '👨‍⚕️' },
        { name: 'lawyer', multiplier: 1.4, emoji: '⚖️' },
        { name: 'teacher', multiplier: 1.1, emoji: '👨‍🏫' },
        { name: 'chef', multiplier: 1.2, emoji: '👨‍🍳' },
        { name: 'mechanic', multiplier: 1.1, emoji: '🔧' },
        { name: 'pilot', multiplier: 1.6, emoji: '✈️' }
      ];

      // Randomly select a job
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const finalEarnings = Math.floor(baseEarnings * job.multiplier);

      // Update user's wallet and work timestamp using service layer
      await userService.updateWallet(message.author.id, finalEarnings);
      await userService.updateWorkTimestamp(message.author.id);

      // Get updated wallet balance
      const updatedGambling = await userService.getGamblingData(message.author.id);
      const newWallet = updatedGambling.wallet || 0;

      // Create success message
      const embed = new EmbedBuilder()
        .setColor('#a4ec7c')
        .setDescription(`${job.emoji} <@${message.author.id}>: You worked as a **${job.name}** and earned **${formatCurrency(finalEarnings)}** coins!\nYou now have **${formatCurrency(newWallet)}** coins in your **wallet**`);

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error in work command:', error);
      return embeds.deny(message, 'An error occurred while working');
    }
  }
};
