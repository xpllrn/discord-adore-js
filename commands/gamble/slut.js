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
          { name: 'cam model', multiplier: 1.2, emoji: '📹', message: 'streamed for some **lonely viewers** and **made bank**' },
          { name: 'exotic dancer', multiplier: 1.3, emoji: '💃', message: 'danced at the local strip club and got **showered with tips**' },
          { name: 'escort', multiplier: 1.5, emoji: '💋', message: 'provided companionship services to a **wealthy client**' },
          { name: 'phone operator', multiplier: 1.1, emoji: '📞', message: 'answered some **spicy phone calls** and earned good money' },
          { name: 'OnlyFans creator', multiplier: 1.4, emoji: '📱', message: 'posted some **exclusive content** and got **tons of subscribers**' },
          { name: 'sugar baby', multiplier: 1.6, emoji: '💎', message: 'spent time with a **generous benefactor** who **spoiled you**' },
          { name: 'adult film actor', multiplier: 1.7, emoji: '🎬', message: 'starred in an adult production and **nailed every scene**' },
          { name: 'massage therapist', multiplier: 1.2, emoji: '💆', message: 'gave some **"special" massages** and received **generous tips**' },
          { name: 'dominatrix', multiplier: 1.5, emoji: '🖤', message: 'dominated some willing clients who paid **premium rates**' },
          { name: 'fetish model', multiplier: 1.3, emoji: '👠', message: 'modeled for some **unique requests** and got **paid handsomely**' }
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
          { emoji: '🚔', message: 'The **police raided** your operation and you had to pay **bail**' },
          { emoji: '🤢', message: 'Your client took one look at your **saggy tits** and asked for a **refund**' },
          { emoji: '😷', message: 'You caught an **STD** and had to pay for **expensive treatment**' },
          { emoji: '🏃‍♀️', message: 'Your **pimp** found out you were **holding out** on him and took your cut' },
          { emoji: '💸', message: 'Your **OnlyFans got banned** and you lost all your **subscribers**' },
          { emoji: '🤡', message: 'You showed up to work looking like a **clown** and got **fired**' },
          { emoji: '🦶', message: 'Your feet were so **crusty** that even the **foot fetish guys** ran away' },
          { emoji: '🧄', message: 'Your **breath was so bad** that clients **paid you to leave**' },
          { emoji: '🐷', message: 'You were so **ugly** that the client paid extra to **keep the lights off**' },
          { emoji: '💩', message: 'You **shit yourself** during work and had to pay for **cleanup**' },
          { emoji: '🤮', message: 'Your performance was so **bad** that the client **threw up and sued you**' },
          { emoji: '🔥', message: 'You accidentally **set the brothel on fire** and had to pay **damages**' }
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