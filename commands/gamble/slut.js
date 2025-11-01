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

      // Check slut cooldown (20 minutes) - separate from work command
      const slutCooldown = 20 * 60 * 1000; // 20 minutes in milliseconds
      const lastSlut = gambling.lastSlut || null;
      const now = Date.now();

      if (lastSlut && (now - lastSlut) < slutCooldown) {
        const timeLeft = slutCooldown - (now - lastSlut);
        const unixTimestamp = Math.floor((now + timeLeft) / 1000);

        return embeds.warn(message, `You can **slut** again <t:${unixTimestamp}:R>`);
      }

      // Update slut timestamp first
      await userService.setUserField(message.author.id, 'Gambling.lastSlut', now);

      // 70% chance of success, 30% chance of penalty
      const success = Math.random() < 0.70;

      if (success) {
        // Success - earn money
        const baseEarnings = Math.floor(Math.random() * 9001) + 1000; // 1000-10000 coins

        // Adult entertainment jobs with different multipliers and funny messages
        const jobs = [
          { name: 'Twitch thot', multiplier: 1.4, emoji: '💜', message: 'showed **cleavage** and **milked simps**' },
          { name: 'OnlyFans whore', multiplier: 1.5, emoji: '📱', message: 'posted **nudes** and got **coomer subs**' },
          { name: 'Discord kitten', multiplier: 2.0, emoji: '🐱', message: 'meowed for **daddy** and got **nitro**' },
          { name: 'E-kitten', multiplier: 1.3, emoji: '🎮', message: 'sold **bathwater** to **incels**' },
          { name: 'TikTok slut', multiplier: 1.2, emoji: '💃', message: 'danced like a **whore** for **zoomers**' },
          { name: 'Snap premium', multiplier: 1.6, emoji: '👻', message: 'sold **nudes** to **horny teens**' },
          { name: 'Insta thot', multiplier: 1.3, emoji: '📸', message: 'posted **ass pics** for **simps**' },
          { name: 'VTuber', multiplier: 1.7, emoji: '🎭', message: 'used **anime avatar** to milk **weebs**' },
          { name: 'Feet seller', multiplier: 1.1, emoji: '🦶', message: 'sold **toe pics** to **foot freaks**' },
          { name: 'Mommy ASMR', multiplier: 1.4, emoji: '🎧', message: 'whispered to **lonely virgins**' },
          { name: 'Patreon thot', multiplier: 1.5, emoji: '💸', message: 'teased **content** for **monthly cucks**' },
          { name: 'Femboy', multiplier: 1.8, emoji: '🏳️‍⚧️', message: 'tapped **straight guys** and got **paid**' }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const finalEarnings = Math.floor(baseEarnings * job.multiplier);

        await userService.updateWallet(message.author.id, finalEarnings);

        return embeds.success(message, `${job.emoji} You worked as a **${job.name}** and ${job.message}, earning **${formatCurrency(finalEarnings)}** coins!`);
      } else {
        // Failure - lose money with funny offensive messages
        const walletBalance = gambling.wallet || 0;
        const bankBalance = gambling.bank || 0;
        const totalBalance = walletBalance + bankBalance;

        // Calculate penalty (1-10% of total balance, max 10,000)
        const penaltyPercentage = Math.random() * 0.09 + 0.01; // 1-10%
        let penalty = Math.floor(totalBalance * penaltyPercentage);
        penalty = Math.min(penalty, 10000); // Cap at 10,000
        penalty = Math.min(penalty, walletBalance); // Can't lose more than wallet

        if (penalty > 0) {
          await userService.updateWallet(message.author.id, -penalty);
        }

        // Funny failure messages
        const failures = [
          { emoji: '🚔', message: 'Got **raided** by feds and paid **bail**' },
          { emoji: '🤢', message: 'Client saw your **saggy tits** and wanted a **refund**' },
          { emoji: '😷', message: 'Caught **STDs** and paid for **treatment**' },
          { emoji: '🏃‍♀️', message: 'Your **pimp** found out you were **holding out**' },
          { emoji: '💸', message: 'Got **banned** from OnlyFans for being **too ugly**' },
          { emoji: '🤡', message: 'Showed up looking like a **clown** and got **fired**' },
          { emoji: '🦶', message: 'Your **crusty feet** scared away the **foot freaks**' },
          { emoji: '🧄', message: 'Your **breath** was so bad clients **paid you to leave**' },
          { emoji: '🐷', message: 'So **ugly** they paid extra to **keep lights off**' },
          { emoji: '💩', message: '**Shit yourself** and paid for **cleanup**' },
          { emoji: '🤮', message: 'Performance so **bad** the client **threw up**' },
          { emoji: '🔥', message: 'Set the **brothel on fire** like a **retard**' }
        ];

        const failure = failures[Math.floor(Math.random() * failures.length)];

        return embeds.deny(message, `${failure.emoji} ${failure.message}${penalty > 0 ? ` and lost **${formatCurrency(penalty)}** coins!` : ' but you were too broke to pay anything!'}`);
      }

    } catch (error) {
      console.error('Error in slut command:', error);
      return embeds.deny(message, 'An error occurred while working');
    }
  }
};