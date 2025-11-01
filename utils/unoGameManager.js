/**
 * UNO Game Manager
 * Manages multiple game sessions across different channels
 */

const { UnoGameState, GAME_STATUS } = require('./unoGameState');

/**
 * Singleton Game Manager class
 */
class UnoGameManager {
  constructor() {
    this.games = new Map(); // channelId -> UnoGameState
    this.playerGames = new Map(); // userId -> channelId
    this.cleanupInterval = null;
    
    // Start cleanup interval (every 5 minutes)
    this.startCleanupInterval();
  }

  /**
   * Create a new game in a channel
   * @param {string} channelId - Discord channel ID
   * @param {string} hostId - Host user ID
   * @param {string} hostUsername - Host username
   * @returns {Object} Result with success status and game or error message
   */
  createGame(channelId, hostId, hostUsername) {
    // Check if game already exists in channel
    if (this.games.has(channelId)) {
      return {
        success: false,
        message: 'A game is already active in this channel!'
      };
    }

    // Check if host is already in another game
    if (this.playerGames.has(hostId)) {
      const existingChannelId = this.playerGames.get(hostId);
      return {
        success: false,
        message: `You're already in a game in <#${existingChannelId}>!`
      };
    }

    // Create new game
    const game = new UnoGameState(channelId, hostId, hostUsername);
    this.games.set(channelId, game);
    this.playerGames.set(hostId, channelId);

    // Set lobby timer (2 minutes auto-start)
    this.setLobbyTimer(channelId);

    return {
      success: true,
      game: game,
      message: 'Game created successfully!'
    };
  }

  /**
   * Join an existing game
   * @param {string} channelId - Discord channel ID
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @returns {Object} Result with success status and message
   */
  joinGame(channelId, userId, username) {
    const game = this.games.get(channelId);
    
    if (!game) {
      return {
        success: false,
        message: 'No active game in this channel!'
      };
    }

    if (game.status !== GAME_STATUS.LOBBY) {
      return {
        success: false,
        message: 'Game has already started!'
      };
    }

    // Check if player is already in another game
    if (this.playerGames.has(userId)) {
      const existingChannelId = this.playerGames.get(userId);
      if (existingChannelId !== channelId) {
        return {
          success: false,
          message: `You're already in a game in <#${existingChannelId}>!`
        };
      } else {
        return {
          success: false,
          message: 'You\'re already in this game!'
        };
      }
    }

    // Try to add player to game
    const added = game.addPlayer(userId, username);
    
    if (!added) {
      return {
        success: false,
        message: 'Could not join game (may be full)!'
      };
    }

    this.playerGames.set(userId, channelId);

    return {
      success: true,
      game: game,
      message: `${username} joined the game!`
    };
  }

  /**
   * Leave a game
   * @param {string} channelId - Discord channel ID
   * @param {string} userId - User ID
   * @returns {Object} Result with success status and message
   */
  leaveGame(channelId, userId) {
    const game = this.games.get(channelId);
    
    if (!game) {
      return {
        success: false,
        message: 'No active game in this channel!'
      };
    }

    const removed = game.removePlayer(userId);
    
    if (!removed) {
      return {
        success: false,
        message: 'You\'re not in this game!'
      };
    }

    this.playerGames.delete(userId);

    // If no players left or host left in lobby, end game
    if (game.players.length === 0 || (game.status === GAME_STATUS.LOBBY && game.players.length === 1)) {
      this.endGame(channelId, 'no_players');
      return {
        success: true,
        gameEnded: true,
        message: 'Game ended due to insufficient players.'
      };
    }

    return {
      success: true,
      game: game,
      message: 'Left the game successfully!'
    };
  }

  /**
   * Start a game
   * @param {string} channelId - Discord channel ID
   * @param {string} userId - User ID (must be host or have permission)
   * @returns {Object} Result with success status and message
   */
  startGame(channelId, userId) {
    const game = this.games.get(channelId);
    
    if (!game) {
      return {
        success: false,
        message: 'No active game in this channel!'
      };
    }

    if (game.status !== GAME_STATUS.LOBBY) {
      return {
        success: false,
        message: 'Game has already started!'
      };
    }

    // Check if user is host (for now, only host can start)
    if (game.hostId !== userId) {
      return {
        success: false,
        message: 'Only the host can start the game!'
      };
    }

    const started = game.startGame();
    
    if (!started) {
      return {
        success: false,
        message: 'Could not start game (need at least 2 players)!'
      };
    }

    // Clear lobby timer and set game timer
    this.clearLobbyTimer(channelId);
    this.setGameTimer(channelId);
    this.setTurnTimer(channelId);

    return {
      success: true,
      game: game,
      message: 'Game started!'
    };
  }

