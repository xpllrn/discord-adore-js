const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

// Cooldown map to track user cooldowns
const cooldowns = new Map();

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
  usage: `{guildprefix}mine [amount]
{guildprefix}mine 500
{guildprefix}mine all`,
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

      // Generate board
      const board = generateBoard();
      const revealed = Array(4).fill(null).map(() => Array(4).fill(false));
      let gameActive = true;
      let safeRevealed = 0;
      const totalSafe = 11; // 16 tiles - 5 mines = 11 safe tiles

      // Create buttons
      const createButtons = () => {
        const rows = [];
        for (let row = 0; row < 4; row++) {
          const actionRow = new ActionRowBuilder();
          for (let col = 0; col < 4; col++) {
            const customId = `mine_${message.author.id}_${row}_${col}`;
            const button = new ButtonBuilder()
              .setCustomId(customId)
              .setStyle(ButtonStyle.Secondary);

            if (revealed[row][col]) {
              button.setDisabled(true);
              if (board[row][col] === -1) {
                button.setEmoji('💣');
              } else if (board[row][col] === 0) {
                button.setLabel('​'); // Zero-width space for blank
              } else {
                button.setLabel(board[row][col].toString());
              }
            } else {
              button.setLabel('​'); // Blank unrevealed button
            }

            actionRow.addComponents(button);
          }
          rows.push(actionRow);
        }
        return rows;
      };

      // Create embed
      const createEmbed = (status = 'playing') => {
        const embed = new EmbedBuilder()
          .setColor(status === 'lost' ? '#fc6464' : status === 'won' ? '#a4ec7c' : '#729bb0')
          .setTitle('💣 Minesweeper')
          .setDescription(`**Bet:** ${formatCurrency(amount)} coins\n**Safe Tiles:** ${safeRevealed}/${totalSafe}\n**Mines:** 5`);

        if (status === 'lost') {
          embed.addFields({ name: 'Result', value: '💥 You hit a mine! You lost your bet.' });
        } else if (status === 'won') {
          const winnings = Math.floor(amount * 2);
          embed.addFields({ name: 'Result', value: `🎉 You won **${formatCurrency(winnings)}** coins!` });
        } else {
          embed.addFields({ name: 'Status', value: 'Click tiles to reveal them. Avoid the mines!' });
        }

        return embed;
      };

      const gameMessage = await message.channel.send({
        embeds: [createEmbed()],
        components: createButtons()
      });

      // Button collector
      const filter = (interaction) => {
        return interaction.customId.startsWith(`mine_${message.author.id}_`) &&
               interaction.user.id === message.author.id;
      };

      const collector = gameMessage.createMessageComponentCollector({
        filter,
        time: 120000 // 2 minutes
      });

      collector.on('collect', async (interaction) => {
        if (!gameActive) {
          await interaction.reply({ content: 'This game has already ended!', ephemeral: true });
          return;
        }

        const [, , , rowStr, colStr] = interaction.customId.split('_');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);

        if (revealed[row][col]) {
          await interaction.reply({ content: 'This tile is already revealed!', ephemeral: true });
          return;
        }

        revealed[row][col] = true;

        // Check if mine
        if (board[row][col] === -1) {
          gameActive = false;
          collector.stop();

          // Reveal all mines
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
              if (board[r][c] === -1) {
                revealed[r][c] = true;
              }
            }
          }

          await userService.updateGamblingStats(message.author.id, amount, 0, amount);

          await interaction.update({
            embeds: [createEmbed('lost')],
            components: createButtons()
          });
        } else {
          safeRevealed++;

          // Check if won (all safe tiles revealed)
          if (safeRevealed >= totalSafe) {
            gameActive = false;
            collector.stop();

            const winnings = Math.floor(amount * 2);
            await userService.updateWallet(message.author.id, winnings);
            await userService.updateGamblingStats(message.author.id, amount, winnings - amount, 0);

            // Reveal all tiles
            for (let r = 0; r < 4; r++) {
              for (let c = 0; c < 4; c++) {
                revealed[r][c] = true;
              }
            }

            await interaction.update({
              embeds: [createEmbed('won')],
              components: createButtons()
            });
          } else {
            await interaction.update({
              embeds: [createEmbed()],
              components: createButtons()
            });
          }
        }
      });

      collector.on('end', () => {
        if (gameActive) {
          gameActive = false;
        }
      });

    } catch (error) {
      console.error('Error in mine command:', error);
      return embeds.deny(message, 'An error occurred while playing minesweeper');
    }
  }
};
