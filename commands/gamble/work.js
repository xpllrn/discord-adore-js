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
          { name: 'Discord moderator', multiplier: 0.5, emoji: '🤓', message: 'worked for **free** like a **basement dweller** (no life)' },
          { name: 'Twitch streamer', multiplier: 1.4, emoji: '💜', message: 'got **raided** by a big streamer and made **bank**' },
          { name: 'YouTuber', multiplier: 1.3, emoji: '📺', message: 'went **viral** and got that **ad revenue**' },
          { name: 'TikTok creator', multiplier: 1.2, emoji: '🎵', message: 'posted **cringe content** but somehow got **paid**' },
          { name: 'NFT artist', multiplier: 1.8, emoji: '🎨', message: 'sold **overpriced JPEGs** to **crypto bros**' },
          { name: 'Crypto trader', multiplier: 1.7, emoji: '📈', message: 'bought the **dip** and **diamond handed** to the moon' },
          { name: 'OnlyFans manager', multiplier: 1.5, emoji: '💼', message: 'managed **e-thots** and took your **cut**' },
          { name: 'Minecraft builder', multiplier: 1.1, emoji: '⛏️', message: 'built **epic structures** and got **commissioned**' },
          { name: 'Discord bot developer', multiplier: 1.6, emoji: '🤖', message: 'coded **dank bots** and got **donations**' },
          { name: 'Reddit karma farmer', multiplier: 0.8, emoji: '🔄', message: 'farmed **fake internet points** for **pennies**' },
          { name: 'Meme lord', multiplier: 1.2, emoji: '😂', message: 'created **viral memes** and got **sponsored**' },
          { name: 'Esports player', multiplier: 1.9, emoji: '🎮', message: '**carried** your team and won the **tournament**' }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const finalEarnings = Math.floor(baseEarnings * job.multiplier);

        await userService.updateWallet(message.author.id, finalEarnings);

        return embeds.success(message, `${job.emoji} You worked as a **${job.name}** and ${job.message}, earning **${formatCurrency(finalEarnings)}** coins!`);
      } else {
        // Failure - no pay with funny messages
        const failures = [
          { emoji: '🤓', job: 'Discord moderator', message: 'got **doxxed** by angry users and **quit** (still no pay lmao)' },
          { emoji: '💜', job: 'Twitch streamer', message: 'got **banned** for saying something **cringe** and lost all revenue' },
          { emoji: '📺', job: 'YouTuber', message: 'got **copyright striked** and **demonetized** by YouTube' },
          { emoji: '🎵', job: 'TikTok creator', message: 'posted **cringe** and got **ratioed** into oblivion' },
          { emoji: '🎨', job: 'NFT artist', message: 'the **crypto market crashed** and your JPEGs became worthless' },
          { emoji: '📈', job: 'crypto trader', message: '**bought high, sold low** like a true **paper hands** loser' },
          { emoji: '💼', job: 'OnlyFans manager', message: 'your **e-thots** found better managers and **ditched** you' },
          { emoji: '⛏️', job: 'Minecraft builder', message: 'a **griefer** destroyed your build and the client **refused to pay**' },
          { emoji: '🤖', job: 'Discord bot developer', message: 'your bot got **rate limited** and **banned** from Discord' },
          { emoji: '🔄', job: 'Reddit karma farmer', message: 'got **shadowbanned** for being a **karma whore**' },
          { emoji: '😂', job: 'meme lord', message: 'your memes were **cringe** and you got **cyberbullied**' },
          { emoji: '🎮', job: 'esports player', message: 'got **destroyed** by a **12-year-old** and rage quit' },
          { emoji: '📱', job: 'app developer', message: 'your app got **rejected** by the app store for being trash' },
          { emoji: '🎪', job: 'content creator', message: 'got **cancelled** on Twitter for an old **cringe** tweet' },
          { emoji: '💸', job: 'dropshipper', message: 'got **exposed** as a scammer and **refunded** everything' }
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