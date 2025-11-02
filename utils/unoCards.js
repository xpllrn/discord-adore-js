/**
 * UNO Card System
 * Handles card definitions, deck generation, and card validation logic
 */

// Card type definitions
const CARD_TYPES = {
  NUMBER: 'number',
  ACTION: 'action', 
  WILD: 'wild'
};

const COLORS = {
  RED: 'red',
  BLUE: 'blue', 
  GREEN: 'green',
  YELLOW: 'yellow',
  WILD: 'wild'
};

const ACTION_TYPES = {
  SKIP: 'skip',
  REVERSE: 'reverse',
  DRAW_TWO: 'draw2'
};

const WILD_TYPES = {
  WILD: 'wild',
  WILD_DRAW_FOUR: 'wilddraw4'
};

// Import emojis from config
const { emojis } = require('../config/setup');

// Card emoji mappings using proper UNO card emojis
const CARD_EMOJIS = {
  // Number cards (0-9)
  [COLORS.RED]: {
    0: emojis.unoRed0, 1: emojis.unoRed1, 2: emojis.unoRed2, 3: emojis.unoRed3, 4: emojis.unoRed4,
    5: emojis.unoRed5, 6: emojis.unoRed6, 7: emojis.unoRed7, 8: emojis.unoRed8, 9: emojis.unoRed9,
    [ACTION_TYPES.REVERSE]: emojis.unoRed10,    // 10 = Reverse
    [ACTION_TYPES.DRAW_TWO]: emojis.unoRed11,   // 11 = Draw 2
    [ACTION_TYPES.SKIP]: emojis.unoRed12        // 12 = Skip
  },
  [COLORS.BLUE]: {
    0: emojis.unoBlue0, 1: emojis.unoBlue1, 2: emojis.unoBlue2, 3: emojis.unoBlue3, 4: emojis.unoBlue4,
    5: emojis.unoBlue5, 6: emojis.unoBlue6, 7: emojis.unoBlue7, 8: emojis.unoBlue8, 9: emojis.unoBlue9,
    [ACTION_TYPES.REVERSE]: emojis.unoBlue10,
    [ACTION_TYPES.DRAW_TWO]: emojis.unoBlue11,
    [ACTION_TYPES.SKIP]: emojis.unoBlue12
  },
  [COLORS.GREEN]: {
    0: emojis.unoGreen0, 1: emojis.unoGreen1, 2: emojis.unoGreen2, 3: emojis.unoGreen3, 4: emojis.unoGreen4,
    5: emojis.unoGreen5, 6: emojis.unoGreen6, 7: emojis.unoGreen7, 8: emojis.unoGreen8, 9: emojis.unoGreen9,
    [ACTION_TYPES.REVERSE]: emojis.unoGreen10,
    [ACTION_TYPES.DRAW_TWO]: emojis.unoGreen11,
    [ACTION_TYPES.SKIP]: emojis.unoGreen12
  },
  [COLORS.YELLOW]: {
    0: emojis.unoYellow0, 1: emojis.unoYellow1, 2: emojis.unoYellow2, 3: emojis.unoYellow3, 4: emojis.unoYellow4,
    5: emojis.unoYellow5, 6: emojis.unoYellow6, 7: emojis.unoYellow7, 8: emojis.unoYellow8, 9: emojis.unoYellow9,
    [ACTION_TYPES.REVERSE]: emojis.unoYellow10,
    [ACTION_TYPES.DRAW_TWO]: emojis.unoYellow11,
    [ACTION_TYPES.SKIP]: emojis.unoYellow12
  }
};

const WILD_EMOJIS = {
  [WILD_TYPES.WILD]: emojis.unoInformation || '🌈',
  [WILD_TYPES.WILD_DRAW_FOUR]: emojis.unoWildDrawFour || '🌈+4️⃣'
};

/**
 * UNO Card class
 */
