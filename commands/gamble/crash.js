const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const userCache = require('../../database/cache/models/user');
const { getGuildPrefix } = require('../../utils/commandProcessor');
const { colors } = require('../../config/setup');

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
  name: "crash",
  aliases: ['cr'],
  description: 'Play crash game - cash out before it crashes!',
  usage: `{guildprefix}crash [amount]
{guildprefix}crash 1000
{guildprefix}crash all`,
  run: async(client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'You must give an **amount** to bet!');
    }
    
    try {
      // Check if user has a gambling account
      const hasAccount = await userCache.hasGamblingAccount(message.author.id);
      
      if (!hasAccount) {
        const guildPrefix = await getGuildPrefix(message.guild.id);
        return embeds.deny(message, `You don\'t have a **gambling account** yet! Use \`${guildPrefix}account\` to create one`);
      }
      
      // Get user's gambling data
      const gambling = await userCache.getGamblingData(message.author.id);
      const walletBalance = gambling.wallet || 0;
      
      // Parse amount
      const amount = parseAmount(args[0], walletBalance);
      
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

      // Ensure cache writes are enabled before saving
      const { getCacheManager } = require('../../database/cache/core/CacheManager');
      const cacheManager = getCacheManager();
      if (!cacheManager.userCache.areWritesEnabled()) {
        cacheManager.enableWrites();
      }

      // Deduct the bet amount immediately
      await userCache.updateWalletBalance(message.author.id, -amount);

      // Generate crash point at game start (like real crash games)
      const crashPoint = generateCrashPoint();

      // Game state
      let currentMultiplier = 1.00;
      let gameActive = true;
      let cashedOut = false;
      let winnings = 0;


      // Create initial embed
      const embed = new EmbedBuilder()
        .setColor(colors.info)
        .setTitle(`Player Crash with ${formatCurrency(amount)} 💵`)
        .setDescription('> Click **Cashout** button to cashout')
        .addFields(
          { name: 'Multiplier', value: `${currentMultiplier.toFixed(2)}x`, inline: true },
          { name: 'Winnings', value: `${formatCurrency(Math.floor(amount * currentMultiplier))} 💵`, inline: true }
        );
      
      // Create cashout button
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`crash_cashout_${message.author.id}`)
            .setLabel('Cashout')
            .setStyle(ButtonStyle.Success)
        );
      
      const gameMessage = await message.channel.send({ embeds: [embed], components: [row] });
      
      // Game loop
      const gameInterval = setInterval(async () => {
        if (!gameActive) {
          clearInterval(gameInterval);
          return;
        }

        currentMultiplier += 0.01 + (Math.random() * 0.05); // Increase by 0.01-0.06x each tick

        // Check if we've reached the predetermined crash point
        if (currentMultiplier >= crashPoint) {
          gameActive = false;
          clearInterval(gameInterval);

          if (!cashedOut) {
            // Player lost - crashed before cashing out
            await userCache.updateGamblingStats(message.author.id, amount, 0, amount);

            const loseEmbed = new EmbedBuilder()
              .setColor(colors.error)
              .setTitle(`Player Crash with ${formatCurrency(amount)}`)
              .setDescription(`> Crashed! You lost **${formatCurrency(amount)}** 💵`)
              .addFields(
                { name: 'Multiplier', value: `${currentMultiplier.toFixed(2)}x`, inline: true },
                { name: 'Crash', value: `${crashPoint.toFixed(2)}x`, inline: true },
                { name: 'Losses', value: `${formatCurrency(amount)}`, inline: true }
              );

            await gameMessage.edit({ embeds: [loseEmbed], components: [] });
          }
          return;
        }
        
        // Update embed
        const updatedEmbed = new EmbedBuilder()
          .setColor(colors.info)
          .setTitle(`Player Crash with ${formatCurrency(amount)}`)
          .setDescription(`> Click **Cashout** button to cashout`)
          .addFields(
            { name: 'Multiplier', value: `${currentMultiplier.toFixed(2)}x`, inline: true },
            { name: 'Winnings', value: `${formatCurrency(Math.floor(amount * currentMultiplier))}`, inline: true }
          );
        
        try {
          await gameMessage.edit({ embeds: [updatedEmbed], components: [row] });
        } catch (error) {
          // Message might be deleted, stop the game
          gameActive = false;
          clearInterval(gameInterval);
        }
      }, 2000); // Update every 2 seconds
      
      // Button interaction handler
      const filter = (interaction) => {
        return interaction.customId === `crash_cashout_${message.author.id}` && 
               interaction.user.id === message.author.id;
      };
      
      const collector = gameMessage.createMessageComponentCollector({ 
        filter, 
        time: 60000 // 1 minute timeout
      });
      
      collector.on('collect', async (interaction) => {
        if (!gameActive || cashedOut) {
          await interaction.reply({ content: 'This game has already ended!', flags: MessageFlags.Ephemeral });
          return;
        }
        
        cashedOut = true;
        gameActive = false;
        clearInterval(gameInterval);
        
        winnings = Math.floor(amount * currentMultiplier);
        const profit = winnings - amount;
        
        // Add winnings to wallet
        await userCache.updateWalletBalance(message.author.id, winnings);
        await userCache.updateGamblingStats(message.author.id, amount, profit, 0);
        
        const winEmbed = new EmbedBuilder()
          .setColor(colors.success)
          .setTitle(`Player Crash with ${formatCurrency(amount)}`)
          .setDescription(`> Congratulations! You won **${formatCurrency(profit)}** 💵`)
          .addFields(
            { name: 'Multiplier', value: `${currentMultiplier.toFixed(2)}x`, inline: true },
            { name: 'Crash', value: `${crashPoint.toFixed(2)}x`, inline: true },
            { name: 'Winnings', value: `${formatCurrency(winnings)}`, inline: true }
          );
        
        await interaction.update({ embeds: [winEmbed], components: [] });
      });
      
      collector.on('end', () => {
        if (gameActive) {
          gameActive = false;
          clearInterval(gameInterval);
        }
      });
      
    } catch (error) {
      console.error('Error in crash command:', error);
      return embeds.deny(message, 'An error occurred while playing crash');
    }
  }
};

// Generate a single crash point at game start (like real crash games)
// MUCH HARDER - More early crashes, less big wins
function generateCrashPoint() {
  const random = Math.random();

  if (random < 0.60) {
    // 60% chance: Crash between 1.00x - 1.30x (very early crash)
    return 1.00 + (Math.random() * 0.30);
  } else if (random < 0.80) {
    // 20% chance: Crash between 1.30x - 2.00x (early-medium crash)
    return 1.30 + (Math.random() * 0.70);
  } else if (random < 0.92) {
    // 12% chance: Crash between 2.00x - 4.00x (medium crash)
    return 2.00 + (Math.random() * 2.00);
  } else if (random < 0.98) {
    // 6% chance: Crash between 4.00x - 8.00x (good multiplier)
    return 4.00 + (Math.random() * 4.00);
  } else {
    // 2% chance: Crash between 8.00x - 25.00x (rare jackpot)
    return 8.00 + (Math.random() * 17.00);
  }
}
