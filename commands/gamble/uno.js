const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors, emojis } = require('../../config/setup');
const gameManager = require('../../utils/unoGameManager');
const { GAME_STATUS } = require('../../utils/unoGameState');
const UnoUI = require('../../utils/unoUI');
const { getService } = require('@services');

// Helper function for interaction replies
function replyWithMessage(interaction, message, type = 'info') {
  const icons = {
    success: '✅',
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️'
  };
  return interaction.reply({
    content: `${icons[type]} ${message}`,
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  name: "uno",
  aliases: ['unocard', 'cards'],
  description: 'Play UNO with other users in your server',
  syntax: 'uno [start|end|stats]',
  example: 'uno start\nuno end\nuno stats',
  cooldown: 3000,
  
  run: async (client, message, args) => {
    const subcommand = args[0]?.toLowerCase();
    
    try {
      switch (subcommand) {
        case 'start':
          return await handleStart(message);
        case 'end':
        case 'stop':
          return await handleEnd(message);
        case 'stats':
          return await handleStats(message);
        default:
          return await handleDefault(message);
      }
    } catch (error) {
      console.error('Error in UNO command:', error);
      return embeds.deny(message, 'An error occurred while processing the UNO command');
    }
  }
};

/**
 * Handle default UNO command (show help or current game status)
 */
async function handleDefault(message) {
  const activeGame = gameManager.getActiveGame(message.channel.id);
  
  if (activeGame) {
    // Show current game status
    return await showGameStatus(message, activeGame);
  }
  
  // Show help
  const helpEmbed = new EmbedBuilder()
    .setColor(colors.info)
    .setTitle('🃏 UNO Game Commands')
    .setDescription('Play UNO with other users in your server!')
    .addFields(
      { name: '`uno start`', value: 'Start a new UNO game', inline: true },
      { name: '`uno end`', value: 'End the current game', inline: true },
      { name: '`uno stats`', value: 'View your UNO statistics', inline: true }
    )
    .setFooter({ text: 'Use uno start to begin a new game!' });
  
  return message.channel.send({ embeds: [helpEmbed] });
}

/**
 * Handle starting a new UNO game
 */
async function handleStart(message) {
  console.log(`[UNO] Creating game in channel ${message.channel.id} by ${message.author.username}`);
  
  const result = gameManager.createGame(
    message.channel.id,
    message.author.id,
    message.author.username
  );
  
  console.log(`[UNO] Create game result:`, result);
  
  if (!result.success) {
    return embeds.warn(message, result.message);
  }
  
  // Create lobby embed and buttons
  const lobbyEmbed = UnoUI.createLobbyEmbed(result.game);
  const lobbyButtons = UnoUI.createLobbyButtons(result.game);
  
  console.log(`[UNO] Game created with ${result.game.players.length} players`);
  
  const gameMessage = await message.channel.send({
    embeds: [lobbyEmbed],
    components: [lobbyButtons]
  });
  
  // Set up button collector
  setupLobbyCollector(gameMessage, result.game);
  
  return gameMessage;
}

/**
 * Handle ending a UNO game
 */
async function handleEnd(message) {
  const activeGame = gameManager.getActiveGame(message.channel.id);
  
  if (!activeGame) {
    return embeds.warn(message, 'No active game in this channel!');
  }
  
  // Check if user is host or has permission to end game
  if (activeGame.hostId !== message.author.id) {
    return embeds.warn(message, 'Only the host can end the game!');
  }
  
  const result = gameManager.endGame(message.channel.id, 'manual');
  
  if (result.success) {
    return embeds.success(message, 'Game ended successfully!');
  } else {
    return embeds.deny(message, result.message);
  }
}

/**
 * Handle showing UNO statistics
 */
async function handleStats(message) {
  try {
    const userService = getService('user');
    const stats = await userService.getUnoStats(message.author.id);
    
    if (!stats || stats.gamesPlayed === 0) {
      return embeds.info(message, 'You haven\'t played any UNO games yet!');
    }
    
    const winRate = stats.gamesPlayed > 0 ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1) : 0;
    
    const statsEmbed = new EmbedBuilder()
      .setColor(colors.info)
      .setTitle('🃏 Your UNO Statistics')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Games Played', value: stats.gamesPlayed.toString(), inline: true },
        { name: 'Games Won', value: stats.gamesWon.toString(), inline: true },
        { name: 'Win Rate', value: `${winRate}%`, inline: true },
        { name: 'Cards Played', value: stats.totalCardsPlayed.toString(), inline: true },
        { name: 'Fastest Win', value: stats.fastestWin ? `${Math.floor(stats.fastestWin / 1000)}s` : 'N/A', inline: true },
        { name: 'Longest Game', value: stats.longestGame ? `${Math.floor(stats.longestGame / 60000)}m` : 'N/A', inline: true }
      );
    
    if (stats.specialCardsPlayed) {
      const specialCards = [
        `Skip: ${stats.specialCardsPlayed.skip || 0}`,
        `Reverse: ${stats.specialCardsPlayed.reverse || 0}`,
        `Draw 2: ${stats.specialCardsPlayed.draw2 || 0}`,
        `Wild: ${stats.specialCardsPlayed.wild || 0}`,
        `Wild +4: ${stats.specialCardsPlayed.wildDraw4 || 0}`
      ].join('\n');
      
      statsEmbed.addFields({ name: 'Special Cards Played', value: specialCards, inline: false });
    }
    
    return message.channel.send({ embeds: [statsEmbed] });
  } catch (error) {
    console.error('Error getting UNO stats:', error);
    return embeds.deny(message, 'Could not retrieve your statistics');
  }
}

