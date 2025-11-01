const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const { ensureGuildData } = require('../../database');
const { colors, emojis } = require('../../config/setup');
const { findUser } = require('../../handlers/finder');
const { getService } = require('@services');

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

module.exports = {
  name: "ttt",
  aliases: ['tictactoe', 'tic'],
  description: `Play tic tac toe with another user with optional betting`,
  syntax: 'ttt @user (amount)',
  example: 'ttt @vwsn\nttt @vwsn 3000',
  cooldown: 3000,
  
  run: async (client, message, args) => {
    const userService = getService('user');
    await ensureGuildData(message.guild.id);

    // Handle stats subcommand
    if (args[0] && args[0].toLowerCase() === 'stats') {
      return await showStats(message, userService);
    }

    // Must have an opponent
    if (!args[0]) {
      return embeds.warn(message, 'You must specify an opponent to play against!\nUsage: `ttt @user (amount)`');
    }

    // Parse opponent
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.warn(message, userResult.error);
    }
    if (userResult.isGlobal) {
      return embeds.warn(message, 'I can not find that user!');
    }

    const opponent = userResult.user;
    const opponentUser = opponent.user ? opponent.user : opponent;

    if (opponentUser.id === message.author.id) {
      return embeds.warn(message, 'You cannot play against yourself!');
    }

    // Can't play against the bot (specific check first)
    if (opponentUser.id === message.guild.members.me.id) {
      return message.channel.send('Leave me alone!');
    }

    if (opponentUser.bot) {
      return embeds.warn(message, 'You cannot play against bots!');
    }

    // Parse betting amount if provided
    let betAmount = 0;
    let isBetting = false;

    if (args[1]) {
      const authorGambling = await userService.getGamblingData(message.author.id);
      const authorBalance = authorGambling.wallet || 0;

      betAmount = parseAmount(args[1], authorBalance);

      if (betAmount === null || betAmount <= 0) {
        return embeds.deny(message, 'Please provide a valid betting amount');
      }

      if (betAmount > authorBalance) {
        return embeds.deny(message, `You only have **${formatCurrency(authorBalance)}** coins in your **wallet**`);
      }

      // Check opponent's balance
      const opponentGambling = await userService.getGamblingData(opponentUser.id);
      const opponentBalance = opponentGambling.wallet || 0;

      if (betAmount > opponentBalance) {
        return embeds.deny(message, `**${opponentUser.username}** only has **${formatCurrency(opponentBalance)}** coins in their wallet`);
      }

      isBetting = true;
    }

    // Create game invitation
    if (isBetting) {
      const confirmationText = `**${opponentUser.username}**, **${message.author.username}** wants to play **Tic-Tac-Toe** with you!\n\n💰 **Bet Amount:** ${formatCurrency(betAmount)} coins\n🏆 **Winner takes:** ${formatCurrency(betAmount * 2)} coins\n\nDo you accept this challenge?`;
      
      // Send confirmation to opponent
      const confirmEmbed = embeds.createWarn(message, confirmationText);
      confirmEmbed.setDescription(`${emojis.warn} <@${opponentUser.id}>: ${confirmationText}`);

      const createButtons = (disabled = false) => {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('ttt_accept')
              .setLabel('Accept')
              .setStyle(ButtonStyle.Success)
              .setDisabled(disabled),
            new ButtonBuilder()
              .setCustomId('ttt_decline')
              .setLabel('Decline')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(disabled)
          );
        return row;
      };

      const inviteMessage = await message.channel.send({
        embeds: [confirmEmbed],
        components: [createButtons()]
      });

      // Create collector for opponent's response
      const collector = inviteMessage.createMessageComponentCollector({
        time: 60000 // 1 minute timeout
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== opponentUser.id) {
          const warnEmbed = embeds.createWarn(message, 'This invitation is not for you!');
          warnEmbed.setDescription(`${emojis.warn} <@${interaction.user.id}>: This invitation is not for you!`);

          return interaction.reply({
            embeds: [warnEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        if (interaction.customId === 'ttt_accept') {
          // Check balances again before starting
          const authorGambling = await userService.getGamblingData(message.author.id);
          const opponentGambling = await userService.getGamblingData(opponentUser.id);

          if ((authorGambling.wallet || 0) < betAmount) {
            await interaction.update({
              embeds: [embeds.createDeny(message, `**${message.author.username}** no longer has enough coins to bet`)],
              components: []
            });
            return collector.stop();
          }

          if ((opponentGambling.wallet || 0) < betAmount) {
            await interaction.update({
              embeds: [embeds.createDeny(message, `**${opponentUser.username}** no longer has enough coins to bet`)],
              components: []
            });
            return collector.stop();
          }

          // Deduct bet amounts from both players
          await userService.updateWallet(message.author.id, -betAmount);
          await userService.updateWallet(opponentUser.id, -betAmount);

          await interaction.update({
            embeds: [embeds.createSuccess(message, `**${opponentUser.username}** accepted the challenge! Starting game...`)],
            components: []
          });

          // Start the betting game
          await startGame(message, opponent, false, client, betAmount, inviteMessage);
          collector.stop();

        } else if (interaction.customId === 'ttt_decline') {
          await interaction.update({
            embeds: [embeds.createDeny(message, `**${opponentUser.username}** declined the challenge`)],
            components: []
          });
          collector.stop();
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          try {
            await inviteMessage.edit({
              embeds: [embeds.createDeny(message, 'Game invitation timed out')],
              components: []
            });
          } catch (error) {
            // Ignore edit errors
          }
        }
      });

    } else {
      // No betting - start game immediately
      await startGame(message, opponent, false, client, 0);
    }
  }
};

async function showStats(message, userService) {
  try {
    const stats = await userService.getTicTacToeStats(message.author.id);

    // Check if user has played any games
    const totalMatches = stats.wins + stats.losses + stats.draws;
    const hasPlayedGames = totalMatches > 0;

    if (!hasPlayedGames) {
      return embeds.warn(message, `You haven't played any games yet!`);
    }

    const embed = new EmbedBuilder()
      .setColor(colors.info)
      .setTitle('Tic-Tac-Toe Statistics')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setDescription(`**${message.author.username}'s** game statistics`)
      .addFields(
        { name: 'Wins', value: stats.wins.toString(), inline: true },
        { name: 'Losses', value: stats.losses.toString(), inline: true },
        { name: 'Draws', value: stats.draws.toString(), inline: true },
        { name: 'Total Games', value: totalMatches.toString(), inline: true }
      );

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`❌ TTT Stats: Error retrieving stats for user ${message.author.id}:`, error);
    return embeds.warn(message, 'Failed to retrieve your statistics. Please try again later.');
  }
}

