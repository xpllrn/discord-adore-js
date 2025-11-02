/**
 * UNO Game State Management
 * Handles complete game state, player management, and state transitions
 */

const { UnoDeck, CardValidator, COLORS, ACTION_TYPES, WILD_TYPES } = require('./unoCards');

// Game status constants
const GAME_STATUS = {
  LOBBY: 'lobby',
  ACTIVE: 'active', 
  PAUSED: 'paused',
  ENDED: 'ended'
};

// Game settings defaults
const DEFAULT_SETTINGS = {
  maxPlayers: 10,
  turnTimeLimit: 120000, // 2 minutes in milliseconds
  gameTimeLimit: 1800000, // 30 minutes in milliseconds
  allowStacking: true, // Allow stacking draw cards
  jumpInRules: false, // Allow jumping in with same card
  sevenZeroRules: false, // Special rules for 7s and 0s
  customRules: {
    drawUntilPlayable: false,
    noBluffingWildDraw4: false,
    mustCallUno: true
  }
};

/**
 * Player class for game state
 */
class UnoPlayer {
  constructor(userId, username) {
    this.userId = userId;
    this.username = username;
    this.hand = [];
    this.isActive = true;
    this.hasCalledUno = false;
    this.joinedAt = new Date();
    this.lastActivity = new Date();
    this.isAI = false; // For disconnected player AI takeover
  }

  /**
   * Add cards to player's hand
   * @param {UnoCard[]} cards - Cards to add
   */
  addCards(cards) {
    this.hand.push(...cards);
  }

  /**
   * Remove a card from player's hand
   * @param {string} cardId - ID of card to remove
   * @returns {UnoCard|null} Removed card or null if not found
   */
  removeCard(cardId) {
    const cardIndex = this.hand.findIndex(card => card.id === cardId);
    if (cardIndex !== -1) {
      return this.hand.splice(cardIndex, 1)[0];
    }
    return null;
  }

  /**
   * Get playable cards from hand
   * @param {UnoCard} currentCard - Current top card
   * @param {Object} gameState - Current game state
   * @returns {UnoCard[]} Playable cards
   */
  getPlayableCards(currentCard, gameState = {}) {
    return CardValidator.getPlayableCards(this.hand, currentCard, gameState);
  }

  /**
   * Check if player has playable cards
   * @param {UnoCard} currentCard - Current top card
   * @param {Object} gameState - Current game state
   * @returns {boolean} True if has playable cards
   */
  hasPlayableCards(currentCard, gameState = {}) {
    return this.getPlayableCards(currentCard, gameState).length > 0;
  }

  /**
   * Get hand size
   * @returns {number} Number of cards in hand
   */
  getHandSize() {
    return this.hand.length;
  }

  /**
   * Check if player has UNO (1 card left)
   * @returns {boolean} True if player has 1 card
   */
  hasUno() {
    return this.hand.length === 1;
  }

  /**
   * Check if player has won (0 cards left)
   * @returns {boolean} True if player has no cards
   */
  hasWon() {
    return this.hand.length === 0;
  }

  /**
   * Update last activity timestamp
   */
  updateActivity() {
    this.lastActivity = new Date();
  }

  /**
   * Mark player as inactive/disconnected
   */
  setInactive() {
    this.isActive = false;
  }

  /**
   * Mark player as AI-controlled
   */
  setAI() {
    this.isAI = true;
    this.isActive = true;
  }
}

/**
 * Main UNO Game State class
 */
