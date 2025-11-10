/**
 * StoreService
 * Manages store items and categories for the gambling system
 */

const BaseService = require('../core/BaseService');

class StoreService extends BaseService {
  constructor() {
    super('Store');
    
    // Define store items
    this.items = [
      // Banknotes
      {
        id: 1,
        name: 'Dirt Banknote',
        description: 'Increases your bank limit by 20,000 coins',
        price: 20000,
        category: 'banknotes',
        emoji: '💵',
        bankLimitIncrease: 20000
      },
      {
        id: 2,
        name: 'Commoner Banknote',
        description: 'Increases your bank limit by 50,000 coins',
        price: 45000,
        category: 'banknotes',
        emoji: '💴',
        bankLimitIncrease: 50000
      },
      {
        id: 3,
        name: 'Regular Banknote',
        description: 'Increases your bank limit by 100,000 coins',
        price: 90000,
        category: 'banknotes',
        emoji: '💶',
        bankLimitIncrease: 100000
      },
      {
        id: 4,
        name: 'Noble Banknote',
        description: 'Increases your bank limit by 500,000 coins',
        price: 400000,
        category: 'banknotes',
        emoji: '💷',
        bankLimitIncrease: 500000
      },
      {
        id: 5,
        name: 'Royal Banknote',
        description: 'Increases your bank limit by 1,000,000 coins',
        price: 800000,
        category: 'banknotes',
        emoji: '💸',
        bankLimitIncrease: 1000000
      },
      {
        id: 6,
        name: 'Mythical Banknote',
        description: 'Increases your bank limit by 10,000,000 coins',
        price: 8000000,
        category: 'banknotes',
        emoji: '💰',
        bankLimitIncrease: 10000000
      },
      // Items
      {
        id: 7,
        name: 'Padlock',
        description: 'Protects you from being robbed',
        price: 1000,
        category: 'items',
        emoji: '🔒',
        type: 'protection'
      }
    ];
    
    this.initialized = true;
  }

  /**
   * Get all categories with item counts
   * @returns {Promise<Array>} Array of categories
   */
  async getCategories() {
    const categoryMap = new Map();
    
    this.items.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, { name: item.category, count: 0 });
      }
      categoryMap.get(item.category).count++;
    });
    
    return Array.from(categoryMap.values());
  }

  /**
   * Get items by category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Array of items
   */
  async getItemsByCategory(category) {
    return this.items.filter(item => item.category === category);
  }

  /**
   * Find item by identifier (ID or name)
   * @param {string|number} identifier - Item ID or name
   * @returns {Promise<Object|null>} Item or null
   */
  async findItemByIdentifier(identifier) {
    // Try to parse as number (ID)
    const id = parseInt(identifier);
    if (!isNaN(id)) {
      return this.items.find(item => item.id === id) || null;
    }
    
    // Search by name (case insensitive)
    const searchTerm = identifier.toLowerCase();
    return this.items.find(item => 
      item.name.toLowerCase().includes(searchTerm)
    ) || null;
  }

  /**
   * Get item by ID
   * @param {number} id - Item ID
   * @returns {Promise<Object|null>} Item or null
   */
  async getItemById(id) {
    return this.items.find(item => item.id === id) || null;
  }

  /**
   * Get all items
   * @returns {Promise<Array>} Array of all items
   */
  async getAllItems() {
    return this.items;
  }

  /**
   * Use an item (handles item-specific logic)
   * @param {string} userId - User ID
   * @param {Object} item - Item to use
   * @param {number} quantity - Quantity to use
   * @param {Object} userService - UserService instance
   * @returns {Promise<Object>} Result object with success and message
   */
  async useItem(userId, item, quantity, userService) {
    try {
      // Handle banknotes
      if (item.category === 'banknotes' && item.bankLimitIncrease) {
        const gambling = await userService.getGamblingData(userId);
        const oldLimit = gambling.bankLimit || 0;
        const totalIncrease = item.bankLimitIncrease * quantity;
        const newLimit = oldLimit + totalIncrease;
        
        await userService.updateBankLimit(userId, newLimit);
        
        const quantityText = quantity > 1 ? ` x${quantity}` : '';
        return {
          success: true,
          message: `Successfully used **${item.name}**${quantityText}! Your bank limit increased from **${this.formatCurrency(oldLimit)}** to **${this.formatCurrency(newLimit)}** coins.`,
          oldLimit,
          newLimit
        };
      }
      
      // Handle padlock - activates protection
      if (item.id === 7 && item.type === 'protection') {
        const gambling = await userService.getGamblingData(userId);
        const currentProtection = gambling.padlockProtection || 0;
        const newProtection = currentProtection + quantity;
        
        await userService.setUserField(userId, 'Gambling.padlockProtection', newProtection);
        
        const quantityText = quantity > 1 ? ` x${quantity}` : '';
        return {
          success: true,
          message: `🔒 Successfully activated **${item.name}**${quantityText}! You are now protected from the next ${newProtection} robbery attempt${newProtection > 1 ? 's' : ''}.`
        };
      }
      
      // Handle other items
      if (item.category === 'items') {
        return {
          success: false,
          message: `**${item.name}** cannot be used yet. This item's functionality is coming soon!`
        };
      }
      
      // Unknown item type
      return {
        success: false,
        message: `**${item.name}** cannot be used.`
      };
      
    } catch (error) {
      console.error('Error using item:', error);
      return {
        success: false,
        message: 'Failed to use item. Please try again.'
      };
    }
  }

  /**
   * Format currency helper
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency
   */
  formatCurrency(amount) {
    return Math.floor(amount).toLocaleString();
  }
}

module.exports = StoreService;