  /**
   * End a game
   * @param {string} channelId - Discord channel ID
   * @param {string} reason - Reason for ending
   * @returns {Object} Result with success status and message
   */
  endGame(channelId, reason = 'manual') {
    const game = this.games.get(channelId);
    
    if (!game) {
      return {
        success: false,
        message: 'No active game in this channel!'
      };
    }

    // Remove all players from player games map
    game.players.forEach(player => {
      this.playerGames.delete(player.userId);
    });

    // Clear all timers
    this.clearAllTimers(channelId);

    // End the game
    game.endGame(reason);

    // Remove from games map
    this.games.delete(channelId);

    return {
      success: true,
      game: game,
      message: `Game ended (${reason})`
    };
  }

  /**
   * Get active game in channel
   * @param {string} channelId - Discord channel ID
   * @returns {UnoGameState|null} Game state or null
   */
  getActiveGame(channelId) {
    return this.games.get(channelId) || null;
  }

  /**
   * Get game that a player is in
   * @param {string} userId - User ID
   * @returns {UnoGameState|null} Game state or null
   */
  getPlayerGame(userId) {
    const channelId = this.playerGames.get(userId);
    return channelId ? this.games.get(channelId) : null;
  }

  /**
   * Play a card in a game
   * @param {string} channelId - Discord channel ID
   * @param {string} userId - User ID
   * @param {string} cardId - Card ID
   * @param {string} chosenColor - Color for wild cards
   * @returns {Object} Play result
   */
  playCard(channelId, userId, cardId, chosenColor = null) {
    const game = this.games.get(channelId);
    
    if (!game) {
      return {
        success: false,
        message: 'No active game in this channel!'
      };
    }

    if (game.status !== GAME_STATUS.ACTIVE) {
      return {
        success: false,
        message: 'Game is not active!'
      };
    }

    const result = game.playCard(userId, cardId, chosenColor);
    
    // Reset turn timer if successful
    if (result.success) {
      this.setTurnTimer(channelId);
      
      // Check if game ended
      if (result.effects && result.effects.includes('game_won')) {
        this.endGame(channelId, 'completed');
      }
    }

    return result;
  }

  /**
   * Draw cards for a player
   * @param {string} channelId - Discord channel ID
   * @param {string} userId - User ID
   * @param {number} count - Number of cards to draw
   * @returns {Object} Draw result
   */
  drawCards(channelId, userId, count = 1) {
    const game = this.games.get(channelId);
    
    if (!game) {
      return {
        success: false,
        message: 'No active game in this channel!'
      };
    }

    if (game.status !== GAME_STATUS.ACTIVE) {
      return {
        success: false,
        message: 'Game is not active!'
      };
    }

    const drawnCards = game.drawCards(userId, count);
    
    if (drawnCards.length > 0) {
      // Reset turn timer
      this.setTurnTimer(channelId);
      
      return {
        success: true,
        cards: drawnCards,
        message: `Drew ${drawnCards.length} card(s)`
      };
    }

    return {
      success: false,
      message: 'Could not draw cards!'
    };
  }

  /**
   * Call UNO for a player
   * @param {string} channelId - Discord channel ID
   * @param {string} userId - User ID
   * @returns {Object} UNO call result
   */
  callUno(channelId, userId) {
    const game = this.games.get(channelId);
    
    if (!game) {
      return {
        success: false,
        message: 'No active game in this channel!'
      };
    }

    const success = game.callUno(userId);
    
    return {
      success: success,
      message: success ? 'UNO called!' : 'Could not call UNO!'
    };
  }

  /**
   * Handle player timeout (auto-draw and advance turn)
   * @param {string} channelId - Discord channel ID
   */
  handlePlayerTimeout(channelId) {
    const game = this.games.get(channelId);
    
    if (!game || game.status !== GAME_STATUS.ACTIVE) {
      return;
    }

    const currentPlayer = game.getCurrentPlayer();
    if (!currentPlayer) {
      return;
    }

    // Auto-draw a card for the player
    game.drawCards(currentPlayer.userId, 1);
    
    // Advance to next turn
    game.advanceTurn();
    
    // Set new turn timer
    this.setTurnTimer(channelId);
  }