class UnoCard {
  constructor(type, color, value, effect = null) {
    this.id = `${color}_${value}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.color = color;
    this.value = value;
    this.effect = effect;
  }

  /**
   * Check if this card can be played on the current card
   * @param {UnoCard} currentCard - The current top card
   * @param {Object} gameState - Current game state for special rules
   * @returns {boolean} True if card is playable
   */
  isPlayable(currentCard, gameState = {}) {
    // Wild cards can always be played
    if (this.type === CARD_TYPES.WILD) {
      return true;
    }

    // Can't play on null card
    if (!currentCard) {
      return false;
    }

    // If current card is wild, only check against the wild color
    if (currentCard.type === CARD_TYPES.WILD && gameState.wildColor) {
      return this.color === gameState.wildColor;
    }

    // For regular cards, check color match
    if (this.color === currentCard.color) {
      return true;
    }

    // Check value/effect match for non-wild cards
    if (currentCard.type !== CARD_TYPES.WILD) {
      // Number cards: match by value
      if (this.type === CARD_TYPES.NUMBER && currentCard.type === CARD_TYPES.NUMBER) {
        return this.value === currentCard.value;
      }
      
      // Action cards: match by effect
      if (this.type === CARD_TYPES.ACTION && currentCard.type === CARD_TYPES.ACTION) {
        return this.effect === currentCard.effect;
      }
    }

    return false;
  }

  /**
   * Get display string for the card
   * @returns {string} Formatted card display
   */
  getDisplayString() {
    if (this.type === CARD_TYPES.WILD) {
      return WILD_EMOJIS[this.effect] || '🌈';
    }
    
    const colorEmojis = CARD_EMOJIS[this.color];
    if (!colorEmojis) {
      return `${this.color} ${this.value}`;
    }
    
    if (this.type === CARD_TYPES.NUMBER) {
      return colorEmojis[this.value] || `${this.color} ${this.value}`;
    }
    
    if (this.type === CARD_TYPES.ACTION) {
      return colorEmojis[this.effect] || `${this.color} ${this.effect}`;
    }
    
    return `${this.color} ${this.value}`;
  }

  /**
   * Get card name for dropdown display
   * @returns {string} Human-readable card name
   */
  getCardName() {
    if (this.type === CARD_TYPES.NUMBER) {
      return `${this.color.charAt(0).toUpperCase() + this.color.slice(1)} ${this.value}`;
    }
    
    if (this.type === CARD_TYPES.ACTION) {
      const actionName = this.effect.replace('draw2', 'Draw Two').replace(/([A-Z])/g, ' $1').trim();
      return `${this.color.charAt(0).toUpperCase() + this.color.slice(1)} ${actionName}`;
    }
    
    if (this.type === CARD_TYPES.WILD) {
      return this.effect === WILD_TYPES.WILD_DRAW_FOUR ? 'Wild Draw Four' : 'Wild';
    }
    
    return this.value;
  }

  /**
   * Check if card has a special effect
   * @returns {boolean} True if card has an effect
   */
  hasEffect() {
    return this.effect !== null;
  }

  /**
   * Get the point value of the card for scoring
   * @returns {number} Point value
   */
  getPointValue() {
    if (this.type === CARD_TYPES.NUMBER) {
      return parseInt(this.value);
    }
    
    if (this.type === CARD_TYPES.ACTION) {
      return 20;
    }
    
    if (this.type === CARD_TYPES.WILD) {
      return 50;
    }
    
    return 0;
  }
}

/**
 * UNO Deck Generator
 */
class UnoDeck {
  constructor() {
    this.cards = [];
    this.generateDeck();
  }

  /**
   * Generate a complete UNO deck (108 cards)
   */
  generateDeck() {
    this.cards = [];

    // Generate number cards
    Object.values(COLORS).forEach(color => {
      if (color === COLORS.WILD) return;

      // 0 cards: 1 per color
      this.cards.push(new UnoCard(CARD_TYPES.NUMBER, color, 0));

      // 1-9 cards: 2 per color
      for (let num = 1; num <= 9; num++) {
        this.cards.push(new UnoCard(CARD_TYPES.NUMBER, color, num));
        this.cards.push(new UnoCard(CARD_TYPES.NUMBER, color, num));
      }

      // Action cards: 2 per color
      Object.values(ACTION_TYPES).forEach(action => {
        this.cards.push(new UnoCard(CARD_TYPES.ACTION, color, action, action));
        this.cards.push(new UnoCard(CARD_TYPES.ACTION, color, action, action));
      });
    });

    // Wild cards: 4 each
    for (let i = 0; i < 4; i++) {
      this.cards.push(new UnoCard(CARD_TYPES.WILD, COLORS.WILD, WILD_TYPES.WILD, WILD_TYPES.WILD));
      this.cards.push(new UnoCard(CARD_TYPES.WILD, COLORS.WILD, WILD_TYPES.WILD_DRAW_FOUR, WILD_TYPES.WILD_DRAW_FOUR));
    }
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Draw a card from the deck
   * @returns {UnoCard|null} The drawn card or null if deck is empty
   */
  drawCard() {
    return this.cards.pop() || null;
  }

  /**
   * Draw multiple cards from the deck
   * @param {number} count - Number of cards to draw
   * @returns {UnoCard[]} Array of drawn cards
   */
  drawCards(count) {
    const drawnCards = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      const card = this.drawCard();
      if (card) {
        drawnCards.push(card);
      }
    }
    return drawnCards;
  }

  /**
   * Add cards back to the deck (for reshuffling discard pile)
   * @param {UnoCard[]} cards - Cards to add back
   */
  addCards(cards) {
    this.cards.push(...cards);
  }

  /**
   * Get remaining card count
   * @returns {number} Number of cards left in deck
   */
  getCardCount() {
    return this.cards.length;
  }

  /**
   * Check if deck is empty
   * @returns {boolean} True if deck has no cards
   */
  isEmpty() {
    return this.cards.length === 0;
  }

  /**
   * Reset and regenerate the deck
   */
  reset() {
    this.generateDeck();
    this.shuffle();
  }
}

/**
 * Card validation utilities
 */
class CardValidator {
  /**
   * Get all playable cards from a hand
   * @param {UnoCard[]} hand - Player's hand
   * @param {UnoCard} currentCard - Current top card
   * @param {Object} gameState - Current game state
   * @returns {UnoCard[]} Array of playable cards
   */
  static getPlayableCards(hand, currentCard, gameState = {}) {
    if (!currentCard) {
      return hand; // Any card can be played if no current card
    }

    return hand.filter(card => card.isPlayable(currentCard, gameState));
  }

  /**
   * Check if a player has any playable cards
   * @param {UnoCard[]} hand - Player's hand
   * @param {UnoCard} currentCard - Current top card
   * @param {Object} gameState - Current game state
   * @returns {boolean} True if player has playable cards
   */
  static hasPlayableCards(hand, currentCard, gameState = {}) {
    return this.getPlayableCards(hand, currentCard, gameState).length > 0;
  }

  /**
   * Validate a Wild Draw Four play (can only be played if no other cards are playable)
   * @param {UnoCard[]} hand - Player's hand
   * @param {UnoCard} currentCard - Current top card
   * @param {UnoCard} playedCard - The Wild Draw Four being played
   * @returns {boolean} True if the play is valid
   */
  static validateWildDrawFour(hand, currentCard, playedCard) {
    if (playedCard.effect !== WILD_TYPES.WILD_DRAW_FOUR) {
      return true; // Not a Wild Draw Four, no special validation needed
    }

    // Check if player has any cards matching the current card's color
    const matchingColorCards = hand.filter(card => 
      card !== playedCard && 
      card.color === currentCard.color &&
      card.type !== CARD_TYPES.WILD
    );

    return matchingColorCards.length === 0;
  }

  /**
   * Get cards by color from a hand
   * @param {UnoCard[]} hand - Player's hand
   * @param {string} color - Color to filter by
   * @returns {UnoCard[]} Cards of the specified color
   */
  static getCardsByColor(hand, color) {
    return hand.filter(card => card.color === color);
  }

  /**
   * Get cards by type from a hand
   * @param {UnoCard[]} hand - Player's hand
   * @param {string} type - Type to filter by
   * @returns {UnoCard[]} Cards of the specified type
   */
  static getCardsByType(hand, type) {
    return hand.filter(card => card.type === type);
  }
}

module.exports = {
  UnoCard,
  UnoDeck,
  CardValidator,
  CARD_TYPES,
  COLORS,
  ACTION_TYPES,
  WILD_TYPES,
  CARD_EMOJIS,
  WILD_EMOJIS
};