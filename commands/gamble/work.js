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

      // Check work cooldown (20 minutes)
      const workCooldown = 20 * 60 * 1000; // 20 minutes in milliseconds
      const lastWorked = gambling.lastWorked || null;
      const now = Date.now();

      if (lastWorked && (now - lastWorked) < workCooldown) {
        const timeLeft = workCooldown - (now - lastWorked);
        const unixTimestamp = Math.floor((now + timeLeft) / 1000);

        return embeds.warn(message, `You can **work** again <t:${unixTimestamp}:R>`);
      }

      // Update work timestamp first
      await userService.updateWorkTimestamp(message.author.id);

      // 80% chance of success, 20% chance of failure (no pay)
      const success = Math.random() < 0.80;

      if (success) {
        // Success - earn money
        const baseEarnings = Math.floor(Math.random() * 4501) + 500; // 500-5000 coins

        // Work jobs with different multipliers and success messages
        const jobs = [
          { name: 'delivery driver', multiplier: 1.0, emoji: '🚗', message: 'delivered packages **efficiently** and got paid' },
          { name: 'cashier', multiplier: 1.1, emoji: '🏪', message: 'handled customers **professionally** and earned your wage' },
          { name: 'waiter', multiplier: 1.2, emoji: '🍽️', message: 'served tables with a **smile** and received good tips' },
          { name: 'programmer', multiplier: 1.3, emoji: '💻', message: 'coded like a **boss** and impressed your manager' },
          { name: 'doctor', multiplier: 1.5, emoji: '👨‍⚕️', message: '**saved lives** and got paid handsomely' },
          { name: 'lawyer', multiplier: 1.4, emoji: '⚖️', message: '**won** your case and collected your fee' },
          { name: 'teacher', multiplier: 1.1, emoji: '👨‍🏫', message: 'educated **young minds** and earned your salary' },
          { name: 'chef', multiplier: 1.2, emoji: '👨‍🍳', message: 'cooked **delicious meals** and got paid well' },
          { name: 'mechanic', multiplier: 1.1, emoji: '🔧', message: 'fixed cars **perfectly** and earned your wage' },
          { name: 'pilot', multiplier: 1.6, emoji: '✈️', message: 'flew passengers **safely** and got paid premium' }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const finalEarnings = Math.floor(baseEarnings * job.multiplier);

        await userService.updateWallet(message.author.id, finalEarnings);

        return embeds.success(message, `${job.emoji} You worked as a **${job.name}** and ${job.message}, earning **${formatCurrency(finalEarnings)}** coins!`);
      } else {
        // Failure - no pay with funny messages
        const failures = [
          { emoji: '🚗', job: 'delivery driver', message: '**crashed** the delivery truck into a **fire hydrant** and got fired without pay' },
          { emoji: '🏪', job: 'cashier', message: 'accidentally gave away **free stuff** all day and got fired without pay' },
          { emoji: '🍽️', job: 'waiter', message: 'spilled **hot soup** on a customer and got fired without pay' },
          { emoji: '💻', job: 'programmer', message: '**deleted** the entire **database** and got fired without pay' },
          { emoji: '👨‍⚕️', job: 'doctor', message: 'mixed up **patient files** and got **sued**, no payment received' },
          { emoji: '⚖️', job: 'lawyer', message: 'showed up to court **drunk** and **lost** the case, no fee collected' },
          { emoji: '👨‍🏫', job: 'teacher', message: 'taught the kids **swear words** and got fired without pay' },
          { emoji: '👨‍🍳', job: 'chef', message: '**burned down** the kitchen and got fired without pay' },
          { emoji: '🔧', job: 'mechanic', message: '**broke** the car even more and got fired without pay' },
          { emoji: '✈️', job: 'pilot', message: 'landed at the **wrong airport** and got fired without pay' },
          { emoji: '💤', job: 'security guard', message: 'fell **asleep** on duty and the place got **robbed**, no pay' },
          { emoji: '🧹', job: 'janitor', message: '**flooded** the entire building and got fired without pay' },
          { emoji: '📞', job: 'call center agent', message: '**hung up** on every customer and got fired without pay' },
          { emoji: '🚛', job: 'truck driver', message: 'got the truck **stuck under a bridge** and got fired without pay' },
          { emoji: '🏗️', job: 'construction worker', message: 'accidentally **demolished** the **wrong building** and got fired without pay' }
        ];

        const failure = failures[Math.floor(Math.random() * failures.length)];

        return embeds.deny(message, `${failure.emoji} You worked as a **${failure.job}** but ${failure.message}!`);
      }

    } catch (error) {
      console.error('Error in work command:', error);
      return embeds.deny(message, 'An error occurred while working');
    }
  }
};