  /**
   * Set lobby timer (auto-start after 2 minutes)
   * @param {string} channelId - Discord channel ID
   */
  setLobbyTimer(channelId) {
    const game = this.games.get(channelId);
    if (!game) return;

    this.clearLobbyTimer(channelId);
    
    game.timers.lobbyTimer = setTimeout(() => {
      // Auto-start if enough players
      if (game.players.length >= 2 && game.status === GAME_STATUS.LOBBY) {
        this.startGame(channelId, game.hostId);
      }
    }, 120000); // 2 minutes
  }

  /**
   * Set turn timer (120 seconds per turn)
   * @param {string} channelId - Discord channel ID
   */
  setTurnTimer(channelId) {
    const game = this.games.get(channelId);
    if (!game) return;

    this.clearTurnTimer(channelId);
    
    game.timers.turnTimer = setTimeout(() => {
      this.handlePlayerTimeout(channelId);
    }, game.settings.turnTimeLimit);
  }

  /**
   * Set game timer (30 minutes max game time)
   * @param {string} channelId - Discord channel ID
   */
  setGameTimer(channelId) {
    const game = this.games.get(channelId);
    if (!game) return;

    this.clearGameTimer(channelId);
    
    game.timers.gameTimer = setTimeout(() => {
      this.endGame(channelId, 'timeout');
    }, game.settings.gameTimeLimit);
  }

  /**
   * Clear lobby timer
   * @param {string} channelId - Discord channel ID
   */
  clearLobbyTimer(channelId) {
    const game = this.games.get(channelId);
    if (game && game.timers.lobbyTimer) {
      clearTimeout(game.timers.lobbyTimer);
      game.timers.lobbyTimer = null;
    }
  }

  /**
   * Clear turn timer
   * @param {string} channelId - Discord channel ID
   */
  clearTurnTimer(channelId) {
    const game = this.games.get(channelId);
    if (game && game.timers.turnTimer) {
      clearTimeout(game.timers.turnTimer);
      game.timers.turnTimer = null;
    }
  }

  /**
   * Clear game timer
   * @param {string} channelId - Discord channel ID
   */
  clearGameTimer(channelId) {
    const game = this.games.get(channelId);
    if (game && game.timers.gameTimer) {
      clearTimeout(game.timers.gameTimer);
      game.timers.gameTimer = null;
    }
  }

  /**
   * Clear all timers for a game
   * @param {string} channelId - Discord channel ID
   */
  clearAllTimers(channelId) {
    this.clearLobbyTimer(channelId);
    this.clearTurnTimer(channelId);
    this.clearGameTimer(channelId);
  }

  /**
   * Start cleanup interval for abandoned games
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupAbandonedGames();
    }, 300000); // 5 minutes
  }

  /**
   * Clean up abandoned games (inactive for 10+ minutes)
   */
  cleanupAbandonedGames() {
    const now = Date.now();
    const maxInactiveTime = 600000; // 10 minutes

    for (const [channelId, game] of this.games.entries()) {
      const inactiveTime = now - game.lastActivity.getTime();
      
      if (inactiveTime > maxInactiveTime) {
        console.log(`Cleaning up abandoned game in channel ${channelId}`);
        this.endGame(channelId, 'abandoned');
      }
    }
  }

  /**
   * Get all active games
   * @returns {Map} Map of channelId -> game
   */
  getAllGames() {
    return new Map(this.games);
  }

  /**
   * Get game statistics
   * @returns {Object} Manager statistics
   */
  getStats() {
    const games = Array.from(this.games.values());
    
    return {
      totalGames: games.length,
      lobbyGames: games.filter(g => g.status === GAME_STATUS.LOBBY).length,
      activeGames: games.filter(g => g.status === GAME_STATUS.ACTIVE).length,
      totalPlayers: games.reduce((sum, g) => sum + g.players.length, 0),
      averagePlayersPerGame: games.length > 0 ? games.reduce((sum, g) => sum + g.players.length, 0) / games.length : 0
    };
  }

  /**
   * Shutdown the manager and clean up all resources
   */
  shutdown() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // End all games and clear timers
    for (const channelId of this.games.keys()) {
      this.endGame(channelId, 'shutdown');
    }

    // Clear all maps
    this.games.clear();
    this.playerGames.clear();
  }
}

// Create singleton instance
const gameManager = new UnoGameManager();

module.exports = gameManager;