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
  name: "crime",
  aliases: ['blacked'],
  description: 'Commit crimes to earn coins with a cooldown',
  syntax: 'crime',
  example: 'crime',
  run: async (client, message, args) => {

    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);

      // Check crime cooldown (20 minutes)
      const workCooldown = 20 * 60 * 1000; // 20 minutes in milliseconds
      const lastWorked = gambling.lastWorked || null;
      const now = Date.now();

      if (lastWorked && (now - lastWorked) < workCooldown) {
        const timeLeft = workCooldown - (now - lastWorked);
        const unixTimestamp = Math.floor((now + timeLeft) / 1000);

        return embeds.warn(message, `You can commit a **crime** again <t:${unixTimestamp}:R>`);
      }

      // Update crime timestamp first
      await userService.updateWorkTimestamp(message.author.id);

      // 80% chance of success, 20% chance of failure (no pay)
      const success = Math.random() < 0.80;

      if (success) {
        // Success - earn money
        const baseEarnings = Math.floor(Math.random() * 4501) + 500; // 500-5000 coins

        // Crimes with different multipliers and success messages
        const jobs = [
          { name: 'shoplifting', multiplier: 0.6, message: 'stole **snacks** from the **corner store**' },
          { name: 'pickpocketing', multiplier: 0.9, message: 'snatched **wallets** from **tourists**' },
          { name: 'car theft', multiplier: 1.5, message: 'stole a **car** and sold it for **parts**' },
          { name: 'bank robbery', multiplier: 1.8, message: 'robbed a **bank** and got **away clean**' },
          { name: 'drug dealing', multiplier: 1.7, message: 'sold **drugs** to **rich kids**' },
          { name: 'identity theft', multiplier: 1.5, message: 'stole someone\'s **identity** and maxed their **cards**' },
          { name: 'burglary', multiplier: 1.4, message: 'broke into a **mansion** and stole **valuables**' },
          { name: 'mugging', multiplier: 0.8, message: 'mugged someone in a **dark alley**' },
          { name: 'scamming', multiplier: 1.6, message: 'scammed **old people** out of their **savings**' },
          { name: 'hacking', multiplier: 1.8, message: 'hacked a **crypto wallet** and drained it' },
          { name: 'extortion', multiplier: 1.4, message: 'extorted **money** from a **business owner**' },
          { name: 'smuggling', multiplier: 1.3, message: 'smuggled **contraband** across the **border**' }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const finalEarnings = Math.floor(baseEarnings * job.multiplier);

        await userService.updateWallet(message.author.id, finalEarnings);

        return embeds.success(message, `You committed **${job.name}** and ${job.message}, earning **${formatCurrency(finalEarnings)}** coins!`);
      } else {
        // Failure - no pay with funny messages
        const failures = [
          { job: 'shoplifting', message: 'got **caught** by **security**' },
          { job: 'pickpocketing', message: 'got **punched** by your **target**' },
          { job: 'car theft', message: 'the car had a **GPS tracker**' },
          { job: 'bank robbery', message: 'the **cops** showed up **too fast**' },
          { job: 'drug dealing', message: 'got **robbed** by your **customers**' },
          { job: 'identity theft', message: 'the person was **broke** anyway' },
          { job: 'burglary', message: 'the **alarm** went off and you **ran**' },
          { job: 'mugging', message: 'picked the wrong **target** and got **beat up**' },
          { job: 'scamming', message: 'they **hung up** on you' },
          { job: 'hacking', message: 'got **traced** and had to **bail**' },
          { job: 'extortion', message: 'they called your **bluff**' },
          { job: 'smuggling', message: 'got **caught** at the **border**' },
          { job: 'street racing', message: 'got **arrested** by the **cops**' },
          { job: 'running a scam', message: 'your **mark** was an **undercover cop**' },
          { job: 'armed robbery', message: 'the **cashier** had a **gun** too' }
        ];

        const failure = failures[Math.floor(Math.random() * failures.length)];

        return embeds.deny(message, `You tried **${failure.job}** but ${failure.message}!`);
      }

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while committing a crime');
    }
  }
};
