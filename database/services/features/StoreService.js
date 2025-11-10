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
        name: 'Basic Banknote',
        description: 'Increases your bank limit by 10,000 coins',
        price: 5000,
        category: 'banknotes',
        emoji: '💵',
        bankLimitIncrease: 10000
      },
      {
        id: 2,
        name: 'Premium Banknote',
        description: 'Increases your bank limit by 50,000 coins',
        price: 20000,
        category: 'banknotes',
        emoji: '💴',
        bankLimitIncrease: 50000
      },
      {
        id: 3,
        name: 'Elite Banknote',
        description: 'Increases your bank limit by 100,000 coins',
        price: 50000,
        category: 'banknotes',
        emoji: '💶',
        bankLimitIncrease: 100000
      },
      // Items
      {
        id: 4,
        name: 'Padlock',
        description: 'Protects you from being robbed',
        price: 1000,
        category: 'items',
        emoji: '🔒',
        type: 'protection'
      },
      {
        id: 5,
        name: 'Fishing Rod',
        description: 'Allows you to fish for coins',
        price: 2500,
        category: 'items',
        emoji: '🎣',
        type: 'tool'
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
}

module.exports = StoreService;
