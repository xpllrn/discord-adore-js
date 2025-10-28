const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { colors, emojis } = require('../../config/setup');
const { findUser } = require('../../handlers/finder');
const { getService } = require('@services');

module.exports = {
  name: "ttt",
  aliases: ['tictactoe', 'tic'],
  description: `Play tic tac toe with another user or against AI`,
  syntax: 'ttt (user)',
  example: 'ttt @vwsn',
  cooldown: 3000,
  
  run: async (client, message, args) => {
    const userService = getService('user');
    await ensureGuildData(message.guild.id);

    // Handle stats subcommand
    if (args[0] && args[0].toLowerCase() === 'stats') {
      return await showStats(message, userService);
    }

    // Parse opponent
    let opponent = null;
    let isAI = true;

    if (args[0]) {
      const userResult = await findUser(message.guild, args[0], client);
      if (!userResult.found) {
        return embeds.warn(message, userResult.error);
      }
      if (userResult.isGlobal) {
        return embeds.warn(message, 'I can not find that user!');
      }

      opponent = userResult.user;
      const opponentUser = opponent.user ? opponent.user : opponent;

      if (opponentUser.id === message.author.id) {
        return embeds.warn(message, 'You cannot play against yourself!');
      }

      if (opponentUser.bot) {
        return embeds.warn(message, 'You cannot play against bots!');
      }

      // Ensure opponent has proper structure
      opponent = {
        id: opponentUser.id,
        username: opponentUser.username,
        user: opponentUser
      };
      isAI = false;
    }

    // Start the game
    await startGame(message, opponent, isAI, client);
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

async function startGame(message, opponent, isAI, client) {
  // Initialize game state
  const board = Array(9).fill(null);
  
  // Ensure proper player objects with consistent structure
  const players = isAI ? [
    { 
      id: message.author.id, 
      username: message.author.username, 
      user: message.author 
    },
    { 
      id: client.user.id, 
      username: client.user.username, 
      bot: true,
      user: client.user 
    }
  ] : [
    { 
      id: message.author.id, 
      username: message.author.username, 
      user: message.author 
    },
    { 
      id: opponent.id, 
      username: opponent.username, 
      user: opponent 
    }
  ];

  // Randomly decide who goes first
  const firstPlayerIndex = Math.floor(Math.random() * 2);
  let currentPlayerIndex = firstPlayerIndex;

  // Assign X and O with colors (using standard emojis for now)
  const symbols = ['X', 'O'];
  const playerSymbols = {
    [players[0].id]: { symbol: symbols[0], color: 'red' },
    [players[1].id]: { symbol: symbols[1], color: 'green' }
  };

  // Create initial message and buttons
  const gameContent = createGameMessage(board, players, currentPlayerIndex, playerSymbols, null, isAI);
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
  collector.isAI = isAI;

  // If AI goes first, make AI move
  if (isAI && currentPlayerIndex === 1) {
    setTimeout(async () => {
      await makeAIMove(gameMessage, collector);
    }, 1000);
  }

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
      await endGame(interaction, collector.board, collector.players, collector.playerSymbols, winner, isDraw, collector.isAI);
      collector.stop();
      return;
    }

    // Switch turns
    collector.currentPlayerIndex = collector.currentPlayerIndex === 0 ? 1 : 0;

    // Update the game
    const updatedContent = createGameMessage(collector.board, collector.players, collector.currentPlayerIndex, collector.playerSymbols, null, collector.isAI);
    const updatedButtons = createGameButtons(collector.board, false);

    await interaction.update({
      content: updatedContent,
      components: updatedButtons
    });

    // If it's AI's turn, make AI move
    if (collector.isAI && collector.currentPlayerIndex === 1) {
      setTimeout(async () => {
        await makeAIMove(gameMessage, collector);
      }, 1000);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      try {
        const timeoutContent = createGameMessage(collector.board, collector.players, collector.currentPlayerIndex, collector.playerSymbols, 'timeout', collector.isAI);
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

function createGameMessage(board, players, currentPlayerIndex, playerSymbols, gameState, isAI) {
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
    
    const winnerName = winnerIndex !== -1 ?
      (isAI && players[winnerIndex].bot ?
        `**${players[winnerIndex].username}** 🏅` :
        `🏅 **${players[winnerIndex].username}** won!`) :
      'Unknown player won!';
    title = `**${players[0].username}** vs **${players[1].username}** - ${winnerName}`;
  } else if (gameState === 'draw') {
    title = `**${players[0].username}** vs **${players[1].username}** - No one won`;
  } else if (gameState === 'timeout') {
    title = `**${players[0].username}** vs **${players[1].username}** - Game timed out`;
  } else {
    // Game in progress
    const currentPlayer = players[currentPlayerIndex];
    const mention = isAI && currentPlayer.bot ? `**${currentPlayer.username}**` : `<@${currentPlayer.id}>`;
    title = `**${players[0].username}** vs **${players[1].username}** - ${mention} play`;
  }

  // Return only the title
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

async function makeAIMove(gameMessage, collector) {
  // Simple AI logic - try to win, block player, or make random move
  const aiSymbol = collector.playerSymbols[collector.players[1].id].symbol;
  const playerSymbol = collector.playerSymbols[collector.players[0].id].symbol;

  let move = findWinningMove(collector.board, aiSymbol) ||
             findWinningMove(collector.board, playerSymbol) ||
             findRandomMove(collector.board);

  if (move === -1) return; // No moves available

  collector.board[move] = aiSymbol;

  // Check for win or draw
  const winner = checkWinner(collector.board);
  const isDraw = collector.board.every(cell => cell !== null);

  if (winner || isDraw) {
    // Game ended
    const fakeInteraction = {
      update: async (data) => {
        await gameMessage.edit(data);
      }
    };
    await endGame(fakeInteraction, collector.board, collector.players, collector.playerSymbols, winner, isDraw, true);
    collector.stop();
    return;
  }

  // Switch back to player (index 0)
  collector.currentPlayerIndex = 0;

  // Update the game
  const updatedContent = createGameMessage(collector.board, collector.players, collector.currentPlayerIndex, collector.playerSymbols, null, true);
  const updatedButtons = createGameButtons(collector.board, false);

  await gameMessage.edit({
    content: updatedContent,
    components: updatedButtons
  });
}

function findWinningMove(board, symbol) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    const line = [board[a], board[b], board[c]];
    const symbolCount = line.filter(cell => cell === symbol).length;
    const emptyCount = line.filter(cell => cell === null).length;

    if (symbolCount === 2 && emptyCount === 1) {
      // Found a winning/blocking move
      if (board[a] === null) return a;
      if (board[b] === null) return b;
      if (board[c] === null) return c;
    }
  }

  return null;
}

function findRandomMove(board) {
  const availableMoves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      availableMoves.push(i);
    }
  }

  if (availableMoves.length === 0) return -1;

  // Prefer center, then corners, then edges
  const preferredMoves = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  for (const move of preferredMoves) {
    if (availableMoves.includes(move)) {
      return move;
    }
  }

  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

async function endGame(interaction, board, players, playerSymbols, winner, isDraw, isAI) {
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

  // Update database stats for all game outcomes
  try {
    if (isDraw) {
      // Draw game - update both players (or just human player for AI games)
      if (isAI) {
        await userService.updateTicTacToeStats(players[0].id, 'draw');
      } else {
        // Human vs Human draw
        await userService.updateTicTacToeStats(players[0].id, 'draw');
        await userService.updateTicTacToeStats(players[1].id, 'draw');
      }
    } else if (winnerIndex !== -1) {
      // Game with winner
      if (isAI) {
        // Human vs AI game
        if (winnerIndex === 0) {
          // Human won
          await userService.updateTicTacToeStats(players[0].id, 'win');
        } else {
          // AI won
          await userService.updateTicTacToeStats(players[0].id, 'loss');
        }
      } else {
        // Human vs Human game
        await userService.updateTicTacToeStats(players[winnerIndex].id, 'win');
        const loserIndex = winnerIndex === 0 ? 1 : 0;
        await userService.updateTicTacToeStats(players[loserIndex].id, 'loss');
      }
    }
  } catch (error) {
    // Log the error for debugging but don't break game flow
    console.error('❌ TTT: Failed to update stats:', error.message);
  }

  // Create final message and disabled buttons
  const finalContent = createGameMessage(board, players, winnerIndex, playerSymbols, gameState, isAI);
  const disabledButtons = createGameButtons(board, true);

  await interaction.update({
    content: finalContent,
    components: disabledButtons
  });
}