const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "slut",
  aliases: ['whore'],
  description: 'Work in the adult entertainment industry to earn coins with a cooldown',
  syntax: 'slut',
  example: 'slut',
  run: async (client, message, args) => {

    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);

      // Check slut cooldown (1 hour = 3600000 ms) - separate from work command
      const slutCooldown = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
      const lastSlut = gambling.lastSlut || null;
      const now = Date.now();

      if (lastSlut && (now - lastSlut) < slutCooldown) {
        const timeLeft = slutCooldown - (now - lastSlut);
        const unixTimestamp = Math.floor((now + timeLeft) / 1000);

        const embed = new EmbedBuilder()
          .setColor('#fc6464')
          .setDescription(`${emojis.warn} <@${message.author.id}>: You can **slut** again <t:${unixTimestamp}:R>`);

        return message.channel.send({ embeds: [embed] });
      }

      // Calculate earnings based on total wealth (wallet + bank) - same as work
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

      // Adult entertainment jobs with different multipliers and funny messages
      const jobs = [
        { name: 'cam model', multiplier: 1.2, emoji: '📹', message: 'streamed for some lonely viewers' },
        { name: 'exotic dancer', multiplier: 1.3, emoji: '💃', message: 'danced at the local strip club' },
        { name: 'escort', multiplier: 1.5, emoji: '💋', message: 'provided companionship services' },
        { name: 'phone operator', multiplier: 1.1, emoji: '📞', message: 'answered some spicy phone calls' },
        { name: 'OnlyFans creator', multiplier: 1.4, emoji: '📱', message: 'posted some exclusive content' },
        { name: 'sugar baby', multiplier: 1.6, emoji: '💎', message: 'spent time with a generous benefactor' },
        { name: 'adult film actor', multiplier: 1.7, emoji: '🎬', message: 'starred in an adult production' },
        { name: 'massage therapist', multiplier: 1.2, emoji: '💆', message: 'gave some "special" massages' },
        { name: 'dominatrix', multiplier: 1.5, emoji: '🖤', message: 'dominated some willing clients' },
        { name: 'fetish model', multiplier: 1.3, emoji: '👠', message: 'modeled for some unique requests' }
      ];

      // Randomly select a job
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const finalEarnings = Math.floor(baseEarnings * job.multiplier);

      // Update user's wallet and slut timestamp using service layer
      await userService.updateWallet(message.author.id, finalEarnings);
      await userService.setUserField(message.author.id, 'Gambling.lastSlut', now);

      // Create success message with funny descriptions
      const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setDescription(`${job.emoji} <@${message.author.id}>: You worked as a **${job.name}** and ${job.message}, earning **${formatCurrency(finalEarnings)}** coins!`);

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error in slut command:', error);
      return embeds.deny(message, 'An error occurred while working');
    }
  }
};