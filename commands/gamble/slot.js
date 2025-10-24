const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
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
  name: "slot",
  aliases: ['slots', 'spin'],
  description: 'Play the slot machine! Match symbols to win big!',
  usage: `{guildprefix}slot [amount]
{guildprefix}slot 1000
{guildprefix}slot all
{guildprefix}slot half`,
  run: async (client, message, args) => {

    if (!args[0]) {
      return embeds.warn(message, 'You must give an **amount** to bet!');
    }

    try {
      const userService = getService('user');

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;

      if (walletBalance <= 0) {
        return embeds.deny(message, 'You don\'t have any money in your wallet to gamble');
      }

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

      // Deduct the bet amount first using service layer
      await userService.updateWallet(message.author.id, -amount);

      // Slot machine outcomes with exact probabilities for 3-matching symbols
      // WIN RATE: 50% total
      // - 10% → 3 Diamonds (10x payout)
      // - 20% → 3 Cherries (3x payout)
      // - 20% → 3 Strawberries (2x payout)
      // LOSS RATE: 50% total
      // - 10% → 3 Bananas (1x break-even)
      // - 40% → No match (total loss)

      const outcomes = [
        { type: 'triple', emoji: '💎', weight: 10, multiplier: 10 },   // 10% - Triple Diamond
        { type: 'triple', emoji: '🍒', weight: 20, multiplier: 3 },    // 20% - Triple Cherry
        { type: 'triple', emoji: '🍓', weight: 20, multiplier: 2 },    // 20% - Triple Strawberry
        { type: 'triple', emoji: '🍌', weight: 10, multiplier: 1 },    // 10% - Triple Banana (break-even)
        { type: 'nomatch', emoji: null, weight: 40, multiplier: 0 }    // 40% - No match
      ];

      // Create weighted array for outcome selection
      const weightedOutcomes = [];
      outcomes.forEach(outcome => {
        for (let i = 0; i < outcome.weight; i++) {
          weightedOutcomes.push(outcome);
        }
      });

      // All possible symbols for no-match scenarios
      const allSymbols = ['💎', '🍒', '🍓', '🍌'];

      // Create spinning slot machine embed
      const createSpinningEmbed = (slot1, slot2, slot3) => {
        return new EmbedBuilder()
          .setColor('#729bb0')
          .setDescription('### :slot_machine: Slot Machine')
          .addFields(
            { name: '​', value: '​', inline: true },
            { name: `${message.author.username}'s Slots`, value: `\`\`${slot1} | ${slot2} | ${slot3}\`\``, inline: true },
            { name: '​', value: '​', inline: true }
          );
      };

      // Animation symbols for spinning effect
      const spinSymbols = ['🍒', '🍓', '💎', '🍌', '🍊', '🍇', '🍎'];

      // Start with spinning animation
      let currentSlot1 = spinSymbols[0];
      let currentSlot2 = spinSymbols[1];
      let currentSlot3 = spinSymbols[2];

      const slotMessage = await message.channel.send({
        embeds: [createSpinningEmbed(currentSlot1, currentSlot2, currentSlot3)]
      });

      // Smooth spinning animation - only 6 total updates to avoid rate limits
      // Fast spinning (2 seconds) - 4 updates
      for (let i = 0; i < 4; i++) {
        currentSlot1 = spinSymbols[Math.floor(Math.random() * spinSymbols.length)];
        currentSlot2 = spinSymbols[Math.floor(Math.random() * spinSymbols.length)];
        currentSlot3 = spinSymbols[Math.floor(Math.random() * spinSymbols.length)];

        await slotMessage.edit({
          embeds: [createSpinningEmbed(currentSlot1, currentSlot2, currentSlot3)]
        });
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms intervals
      }

      // Slow down (1 second) - 2 updates
      for (let i = 0; i < 2; i++) {
        currentSlot1 = spinSymbols[Math.floor(Math.random() * spinSymbols.length)];
        currentSlot2 = spinSymbols[Math.floor(Math.random() * spinSymbols.length)];
        currentSlot3 = spinSymbols[Math.floor(Math.random() * spinSymbols.length)];

        await slotMessage.edit({
          embeds: [createSpinningEmbed(currentSlot1, currentSlot2, currentSlot3)]
        });
        await new Promise(resolve => setTimeout(resolve, 750)); // Slower intervals
      }

      // Determine outcome first
      const selectedOutcome = weightedOutcomes[Math.floor(Math.random() * weightedOutcomes.length)];

      let finalSlot1, finalSlot2, finalSlot3;

      if (selectedOutcome.type === 'triple') {
        // Generate three matching symbols
        finalSlot1 = finalSlot2 = finalSlot3 = selectedOutcome.emoji;
      } else {
        // Generate non-matching symbols (40% case)
        const shuffledSymbols = [...allSymbols].sort(() => Math.random() - 0.5);
        finalSlot1 = shuffledSymbols[0];
        finalSlot2 = shuffledSymbols[1];
        finalSlot3 = shuffledSymbols[2];

        // Ensure they don't accidentally match
        if (finalSlot1 === finalSlot2 || finalSlot2 === finalSlot3 || finalSlot1 === finalSlot3) {
          finalSlot1 = allSymbols[0];
          finalSlot2 = allSymbols[1];
          finalSlot3 = allSymbols[2];
        }
      }

      // Calculate winnings based on predetermined outcome
      let winnings = 0;
      let resultText = '';

      if (selectedOutcome.type === 'triple') {
        // Apply multiplier for matching symbols
        winnings = Math.floor(amount * selectedOutcome.multiplier);

        if (selectedOutcome.multiplier === 1) {
          // Triple bananas - break even (return bet)
          await userService.updateWallet(message.author.id, winnings);
          await userService.updateGamblingStats(message.author.id, amount, 0, 0); // No net gain/loss
          resultText = 'You **broke even**. Your bet was returned!';
        } else {
          await userService.updateWallet(message.author.id, winnings);
          await userService.updateGamblingStats(message.author.id, amount, winnings - amount, 0);
          resultText = `You **won**! Congratulations on your jackpot!`;
        }
      } else {
        // No match - lose bet (money already deducted at the beginning)
        await userService.updateGamblingStats(message.author.id, amount, 0, amount);
        resultText = 'You **lost**. Better luck next time!';
      }

      // Create final result embed with proper format
      const createFinalEmbed = (slot1, slot2, slot3, result, winAmount) => {
        return new EmbedBuilder()
          .setColor('#729bb0')
          .setDescription('### :slot_machine: Slot Machine')
          .addFields(
            { name: '​', value: '​', inline: true },
            { name: `${message.author.username}'s Slots`, value: `\`\`${slot1} | ${slot2} | ${slot3}\`\``, inline: true },
            { name: '​', value: '​', inline: true },
            { name: '​', value: `> **Bet:** ${formatCurrency(amount)}`, inline: true },
            { name: '​', value: `> **Winss:** ${formatCurrency(winAmount)}`, inline: true },
            { name: '​', value: `>>> ${result}` }
          );
      };

      const finalEmbed = createFinalEmbed(finalSlot1, finalSlot2, finalSlot3, resultText, winnings);
      return slotMessage.edit({ embeds: [finalEmbed] });

    } catch (error) {
      console.error('Error in slot command:', error);
      return embeds.deny(message, 'An error occurred while playing slots');
    }
  }
};