async function startGame(message, opponent, isAI, client, betAmount = 0, inviteMessage = null) {
  // Initialize game state
  const board = Array(9).fill(null);
  
  // Ensure proper player objects with consistent structure
  // Handle both GuildMember and User objects
  const opponentUser = opponent.user ? opponent.user : opponent;
  const players = [
    { 
      id: message.author.id, 
      username: message.author.username, 
      user: message.author 
    },
    { 
      id: opponentUser.id, 
      username: opponentUser.username, 
      user: opponentUser 
    }
  ];

  // Randomly decide who goes first
  const firstPlayerIndex = Math.floor(Math.random() * 2);
  let currentPlayerIndex = firstPlayerIndex;

  // Assign X and O with colors
  const symbols = ['X', 'O'];
  const playerSymbols = {
    [players[0].id]: { symbol: symbols[0], color: 'red' },
    [players[1].id]: { symbol: symbols[1], color: 'green' }
  };

  // Create initial message and buttons
  const gameContent = createGameMessage(board, players, currentPlayerIndex, playerSymbols, null, false, betAmount);
  const gameButtons = createGameButtons(board, false);

  const gameMessage = await message.channel.send({
    content: gameContent,
    components: gameButtons
  });

  // Create collector for button interactions
  const collector = gameMessage.createMessageComponentCollector({
    time: 300000 // 5 minutes timeout
  });

  // Store game state on collector
  collector.currentPlayerIndex = currentPlayerIndex;
  collector.board = board;
  collector.players = players;
  collector.playerSymbols = playerSymbols;
  collector.betAmount = betAmount;

  collector.on('collect', async (interaction) => {
    // Check if it's the correct player's turn
    if (interaction.user.id !== collector.players[collector.currentPlayerIndex].id) {
      const embed = new EmbedBuilder()
        .setColor(colors.warn)
        .setDescription(`${emojis.warn} It's not your turn! It's **${collector.players[collector.currentPlayerIndex].username}**'s turn.`);

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    }

    const position = parseInt(interaction.customId.split('_')[1]);

    // Make the move
    collector.board[position] = collector.playerSymbols[interaction.user.id].symbol;

    // Check for win or draw
    const winner = checkWinner(collector.board);
    const isDraw = collector.board.every(cell => cell !== null);

    if (winner || isDraw) {
      // Game ended
      await endGame(interaction, collector.board, collector.players, collector.playerSymbols, winner, isDraw, false, collector.betAmount);
      collector.stop();
      return;
    }

    // Switch turns
    collector.currentPlayerIndex = collector.currentPlayerIndex === 0 ? 1 : 0;

    // Update the game
    const updatedContent = createGameMessage(collector.board, collector.players, collector.currentPlayerIndex, collector.playerSymbols, null, false, collector.betAmount);
    const updatedButtons = createGameButtons(collector.board, false);

    await interaction.update({
      content: updatedContent,
      components: updatedButtons
    });
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      try {
        // Return bet amounts if game times out
        if (betAmount > 0) {
          const userService = getService('user');
          await userService.updateWallet(players[0].id, betAmount);
          await userService.updateWallet(players[1].id, betAmount);
        }

        const timeoutContent = createGameMessage(collector.board, collector.players, collector.currentPlayerIndex, collector.playerSymbols, 'timeout', false, betAmount);
        const disabledButtons = createGameButtons(collector.board, true);

        await gameMessage.edit({
          content: timeoutContent,
          components: disabledButtons
        });
      } catch (error) {
        // Ignore edit errors
      }
    }
  });
}

