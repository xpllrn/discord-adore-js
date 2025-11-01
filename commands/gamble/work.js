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
          { name: 'McDonald\'s worker', multiplier: 0.6, emoji: '🍟', message: 'flipped **burgers** for **minimum wage**' },
          { name: 'Uber driver', multiplier: 0.9, emoji: '📈', message: 'drove **drunk idiots** around town' },
          { name: 'Freelance writer', multiplier: 1.2, emoji: '✍️', message: 'wrote **clickbait articles** for **boomers**' },
          { name: 'Software dev', multiplier: 1.8, emoji: '💻', message: 'fixed **spaghetti code** and got **paid**' },
          { name: 'Day trader', multiplier: 1.7, emoji: '📈', message: '**bought the dip** and made **bank**' },
          { name: 'Real estate agent', multiplier: 1.5, emoji: '🏠', message: 'sold **overpriced houses** to **suckers**' },
          { name: 'Bartender', multiplier: 1.1, emoji: '🍺', message: 'served **drinks** and got **fat tips**' },
          { name: 'Delivery driver', multiplier: 0.8, emoji: '📦', message: 'delivered **packages** in the **rain**' },
          { name: 'NFT scammer', multiplier: 1.8, emoji: '🎨', message: 'sold **JPEGs** to **crypto bros**' },
          { name: 'Tutor', multiplier: 1.4, emoji: '📚', message: 'taught **dumb kids** basic **math**' },
          { name: 'Photographer', multiplier: 1.6, emoji: '�', emessage: 'shot **tiktok** for **white kids**' },
          { name: 'Mechanic', multiplier: 1.2, emoji: '🔧', message: 'fixed **broken cars** and got **dirty**' }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const finalEarnings = Math.floor(baseEarnings * job.multiplier);

        await userService.updateWallet(message.author.id, finalEarnings);

        return embeds.success(message, `${job.emoji} You worked as a **${job.name}** and ${job.message}, earning **${formatCurrency(finalEarnings)}** coins!`);
      } else {
        // Failure - no pay with funny messages
        const failures = [
          { emoji: '🍟', job: 'McDonald\'s worker', message: 'got **fired** for eating the **fries**' },
          { emoji: '�', jjob: 'Uber driver', message: 'passenger **puked** in your car and **didn\'t tip**' },
          { emoji: '✍️', job: 'freelance writer', message: 'client **refused to pay** for your **trash article**' },
          { emoji: '💻', job: 'software dev', message: 'pushed **broken code** to **production**' },
          { emoji: '📈', job: 'day trader', message: '**bought high, sold low** like an **idiot**' },
          { emoji: '🏠', job: 'real estate agent', message: 'house **fell through** at the last **minute**' },
          { emoji: '🍺', job: 'bartender', message: 'got **stiffed** by drunk **college kids**' },
          { emoji: '📦', job: 'delivery driver', message: 'package got **stolen** and you got **blamed**' },
          { emoji: '🎨', job: 'graphic designer', message: 'client wanted **37 revisions** for **free**' },
          { emoji: '�', jjob: 'tutor', message: 'kid was too **stupid** to learn **anything**' },
          { emoji: '�', jobb: 'photographer', message: 'bridezilla **hated** all your **photos**' },
          { emoji: '🔧', job: 'mechanic', message: 'broke the car **worse** than before' },
          { emoji: '🏪', job: 'retail worker', message: 'got **yelled at** by a **Karen**' },
          { emoji: '�', jobb: 'pizza delivery', message: 'got **robbed** for the **pizza money**' },
          { emoji: '🧹', job: 'janitor', message: 'slipped on your own **wet floor**' }
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