/**
 * Show current game status
 */
async function showGameStatus(message, game) {
  if (game.status === GAME_STATUS.LOBBY) {
    const lobbyEmbed = UnoUI.createLobbyEmbed(game);
    return message.channel.send({ embeds: [lobbyEmbed] });
  } else if (game.status === GAME_STATUS.ACTIVE) {
    const gameEmbed = UnoUI.createGameEmbed(game);
    const gameButtons = UnoUI.createGameButtons(game);
    return message.channel.send({ embeds: [gameEmbed], components: gameButtons });
  } else {
    return embeds.info(message, `Game status: ${game.status}`);
  }
}



/**
 * Set up lobby button collector
 */
function setupLobbyCollector(message, game) {
  const collector = message.createMessageComponentCollector({
    time: 300000 // 5 minutes
  });
  
  collector.on('collect', async (interaction) => {
    try {
      await handleLobbyInteraction(interaction, message, game);
    } catch (error) {
      console.error('Error handling lobby interaction:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while processing your request',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        console.error('Error sending error reply:', replyError);
      }
    }
  });
  
  collector.on('end', () => {
    // Disable buttons when collector ends
    const disabledButtons = UnoUI.createLobbyButtons(game);
    disabledButtons.components.forEach(button => button.setDisabled(true));
    
    message.edit({ components: [disabledButtons] }).catch(() => {});
  });
}

/**
 * Handle lobby interactions
 */
async function handleLobbyInteraction(interaction, message, game) {
  const activeGame = gameManager.getActiveGame(message.channel.id);
  
  if (!activeGame || activeGame.gameId !== game.gameId) {
    return interaction.reply({
      content: '⚠️ This game is no longer active',
      flags: MessageFlags.Ephemeral
    });
  }
  
  switch (interaction.customId) {
    case 'uno_play':
      await handlePlayButton(interaction, message);
      break;
    case 'uno_join':
      await handleJoinButton(interaction, message);
      break;
  }
}

/**
 * Handle play button (force start)
 */