function createGameMessage(board, players, currentPlayerIndex, playerSymbols, gameState, isAI, betAmount = 0) {
  // Create title based on game state
  let title = '';
  if (gameState === 'win') {
    // Find the actual winner by checking which symbol won
    let winnerIndex = -1;
    const winner = checkWinner(board);
    if (winner) {
      for (let i = 0; i < players.length; i++) {
        if (playerSymbols[players[i].id].symbol === winner) {
          winnerIndex = i;
          break;
        }
      }
    }
    
    const winnerName = winnerIndex !== -1 ? `🏅 **${players[winnerIndex].username}** won!` : 'Unknown player won!';
    title = `**${players[0].username}** vs **${players[1].username}** - ${winnerName}`;
    
    if (betAmount > 0 && winnerIndex !== -1) {
      title += `\n💰 **${players[winnerIndex].username}** wins **${formatCurrency(betAmount * 2)}** coins!`;
    }
  } else if (gameState === 'draw') {
    title = `**${players[0].username}** vs **${players[1].username}** - No one won`;
    if (betAmount > 0) {
      title += `\n💰 Bets returned to both players`;
    }
  } else if (gameState === 'timeout') {
    title = `**${players[0].username}** vs **${players[1].username}** - Game timed out`;
    if (betAmount > 0) {
      title += `\n💰 Bets returned to both players`;
    }
  } else {
    // Game in progress
    const currentPlayer = players[currentPlayerIndex];
    title = `**${players[0].username}** vs **${players[1].username}** - <@${currentPlayer.id}> play`;
    if (betAmount > 0) {
      title += `\n💰 **Bet:** ${formatCurrency(betAmount)} each | **Prize:** ${formatCurrency(betAmount * 2)}`;
    }
  }

  return title;
}

function createGameButtons(board, disabled) {
  const rows = [];

  for (let i = 0; i < 9; i += 3) {
    const row = new ActionRowBuilder();

    for (let j = 0; j < 3; j++) {
      const position = i + j;
      const button = new ButtonBuilder()
        .setCustomId(`ttt_${position}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || board[position] !== null);

      if (board[position]) {
        button.setLabel(board[position]);
        if (board[position] === 'X') {
          button.setStyle(ButtonStyle.Danger);
        } else if (board[position] === 'O') {
          button.setStyle(ButtonStyle.Success);
        }
      } else {
        button.setLabel('\u200b');
      }

      row.addComponents(button);
    }

    rows.push(row);
  }

  return rows;
}

function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

async function endGame(interaction, board, players, playerSymbols, winner, isDraw, isAI, betAmount = 0) {
  const { getService } = require('@services');
  const userService = getService('user');
  
  let gameState = 'draw';
  let winnerIndex = -1;

  if (winner) {
    gameState = 'win';
    // Find winner index
    for (let i = 0; i < players.length; i++) {
      if (playerSymbols[players[i].id].symbol === winner) {
        winnerIndex = i;
        break;
      }
    }
  }

  // Handle betting payouts
  if (betAmount > 0) {
    try {
      if (isDraw) {
        // Return bets to both players
        await userService.updateWallet(players[0].id, betAmount);
        await userService.updateWallet(players[1].id, betAmount);
      } else if (winnerIndex !== -1) {
        // Winner gets both bets (2x their bet)
        await userService.updateWallet(players[winnerIndex].id, betAmount * 2);
        
        // Update gambling stats
        const winnings = betAmount; // Net winnings (they get back their bet + opponent's bet)
        await userService.updateGamblingStats(players[winnerIndex].id, betAmount, winnings, 0);
        
        // Loser loses their bet
        const loserIndex = winnerIndex === 0 ? 1 : 0;
        await userService.updateGamblingStats(players[loserIndex].id, betAmount, 0, betAmount);
      }
    } catch (error) {
      console.error('❌ TTT: Failed to handle betting payouts:', error.message);
    }
  }

  // Update database stats for all game outcomes
  try {
    if (isDraw) {
      // Draw game - update both players
      await userService.updateTicTacToeStats(players[0].id, 'draw');
      await userService.updateTicTacToeStats(players[1].id, 'draw');
    } else if (winnerIndex !== -1) {
      // Game with winner
      await userService.updateTicTacToeStats(players[winnerIndex].id, 'win');
      const loserIndex = winnerIndex === 0 ? 1 : 0;
      await userService.updateTicTacToeStats(players[loserIndex].id, 'loss');
    }
  } catch (error) {
    // Log the error for debugging but don't break game flow
    console.error('❌ TTT: Failed to update stats:', error.message);
  }

  // Create final message and disabled buttons
  const finalContent = createGameMessage(board, players, winnerIndex, playerSymbols, gameState, isAI, betAmount);
  const disabledButtons = createGameButtons(board, true);

  await interaction.update({
    content: finalContent,
    components: disabledButtons
  });
}