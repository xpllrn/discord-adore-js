const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { colors } = require('../../config/setup');
const logger = require('../../utils/logger');

// Cooldown map to track user cooldowns
const cooldowns = new Map();

// Active games map to track game state
const activeGames = new Map();

// Utility functions
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

// Generate minesweeper board
function generateBoard() {
  const board = Array(4).fill(null).map(() => Array(4).fill(0));
  const mines = new Set();

  // Place 5 random mines
  while (mines.size < 5) {
    const pos = Math.floor(Math.random() * 16);
    mines.add(pos);
  }

  // Set mines on board
  mines.forEach(pos => {
    const row = Math.floor(pos / 4);
    const col = pos % 4;
    board[row][col] = -1; // -1 represents a mine
  });

  // Calculate numbers for non-mine cells
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row][col] === -1) continue;

      let count = 0;
      // Check all 8 adjacent cells
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < 4 && newCol >= 0 && newCol < 4) {
            if (board[newRow][newCol] === -1) count++;
          }
        }
      }
      board[row][col] = count;
    }
  }

  return board;
}

module.exports = {
  name: "mine",
  aliases: ['minesweeper', 'mines'],
  description: 'Play minesweeper! Reveal safe tiles to win, hit a mine and lose!',
  syntax: 'mine (amount)',
  example: 'mine 999',
  run: async (client, message, args) => {
    // Check cooldown
    const cooldownTime = 5000; // 5 seconds
    const now = Date.now();
    const userId = message.author.id;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownTime;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        return embeds.warn(message, `Please wait **${timeLeft}** seconds before playing minesweeper again`);
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

      // Get user's gambling data
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

      // Deduct the bet amount
      await userService.updateWallet(message.author.id, -amount);

      // Generate board and create game state
      const board = generateBoard();
      const gameId = `${message.author.id}_${Date.now()}`;
      const gameState = {
        board: board,
        revealed: Array(4).fill(null).map(() => Array(4).fill(false)),
        gameActive: true,
        safeRevealed: 0,
        totalSafe: 11,
        amount: amount,
        userId: message.author.id
      };

      // Store game state
      activeGames.set(gameId, gameState);

      // Create buttons
      const createButtons = (state, gameLost = false) => {
        const rows = [];
        for (let row = 0; row < 4; row++) {
          const actionRow = new ActionRowBuilder();
          for (let col = 0; col < 4; col++) {
            const customId = `mine_${gameId}_${row}_${col}`;

            if (state.revealed[row][col]) {
              // Revealed tile - show content and disable
              const isMine = state.board[row][col] === -1;
              const button = new ButtonBuilder()
                .setCustomId(customId + '_d')
                .setStyle(gameLost && isMine ? ButtonStyle.Danger : ButtonStyle.Secondary)
                .setDisabled(true);

              if (isMine) {
                button.setEmoji('💣').setLabel('​');
              } else if (state.board[row][col] === 0) {
                button.setLabel('​'); // Blank for zero
              } else {
                button.setLabel(state.board[row][col].toString());
              }

              actionRow.addComponents(button);
            } else {
              // Unrevealed tile - blank and clickable
              const button = new ButtonBuilder()
                .setCustomId(customId)
                .setStyle(ButtonStyle.Secondary)
                .setLabel('​');

              actionRow.addComponents(button);
            }
          }
          rows.push(actionRow);
        }
        return rows;
      };

      // Create game embed
      const createGameEmbed = (state, status = 'playing') => {
        const embed = new EmbedBuilder()
          .setColor(status === 'lost' ? colors.error : status === 'won' ? colors.success : colors.info)
          .setTitle('💣 Minesweeper')
          .setDescription(`> **Bet**: ${formatCurrency(state.amount)}\n> **Safe Tiles**: \`${state.safeRevealed}/${state.totalSafe}\` & **Mines**: \`5\``);

        if (status === 'lost') {
          embed.addFields({ name: 'Result', value: '💥 You hit a mine! You lost your bet.' });
        } else if (status === 'won') {
          const winnings = Math.floor(state.amount * 3);
          embed.addFields({ name: 'Result', value: `🎉 You won **${formatCurrency(winnings)}** coins!` });
        }

        return embed;
      };

      const gameMessage = await message.channel.send({
        embeds: [createGameEmbed(gameState)],
        components: createButtons(gameState)
      });

      // Button collector
      const filter = (interaction) => {
        return interaction.customId.startsWith(`mine_${gameId}_`) &&
          !interaction.customId.endsWith('_d') &&
          interaction.user.id === message.author.id;
      };

      const collector = gameMessage.createMessageComponentCollector({
        filter,
        time: 120000 // 2 minutes
      });

      collector.on('collect', async (interaction) => {
        const state = activeGames.get(gameId);

        if (!state || !state.gameActive) {
          return; // Ignore if game ended
        }

        // Parse the button position
        const parts = interaction.customId.split('_');
        const row = parseInt(parts[3]);
        const col = parseInt(parts[4]);

        // Check if already revealed (shouldn't happen with filter, but safety check)
        if (state.revealed[row][col]) {
          return;
        }

        // Mark as revealed
        state.revealed[row][col] = true;

        // Check if mine
        if (state.board[row][col] === -1) {
          state.gameActive = false;
          collector.stop();

          // Reveal all mines
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
              if (state.board[r][c] === -1) {
                state.revealed[r][c] = true;
              }
            }
          }

          await userService.updateGamblingStats(message.author.id, state.amount, 0, state.amount);

          await interaction.update({
            embeds: [createGameEmbed(state, 'lost')],
            components: createButtons(state, true)
          });

          // Clean up game state
          activeGames.delete(gameId);
        } else {
          state.safeRevealed++;

          // Check if won (all safe tiles revealed)
          if (state.safeRevealed >= state.totalSafe) {
            state.gameActive = false;
            collector.stop();

            const winnings = Math.floor(state.amount * 3);
            await userService.updateWallet(message.author.id, winnings);
            await userService.updateGamblingStats(message.author.id, state.amount, winnings - state.amount, 0);

            // Reveal all tiles
            for (let r = 0; r < 4; r++) {
              for (let c = 0; c < 4; c++) {
                state.revealed[r][c] = true;
              }
            }

            await interaction.update({
              embeds: [createGameEmbed(state, 'won')],
              components: createButtons(state)
            });

            // Clean up game state
            activeGames.delete(gameId);
          } else {
            await interaction.update({
              embeds: [createGameEmbed(state, 'playing')],
              components: createButtons(state)
            });
          }
        }
      });

      collector.on('end', () => {
        // Clean up game state after timeout
        if (activeGames.has(gameId)) {
          activeGames.delete(gameId);
        }
      });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while playing minesweeper');
    }
  }
};