async function handlePlayButton(interaction, message) {
  console.log(`[UNO] Play button clicked by ${interaction.user.username} in channel ${message.channel.id}`);
  
  const game = gameManager.getActiveGame(message.channel.id);
  if (game) {
    console.log(`[UNO] Current game status: ${game.status}, Players: ${game.players.length}`);
  }
  
  const result = gameManager.startGame(message.channel.id, interaction.user.id);
  
  console.log(`[UNO] Start game result:`, result);
  
  if (!result.success) {
    return interaction.reply({
      content: `⚠️ ${result.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
  
  // Update message to show active game
  const gameEmbed = UnoUI.createGameEmbed(result.game);
  const gameButtons = UnoUI.createGameButtons(result.game, interaction.user.id);
  
  await interaction.update({
    embeds: [gameEmbed],
    components: gameButtons
  });
  
  // Set up game collector
  setupGameCollector(message, result.game);
}

/**
 * Handle join button
 */
async function handleJoinButton(interaction, message) {
  console.log(`[UNO] Join button clicked by ${interaction.user.username} in channel ${message.channel.id}`);
  
  const result = gameManager.joinGame(
    message.channel.id,
    interaction.user.id,
    interaction.user.username
  );
  
  console.log(`[UNO] Join game result:`, result);
  
  if (!result.success) {
    return interaction.reply({
      content: `⚠️ ${result.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
  
  // Update lobby embed
  const lobbyEmbed = UnoUI.createLobbyEmbed(result.game);
  const lobbyButtons = UnoUI.createLobbyButtons(result.game);
  
  await interaction.update({
    embeds: [lobbyEmbed],
    components: [lobbyButtons]
  });
}



/**
 * Set up game button collector
 */
function setupGameCollector(message, game) {
  const collector = message.createMessageComponentCollector({
    filter: (i) => i.message.id === message.id, // Only collect interactions from this message
    time: 1800000 // 30 minutes
  });
  
  collector.on('collect', async (interaction) => {
    try {
      await handleGameInteraction(interaction, message);
    } catch (error) {
      console.error('Error handling game interaction:', error);
      await interaction.reply({
        content: '❌ An error occurred',
        flags: MessageFlags.Ephemeral
      });
    }
  });
  
  collector.on('end', () => {
    // Disable buttons when collector ends
    const disabledButtons = UnoUI.createGameButtons(game);
    disabledButtons.forEach(row => {
      row.components.forEach(button => button.setDisabled(true));
    });
    
    message.edit({ components: disabledButtons }).catch(() => {});
  });
}

/**
 * Handle game interactions
 */
async function handleGameInteraction(interaction, message) {
  const game = gameManager.getActiveGame(message.channel.id);
  
  if (!game || game.status !== GAME_STATUS.ACTIVE) {
    return interaction.reply({
      content: '⚠️ No active game found',
      flags: MessageFlags.Ephemeral
    });
  }
  
  switch (interaction.customId) {
    case 'uno_cards':
      await handleCardsButton(interaction, game);
      break;
    case 'uno_choose':
      await handleChooseButton(interaction, game);
      break;
    case 'uno_exit':
      await handleExitButton(interaction, message);
      break;
  }
}

/**
 * Handle cards button (show player's hand)
 */
async function handleCardsButton(interaction, game) {
  const player = game.getPlayer(interaction.user.id);
  
  if (!player) {
    return interaction.reply({
      content: '⚠️ You\'re not in this game',
      flags: MessageFlags.Ephemeral
    });
  }
  
  const handDisplay = player.hand.length > 0 
    ? player.hand.map(card => card.getDisplayString()).join(' ')
    : 'No cards';
  
  const cardsEmbed = UnoUI.createPlayerHandEmbed(player, game);
  
  return interaction.reply({
    embeds: [cardsEmbed],
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Handle choose button (card selection)
 */
async function handleChooseButton(interaction, game) {
  const player = game.getPlayer(interaction.user.id);
  
  if (!player) {
    return interaction.reply({
      content: '⚠️ You\'re not in this game',
      flags: MessageFlags.Ephemeral
    });
  }
  
  const currentPlayer = game.getCurrentPlayer();
  if (!currentPlayer || currentPlayer.userId !== interaction.user.id) {
    return interaction.reply({
      content: '⚠️ It\'s not your turn',
      flags: MessageFlags.Ephemeral
    });
  }
  
  const playableCards = player.getPlayableCards(game.currentCard, { wildColor: game.wildColor });
  
  if (playableCards.length === 0) {
    // No playable cards, must draw
    const result = gameManager.drawCards(game.channelId, interaction.user.id, 1);
    
    if (result.success) {
      return interaction.reply({
        content: `ℹ️ Drew 1 card. ${result.cards[0].getDisplayString()}`,
        flags: MessageFlags.Ephemeral
      });
    } else {
      return interaction.reply({
        content: '❌ Could not draw card',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  // Create card selection dropdown
  const row = UnoUI.createCardSelectionDropdown(playableCards, true);
  
  const dropdownMessage = await interaction.reply({
    content: 'Choose a card to play:',
    components: [row],
    flags: MessageFlags.Ephemeral,
    fetchReply: true
  });
  
  // Set up collector for this specific dropdown
  const dropdownCollector = dropdownMessage.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 60000, // 1 minute timeout
    max: 1 // Only one selection
  });
  
  dropdownCollector.on('collect', async (dropdownInteraction) => {
    try {
      await handleCardSelection(dropdownInteraction, game);
      
      // Send new game message after card play
      const updatedGame = gameManager.getActiveGame(game.channelId);
      if (updatedGame) {
        await UnoUI.sendGameMessage(interaction.channel, updatedGame);
      }
    } catch (error) {
      console.error('Error handling card selection:', error);
      await dropdownInteraction.reply({
        content: '❌ An error occurred while playing the card',
        flags: MessageFlags.Ephemeral
      });
    }
  });
  
  dropdownCollector.on('end', () => {
    // Disable the dropdown after timeout
    const disabledRow = UnoUI.createCardSelectionDropdown(playableCards, true);
    disabledRow.components[0].setDisabled(true);
    
    dropdownMessage.edit({ components: [disabledRow] }).catch(() => {});
  });
}

/**
 * Handle exit button
 */
async function handleExitButton(interaction, message) {
  const { embed, components } = UnoUI.createConfirmationEmbed(
    'Confirm Exit',
    'Are you sure you want to leave the game?',
    'uno_exit_confirm',
    'uno_exit_cancel'
  );
  
  const exitCollector = interaction.channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && (i.customId === 'uno_exit_confirm' || i.customId === 'uno_exit_cancel'),
    time: 30000,
    max: 1
  });
  
  exitCollector.on('collect', async (exitInteraction) => {
    if (exitInteraction.customId === 'uno_exit_confirm') {
      const result = gameManager.leaveGame(message.channel.id, interaction.user.id);
      
      if (result.success) {
        await exitInteraction.update({
          content: `✅ ${result.message}`,
          embeds: [],
          components: []
        });
        
        // Send new game message if game still exists
        if (!result.gameEnded) {
          const game = gameManager.getActiveGame(message.channel.id);
          if (game) {
            await UnoUI.sendGameMessage(message.channel, game);
          }
        }
      } else {
        await exitInteraction.update({
          content: `❌ ${result.message}`,
          embeds: [],
          components: []
        });
      }
    } else {
      await exitInteraction.update({
        content: 'ℹ️ Exit cancelled',
        embeds: [],
        components: []
      });
    }
  });
  
  return interaction.reply({
    embeds: [embed],
    components: components,
    flags: MessageFlags.Ephemeral
  });
}



/**
 * Handle card selection from dropdown
 */
async function handleCardSelection(interaction, game) {
  const selectedValue = interaction.values[0];
  
  if (selectedValue === 'draw_card') {
    return handleDrawFromDropdown(interaction, game);
  }
  
  // Find the selected card
  const player = game.getPlayer(interaction.user.id);
  if (!player) {
    return replyWithMessage(interaction, 'You\'re not in this game', 'warn');
  }
  
  // Find the selected card by ID
  const selectedCard = player.hand.find(card => card.id === selectedValue);
  if (!selectedCard) {
    console.log('Card selection debug:', {
      selectedValue,
      playerHandIds: player.hand.map(c => c.id),
      playerHandCards: player.hand.map(c => c.getDisplayString())
    });
    return replyWithMessage(interaction, 'Card not found in your hand', 'error');
  }
  
  // Check if it's a wild card that needs color selection
  if (selectedCard.type === 'wild') {
    const colorSelection = UnoUI.createWildColorSelection();
    
    const colorMessage = await interaction.reply({
      content: `You selected: ${selectedCard.getDisplayString()}\nChoose a color:`,
      components: [colorSelection],
      flags: MessageFlags.Ephemeral,
      fetchReply: true
    });
    
    // Set up collector for color selection
    const colorCollector = colorMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 30000, // 30 seconds timeout
      max: 1
    });
    
    colorCollector.on('collect', async (colorInteraction) => {
      const selectedColor = colorInteraction.values[0];
      
      // Play the wild card with the selected color
      const result = gameManager.playCard(game.channelId, interaction.user.id, selectedCard.id, selectedColor);
      
      if (result.success) {
        let message = `${selectedCard.getDisplayString()} (${selectedColor})`;
        
        // Add effect messages
        if (result.effects) {
          if (result.effects.includes('wild_draw_four')) {
            message += `\n🌈 Next player draws ${result.drawCount} cards!`;
          }
          if (result.effects.includes('game_won')) {
            message += '\n🏆 **YOU WON THE GAME!**';
          }
        }
        
        await colorInteraction.update({
          content: `✅ ${message}`,
          components: []
        });
        
        // Send new game message
        const updatedGame = gameManager.getActiveGame(game.channelId);
        if (updatedGame) {
          await UnoUI.sendGameMessage(colorInteraction.channel, updatedGame);
        }
      } else {
        await colorInteraction.update({
          content: `❌ ${result.message}`,
          components: []
        });
      }
    });
    
    return; // Exit early for wild cards
  }
  
  // Play the card
  const result = gameManager.playCard(game.channelId, interaction.user.id, selectedCard.id);
  
  if (result.success) {
    let message = `${selectedCard.getDisplayString()}`;
    
    // Add effect messages
    if (result.effects) {
      if (result.effects.includes('skip_next')) {
        message += '\n🚫 Next player is skipped!';
      }
      if (result.effects.includes('reverse')) {
        message += '\n🔄 Direction reversed!';
      }
      if (result.effects.includes('draw_two')) {
        message += `\n➕ Next player draws ${result.drawCount} cards!`;
      }
      if (result.effects.includes('wild_draw_four')) {
        message += `\n🌈 Next player draws ${result.drawCount} cards!`;
      }
      if (result.effects.includes('game_won')) {
        message += '\n🏆 **YOU WON THE GAME!**';
      }
    }
    
    await replyWithMessage(interaction, message, 'success');
    
    // Send new game message
    const updatedGame = gameManager.getActiveGame(game.channelId);
    if (updatedGame) {
      await UnoUI.sendGameMessage(interaction.channel, updatedGame);
    }
  } else {
    return replyWithMessage(interaction, result.message, 'error');
  }
}

/**
 * Handle wild color selection
 */
async function handleWildColorSelection(interaction, game) {
  const selectedColor = interaction.values[0];
  
  // Get the last played card (should be a wild card)
  const lastCard = game.discardPile[game.discardPile.length - 1];
  
  if (!lastCard || lastCard.type !== 'wild') {
    return replyWithMessage(interaction, 'No wild card to set color for', 'error');
  }
  
  // Set the wild color
  game.wildColor = selectedColor;
  game.currentCard.color = selectedColor;
  
  await replyWithMessage(interaction, `Wild color set to ${UnoUI.getColorEmoji(selectedColor)} ${selectedColor}`, 'success');
  
  // Update main game message
  const gameMessage = await interaction.channel.messages.fetch(interaction.message.id);
  await UnoUI.updateGameMessage(gameMessage, game);
}

/**
 * Handle draw from dropdown
 */
async function handleDrawFromDropdown(interaction, game) {
  const result = gameManager.drawCards(game.channelId, interaction.user.id, 1);
  
  if (result.success) {
    const drawnCard = result.cards[0];
    
    await interaction.reply({
      content: `✅ Drew: ${drawnCard.getDisplayString()}`,
      flags: MessageFlags.Ephemeral
    });
    
    // Send new game message
    const updatedGame = gameManager.getActiveGame(game.channelId);
    if (updatedGame) {
      await UnoUI.sendGameMessage(interaction.channel, updatedGame);
    }
  } else {
    return interaction.reply({
      content: '❌ Could not draw card',
      flags: MessageFlags.Ephemeral
    });
  }
}