class UnoGameState {
  constructor(channelId, hostId, hostUsername) {
    this.gameId = this.generateGameId();
    this.channelId = channelId;
    this.hostId = hostId;
    this.status = GAME_STATUS.LOBBY;
    
    // Initialize with host as first player
    this.players = [new UnoPlayer(hostId, hostUsername)];
    this.playerMap = new Map([[hostId, 0]]); // userId -> player index
    
    // Game state
    this.currentPlayerIndex = 0;
    this.direction = 1; // 1 for clockwise, -1 for counterclockwise
    this.deck = new UnoDeck();
    this.discardPile = [];
    this.currentCard = null;
    
    // Special effects tracking
    this.drawCount = 0; // For stacking draw cards
    this.skipCount = 0; // For stacking skip cards
    this.wildColor = null; // Color chosen for wild cards
    
    // Game settings
    this.settings = { ...DEFAULT_SETTINGS };
    
    // Timers
    this.timers = {
      turnTimer: null,
      gameTimer: null,
      lobbyTimer: null
    };
    
    // Message and collector tracking
    this.currentMessage = null;
    this.currentCollector = null;
    
    // Timestamps
    this.createdAt = new Date();
    this.startedAt = null;
    this.lastActivity = new Date();
    
    // Initialize deck
    this.deck.shuffle();
  }

