const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { getGuildPrefix } = require('../../utils/commandProcessor');
const logger = require('../../utils/logger');

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

  // Handle "k" notation (e.g., 3k = 3000, 500k50 = 500050, 100k500 = 100500)
  if (cleanInput.includes('k')) {
    const parts = cleanInput.split('k');
    if (parts.length === 2) {
      const beforeK = parseFloat(parts[0]);
      const afterK = parseFloat(parts[1]) || 0;
      
      if (isNaN(beforeK) || beforeK < 0) return null;
      if (isNaN(afterK) || afterK < 0) return null;
      
      const amount = Math.floor(beforeK * 1000 + afterK);
      return amount;
    }
  }

  const amount = parseInt(cleanInput);
  if (isNaN(amount) || amount < 0) return null;
  return amount;
}



module.exports = {
  name: "slot",
  aliases: ['slots', 'spin'],
  description: 'Play the slot machine! Match symbols to win big!',
  syntax: 'slot (amount)',
  example: 'slot 999',
  run: async (client, message, args) => {
    // Check cooldown
    const cooldownTime = 5000; // 5 seconds
    const now = Date.now();
    const userId = message.author.id;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownTime;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        return embeds.warn(message, `Please wait **${timeLeft}** seconds before playing slots again`);
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

      // Slot machine outcomes with updated probabilities
      // 💎 Triple Diamond: 2% chance, 10x multiplier
      // 💸 Triple Money Bag: 5% chance, 5x multiplier  
      // 🍒 Triple Cherry: 15% chance, 3x multiplier
      // 🍓 Triple Strawberry: 23% chance, 2x multiplier
      // 🍌 Triple Banana: 25% chance, 1x multiplier (break-even)
      // ❌ No Match: 30% chance, 0x multiplier

      const outcomes = [
        { type: 'triple', emoji: '💎', weight: 2, multiplier: 10 },    // 2% - Triple Diamond (JACKPOT!)
        { type: 'triple', emoji: '💸', weight: 5, multiplier: 5 },     // 5% - Triple Money Bag
        { type: 'triple', emoji: '🍒', weight: 15, multiplier: 3 },    // 15% - Triple Cherry
        { type: 'triple', emoji: '🍓', weight: 23, multiplier: 2 },    // 23% - Triple Strawberry
        { type: 'triple', emoji: '🍌', weight: 25, multiplier: 1 },    // 25% - Triple Banana (break-even)
        { type: 'nomatch', emoji: null, weight: 30, multiplier: 0 }    // 30% - No match
      ];

      // Create weighted array for outcome selection
      const weightedOutcomes = [];
      outcomes.forEach(outcome => {
        for (let i = 0; i < outcome.weight; i++) {
          weightedOutcomes.push(outcome);
        }
      });

      // All possible symbols for no-match scenarios
      const allSymbols = ['💎', '💸', '🍒', '🍓', '🍌'];

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
      const spinSymbols = ['🍒', '🍓', '💎', '💸', '🍌', '🍊', '🍇', '🍎'];

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
      let nearMissMessage = '';

      if (selectedOutcome.type === 'triple') {
        // Generate three matching symbols
        finalSlot1 = finalSlot2 = finalSlot3 = selectedOutcome.emoji;
      } else {
        // Generate non-matching symbols (30% case)
        // 30% chance to create "near miss" effect (2 matching symbols)
        const createNearMiss = Math.random() < 0.30;

        if (createNearMiss) {
          // Pick a random high-value symbol for near-miss
          const nearMissSymbols = ['💎', '💸', '🍒'];
          const nearMissSymbol = nearMissSymbols[Math.floor(Math.random() * nearMissSymbols.length)];
          
          // Create 2 matching + 1 different
          const differentSymbol = allSymbols.find(s => s !== nearMissSymbol);
          
          // Randomly place the different symbol (position 1, 2, or 3)
          const differentPosition = Math.floor(Math.random() * 3);
          
          if (differentPosition === 0) {
            finalSlot1 = differentSymbol;
            finalSlot2 = nearMissSymbol;
            finalSlot3 = nearMissSymbol;
          } else if (differentPosition === 1) {
            finalSlot1 = nearMissSymbol;
            finalSlot2 = differentSymbol;
            finalSlot3 = nearMissSymbol;
          } else {
            finalSlot1 = nearMissSymbol;
            finalSlot2 = nearMissSymbol;
            finalSlot3 = differentSymbol;
          }

          // Near-miss logic kept but message removed
        } else {
          // Regular no-match (no near-miss)
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
      }

      // Calculate winnings based on predetermined outcome
      let winnings = 0;
      let resultText = '';
      let taxAmount = 0;

      if (selectedOutcome.type === 'triple') {
        // Calculate gross winnings (payout)
        const grossWinnings = Math.floor(amount * selectedOutcome.multiplier);
        
        if (selectedOutcome.multiplier === 1) {
          // Triple bananas - break even (return bet, no tax)
          winnings = grossWinnings;
          await userService.updateWallet(message.author.id, winnings);
          await userService.updateGamblingStats(message.author.id, amount, 0, 0); // No net gain/loss
          resultText = 'You broke even. Your bet was returned!';
        } else {
          // Calculate profit and tax for winning outcomes
          const profit = grossWinnings - amount; // profit = payout - bet
          const taxRate = Math.random() * 0.15 + 0.05; // Random tax between 5% and 20%
          taxAmount = Math.floor(profit * taxRate);
          
          // Final winnings after tax
          winnings = grossWinnings - taxAmount;
          
          await userService.updateWallet(message.author.id, winnings);
          await userService.updateGamblingStats(message.author.id, amount, winnings - amount, 0);
          
          if (selectedOutcome.multiplier === 10) {
            resultText = `JACKPOT! You won ${formatCurrency(profit)} coins but paid ${formatCurrency(taxAmount)} in taxes (${Math.floor(taxRate * 100)}%). Net profit: ${formatCurrency(winnings - amount)} coins! 💎💎💎`;
          } else {
            resultText = `You won ${formatCurrency(profit)} coins but paid ${formatCurrency(taxAmount)} in taxes (${Math.floor(taxRate * 100)}%). Net profit: ${formatCurrency(winnings - amount)} coins!`;
          }
        }
      } else {
        // No match - lose bet (money already deducted at the beginning)
        await userService.updateGamblingStats(message.author.id, amount, 0, amount);
        resultText = 'You lost loser. Better luck next time!';
      }

      // Create final result embed with proper format
      const createFinalEmbed = (slot1, slot2, slot3, result, winAmount, tax = 0) => {
        const embed = new EmbedBuilder()
          .setColor('#729bb0')
          .setDescription('### :slot_machine: Slot Machine')
          .addFields(
            { name: '​', value: '​', inline: true },
            { name: `${message.author.username}'s Slots`, value: `\`\`${slot1} | ${slot2} | ${slot3}\`\``, inline: true },
            { name: '​', value: '​', inline: true },
            { name: '​', value: `> **Bet:** ${formatCurrency(amount)}`, inline: true },
            { name: '​', value: `> **Payout:** ${formatCurrency(winAmount)}`, inline: true }
          );
        
        if (tax > 0) {
          embed.addFields({ name: '​', value: `> **Tax:** ${formatCurrency(tax)}`, inline: true });
        }
        
        embed.setFooter({ text: result });
        return embed;
      };

      const finalEmbed = createFinalEmbed(finalSlot1, finalSlot2, finalSlot3, resultText, winnings, taxAmount);
      return slotMessage.edit({ embeds: [finalEmbed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while playing slots');
    }
  }
};