  /**
   * Generate unique game ID
   * @returns {string} Unique game identifier
   */
  generateGameId() {
    return `uno_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a player to the game
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @returns {boolean} True if player was added successfully
   */
  addPlayer(userId, username) {
    // Check if game is in lobby
    if (this.status !== GAME_STATUS.LOBBY) {
      return false;
    }

    // Check if player already exists
    if (this.playerMap.has(userId)) {
      return false;
    }

    // Check max players
    if (this.players.length >= this.settings.maxPlayers) {
      return false;
    }

    // Add player
    const player = new UnoPlayer(userId, username);
    const playerIndex = this.players.length;
    this.players.push(player);
    this.playerMap.set(userId, playerIndex);
    
    this.updateActivity();
    return true;
  }

  /**
   * Remove a player from the game
   * @param {string} userId - User ID to remove
   * @returns {boolean} True if player was removed
   */
  removePlayer(userId) {
    const playerIndex = this.playerMap.get(userId);
    if (playerIndex === undefined) {
      return false;
    }

    // If game is active, handle differently
    if (this.status === GAME_STATUS.ACTIVE) {
      return this.handlePlayerLeave(userId);
    }

    // Remove from lobby
    this.players.splice(playerIndex, 1);
    this.playerMap.delete(userId);
    
    // Update player map indices
    this.rebuildPlayerMap();
    
    // If host left, transfer to next player
    if (userId === this.hostId && this.players.length > 0) {
      this.hostId = this.players[0].userId;
    }
    
    this.updateActivity();
    return true;
  }

  /**
   * Handle player leaving during active game
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  handlePlayerLeave(userId) {
    const playerIndex = this.playerMap.get(userId);
    if (playerIndex === undefined) {
      return false;
    }

    const player = this.players[playerIndex];
    
    // Mark as AI-controlled instead of removing
    player.setAI();
    
    // If it was their turn, advance to next player
    if (this.currentPlayerIndex === playerIndex) {
      this.advanceTurn();
    }
    
    this.updateActivity();
    return true;
  }

  /**
   * Rebuild player map after player removal
   */
  rebuildPlayerMap() {
    this.playerMap.clear();
    this.players.forEach((player, index) => {
      this.playerMap.set(player.userId, index);
    });
  }

  /**
   * Start the game
   * @returns {boolean} True if game started successfully
   */
  startGame() {
    if (this.status !== GAME_STATUS.LOBBY) {
      return false;
    }

    if (this.players.length < 2) {
      return false;
    }

    // Deal initial hands (7 cards each)
    this.players.forEach(player => {
      const cards = this.deck.drawCards(7);
      player.addCards(cards);
    });

    // Set initial current card (not an action card)
    let initialCard;
    do {
      initialCard = this.deck.drawCard();
      if (!initialCard) {
        // Deck exhausted, reshuffle
        this.reshuffleDeck();
        initialCard = this.deck.drawCard();
      }
    } while (initialCard && initialCard.hasEffect());

    this.currentCard = initialCard;
    this.discardPile.push(initialCard);

    // Randomly select starting player
    this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);

    // Update status
    this.status = GAME_STATUS.ACTIVE;
    this.startedAt = new Date();
    this.updateActivity();

    return true;
  }

  /**
   * Play a card
   * @param {string} userId - Player ID
   * @param {string} cardId - Card ID to play
   * @param {string} chosenColor - Color for wild cards
   * @returns {Object} Result object with success status and details
   */
  playCard(userId, cardId, chosenColor = null) {
    const result = { success: false, message: '', effects: [] };

    // Validate player turn
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.userId !== userId) {
      result.message = 'Not your turn!';
      return result;
    }

    // Find and validate card
    const card = currentPlayer.removeCard(cardId);
    if (!card) {
      result.message = 'Card not found in your hand!';
      return result;
    }

    // Validate card play
    if (!card.isPlayable(this.currentCard, { wildColor: this.wildColor })) {
      // Return card to hand
      currentPlayer.addCards([card]);
      result.message = 'Invalid card play!';
      return result;
    }

    // Handle wild card color selection
    if (card.type === 'wild' && !chosenColor) {
      // Return card to hand
      currentPlayer.addCards([card]);
      result.message = 'Must choose a color for wild card!';
      return result;
    }

    // Play the card
    this.discardPile.push(card);
    this.currentCard = card;
    
    // Set wild color if applicable
    if (card.type === 'wild') {
      this.wildColor = chosenColor;
      this.currentCard.color = chosenColor; // Temporarily set color for validation
    } else {
      this.wildColor = null;
    }

    // Process card effects
    this.processCardEffects(card, result);

    // Check for UNO call requirement
    if (currentPlayer.hasUno() && !currentPlayer.hasCalledUno && this.settings.customRules.mustCallUno) {
      result.effects.push('uno_required');
    }

    // Check for win condition
    if (currentPlayer.hasWon()) {
      this.status = GAME_STATUS.ENDED;
      result.effects.push('game_won');
      result.winner = currentPlayer;
    } else {
      // Advance turn if no skip effect
      if (!result.effects.includes('skip_next')) {
        this.advanceTurn();
      }
    }

    currentPlayer.updateActivity();
    this.updateActivity();
    
    result.success = true;
    result.message = 'Card played successfully!';
    return result;
  }

  /**
   * Process special card effects
   * @param {UnoCard} card - Played card
   * @param {Object} result - Result object to modify
   */
  processCardEffects(card, result) {
    if (!card.hasEffect()) {
      return;
    }

    switch (card.effect) {
      case ACTION_TYPES.SKIP:
        this.skipNextPlayer();
        result.effects.push('skip_next');
        result.skippedPlayer = this.getPreviousPlayer();
        break;

      case ACTION_TYPES.REVERSE:
        this.reverseTurnDirection();
        result.effects.push('reverse');
        result.newDirection = this.direction > 0 ? 'clockwise' : 'counterclockwise';
        
        // In 2-player game, reverse acts like skip
        if (this.players.length === 2) {
          result.effects.push('skip_next');
        }
        break;

      case ACTION_TYPES.DRAW_TWO:
        this.drawCount += 2;
        result.effects.push('draw_two');
        result.drawCount = this.drawCount;
        
        // Next player must draw cards and lose turn
        const nextPlayer = this.getNextPlayer();
        if (nextPlayer && !this.settings.allowStacking) {
          this.forceDrawCards(nextPlayer.userId, this.drawCount);
          this.drawCount = 0;
          this.skipNextPlayer();
        }
        break;

      case WILD_TYPES.WILD_DRAW_FOUR:
        this.drawCount += 4;
        result.effects.push('wild_draw_four');
        result.drawCount = this.drawCount;
        
        // Next player must draw cards and lose turn
        const nextPlayerWild = this.getNextPlayer();
        if (nextPlayerWild && !this.settings.allowStacking) {
          this.forceDrawCards(nextPlayerWild.userId, this.drawCount);
          this.drawCount = 0;
          this.skipNextPlayer();
        }
        break;
    }
  }

  /**
   * Force a player to draw cards (for penalties)
   * @param {string} userId - Player ID
   * @param {number} count - Number of cards to draw
   * @returns {UnoCard[]} Drawn cards
   */
  forceDrawCards(userId, count) {
    const drawnCards = this.drawCards(userId, count);
    
    // Mark that player has been penalized
    const player = this.getPlayer(userId);
    if (player) {
      player.updateActivity();
    }
    
    return drawnCards;
  }

  /**
   * Draw cards for a player
   * @param {string} userId - Player ID
   * @param {number} count - Number of cards to draw
   * @returns {UnoCard[]} Drawn cards
   */
  drawCards(userId, count = 1) {
    const playerIndex = this.playerMap.get(userId);
    if (playerIndex === undefined) {
      return [];
    }

    const player = this.players[playerIndex];
    const drawnCards = [];

    for (let i = 0; i < count; i++) {
      if (this.deck.isEmpty()) {
        this.reshuffleDeck();
      }
      
      const card = this.deck.drawCard();
      if (card) {
        drawnCards.push(card);
        player.addCards([card]);
      }
    }

    player.updateActivity();
    this.updateActivity();
    
    return drawnCards;
  }

  /**
   * Reshuffle deck from discard pile
   */
  reshuffleDeck() {
    if (this.discardPile.length <= 1) {
      return; // Keep at least the current card
    }

    // Take all but the top card from discard pile
    const cardsToShuffle = this.discardPile.slice(0, -1);
    this.discardPile = [this.discardPile[this.discardPile.length - 1]];

    // Add cards back to deck and shuffle
    this.deck.addCards(cardsToShuffle);
    this.deck.shuffle();
  }

  /**
   * Advance to next player's turn
   * @param {number} steps - Number of steps to advance (default: 1)
   */
  advanceTurn(steps = 1) {
    const playerCount = this.players.length;
    
    for (let i = 0; i < steps; i++) {
      this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + playerCount) % playerCount;
      
      // Skip inactive players (AI or disconnected)
      let skippedCount = 0;
      while (!this.players[this.currentPlayerIndex].isActive && skippedCount < playerCount) {
        this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + playerCount) % playerCount;
        skippedCount++;
      }
      
      // If all players are inactive, end the game
      if (skippedCount >= playerCount) {
        this.endGame('all_players_inactive');
        return;
      }
    }
    
    // Reset UNO call status for new turn
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer && !currentPlayer.hasUno()) {
      currentPlayer.hasCalledUno = false;
    }
  }

  /**
   * Get next player without advancing turn
   * @param {number} steps - Number of steps to look ahead (default: 1)
   * @returns {UnoPlayer|null} Next player
   */
  getNextPlayer(steps = 1) {
    const playerCount = this.players.length;
    let nextIndex = this.currentPlayerIndex;
    
    for (let i = 0; i < steps; i++) {
      nextIndex = (nextIndex + this.direction + playerCount) % playerCount;
    }
    
    return this.players[nextIndex] || null;
  }

  /**
   * Get previous player
   * @param {number} steps - Number of steps to look back (default: 1)
   * @returns {UnoPlayer|null} Previous player
   */
  getPreviousPlayer(steps = 1) {
    const playerCount = this.players.length;
    let prevIndex = this.currentPlayerIndex;
    
    for (let i = 0; i < steps; i++) {
      prevIndex = (prevIndex - this.direction + playerCount) % playerCount;
    }
    
    return this.players[prevIndex] || null;
  }

  /**
   * Skip next player's turn
   */
  skipNextPlayer() {
    this.advanceTurn(2); // Skip one player
  }

  /**
   * Reverse turn direction
   */
  reverseTurnDirection() {
    this.direction *= -1;
    
    // In a 2-player game, reverse acts like skip
    if (this.players.length === 2) {
      this.advanceTurn();
    }
  }

  /**
   * Get turn order starting from current player
   * @returns {UnoPlayer[]} Array of players in turn order
   */
  getTurnOrder() {
    const turnOrder = [];
    const playerCount = this.players.length;
    
    for (let i = 0; i < playerCount; i++) {
      const index = (this.currentPlayerIndex + (i * this.direction) + playerCount) % playerCount;
      turnOrder.push(this.players[index]);
    }
    
    return turnOrder;
  }

  /**
   * Get remaining turn time for current player
   * @returns {number} Remaining time in milliseconds
   */
  getRemainingTurnTime() {
    // This would be calculated based on when the turn started
    // For now, return the full turn time limit
    return this.settings.turnTimeLimit;
  }

  /**
   * Get current player
   * @returns {UnoPlayer|null} Current player or null
   */
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
  }

  /**
   * Get player by user ID
   * @param {string} userId - User ID
   * @returns {UnoPlayer|null} Player or null
   */
  getPlayer(userId) {
    const playerIndex = this.playerMap.get(userId);
    return playerIndex !== undefined ? this.players[playerIndex] : null;
  }

  /**
   * Call UNO for a player
   * @param {string} userId - Player ID
   * @returns {boolean} Success status
   */
  callUno(userId) {
    const player = this.getPlayer(userId);
    if (!player || !player.hasUno()) {
      return false;
    }

    player.hasCalledUno = true;
    player.updateActivity();
    this.updateActivity();
    
    return true;
  }

  /**
   * Challenge a Wild Draw Four play
   * @param {string} challengerId - Player making the challenge
   * @returns {Object} Challenge result
   */
  challengeWildDrawFour(challengerId) {
    // Implementation for Wild Draw Four challenge
    // This would check if the previous player had valid alternatives
    return { success: false, message: 'Challenge system not implemented yet' };
  }

  /**
   * Update game activity timestamp
   */
  updateActivity() {
    this.lastActivity = new Date();
  }

  /**
   * End the game
   * @param {string} reason - Reason for ending
   */
  endGame(reason = 'manual') {
    this.status = GAME_STATUS.ENDED;
    this.clearTimers();
    this.updateActivity();
  }

  /**
   * Clear all game timers
   */
  clearTimers() {
    Object.values(this.timers).forEach(timer => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    this.timers = { turnTimer: null, gameTimer: null, lobbyTimer: null };
  }

  /**
   * Set current message and stop old collector
   * @param {Message} message - Discord message
   */
  setCurrentMessage(message) {
    // Stop old collector if exists
    if (this.currentCollector) {
      this.currentCollector.stop();
    }
    this.currentMessage = message;
    this.currentCollector = null;
  }

  /**
   * Set current collector
   * @param {MessageComponentCollector} collector - Message collector
   */
  setCurrentCollector(collector) {
    this.currentCollector = collector;
  }

  /**
   * Stop current collector
   */
  stopCurrentCollector() {
    if (this.currentCollector) {
      this.currentCollector.stop();
      this.currentCollector = null;
    }
  }

  /**
   * Get game statistics
   * @returns {Object} Game stats
   */
  getGameStats() {
    return {
      gameId: this.gameId,
      status: this.status,
      playerCount: this.players.length,
      currentPlayer: this.getCurrentPlayer()?.username,
      cardsInDeck: this.deck.getCardCount(),
      cardsInDiscard: this.discardPile.length,
      gameTime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      totalTime: Date.now() - this.createdAt.getTime()
    };
  }

  /**
   * Get serializable game state for storage/transmission
   * @returns {Object} Serializable game state
   */
  serialize() {
    return {
      gameId: this.gameId,
      channelId: this.channelId,
      hostId: this.hostId,
      status: this.status,
      players: this.players.map(p => ({
        userId: p.userId,
        username: p.username,
        handSize: p.getHandSize(),
        isActive: p.isActive,
        hasCalledUno: p.hasCalledUno,
        isAI: p.isAI
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      direction: this.direction,
      currentCard: this.currentCard,
      drawCount: this.drawCount,
      skipCount: this.skipCount,
      wildColor: this.wildColor,
      settings: this.settings,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      lastActivity: this.lastActivity
    };
  }
}

module.exports = {
  UnoGameState,
  UnoPlayer,
  GAME_STATUS,
  DEFAULT_SETTINGS
};