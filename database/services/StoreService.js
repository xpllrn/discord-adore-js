const BaseService = require('./core/BaseService');
const { ValidationError, NotFoundError, DatabaseWriteError } = require('./core/errors');

/**
 * Store Service
 * Handles all store item operations with intelligent caching
 */
class StoreService extends BaseService {
  constructor() {
    super({
      modelName: 'StoreItem',
      keyField: 'id',
      database: 'global',
      ttl: 60 * 60 * 1000, // 1 hour TTL for store items
      maxSize: 1000 // Max 1000 items in cache
    });
    
    this.initialized = true;
  }

  // ===== DATABASE OPERATIONS (BaseService Implementation) =====

  /**
   * Write store item to database
   * @param {string} key - Item ID
   * @param {Object} data - Item data
   * @returns {Promise<void>}
   */
  async writeToDatabase(key, data) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      // Remove _id from data to prevent duplicate key errors
      const updateData = { ...data };
      delete updateData._id;

      await Model.updateOne(query, { $set: updateData }, { upsert: true });
    } catch (error) {
      throw new DatabaseWriteError(`Failed to write store item data for ${key}`, error);
    }
  }

  /**
   * Read store item from database
   * @param {string} key - Item ID
   * @returns {Promise<Object|null>} Item data or null
   */
  async readFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      const doc = await Model.findOne(query).lean();
      return doc || null;
    } catch (error) {
      console.error(`Error reading store item data for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete store item from database
   * @param {string} key - Item ID
   * @returns {Promise<void>}
   */
  async deleteFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      await Model.deleteOne(query);
    } catch (error) {
      throw new DatabaseWriteError(`Failed to delete store item data for ${key}`, error);
    }
  }

  /**
   * Batch read store items from database
   * @param {string[]} keys - Array of item IDs
   * @returns {Promise<Map<string, Object>>} Map of item ID to item data
   */
  async batchReadFromDatabase(keys) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: { $in: keys } };

      const docs = await Model.find(query).lean();
      const result = new Map();

      for (const doc of docs) {
        result.set(doc[this.keyField], doc);
      }

      return result;
    } catch (error) {
      console.error('Error batch reading store item data:', error.message);
      return new Map();
    }
  }

  // ===== STORE ITEM OPERATIONS =====

  /**
   * Get all enabled store items
   * @returns {Promise<Object[]>} Array of enabled store items
   */
  async getAllItems() {
    try {
      const Model = this.getModel();
      const items = await Model.find({ enabled: true }).lean();
      
      // Sort by numeric ID to maintain sequential order
      return items.sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idA - idB;
      });
    } catch (error) {
      console.error('Error getting all store items:', error.message);
      return [];
    }
  }

  /**
   * Get store items by category
   * @param {string} category - Category name
   * @returns {Promise<Object[]>} Array of items in category
   */
  async getItemsByCategory(category) {
    if (!category) {
      throw new ValidationError('Category is required', 'category', category);
    }

    try {
      const Model = this.getModel();
      const items = await Model.find({ 
        category: category.toLowerCase(), 
        enabled: true 
      }).lean();
      
      // Sort by numeric ID to maintain sequential order
      return items.sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idA - idB;
      });
    } catch (error) {
      console.error(`Error getting items for category ${category}:`, error.message);
      return [];
    }
  }

  /**
   * Get all categories with item counts
   * @returns {Promise<Object[]>} Array of categories with counts
   */
  async getCategories() {
    try {
      const Model = this.getModel();
      const categories = await Model.aggregate([
        { $match: { enabled: true } },
        { 
          $group: { 
            _id: '$category', 
            count: { $sum: 1 },
            items: { $push: '$$ROOT' }
          } 
        },
        { $sort: { _id: 1 } }
      ]);

      return categories.map(cat => ({
        name: cat._id,
        count: cat.count,
        items: cat.items
      }));
    } catch (error) {
      console.error('Error getting categories:', error.message);
      return [];
    }
  }

  /**
   * Find item by ID or number
   * @param {string} identifier - Item ID or display number
   * @returns {Promise<Object|null>} Item data or null
   */
  async findItemByIdentifier(identifier) {
    if (!identifier) {
      return null;
    }

    try {
      // Convert identifier to string for consistent handling
      const id = identifier.toString();
      
      // Try to find by exact ID (numeric IDs are stored as strings)
      let item = await this.get(id);
      if (item) {
        return item;
      }

      return null;
    } catch (error) {
      console.error(`Error finding item by identifier ${identifier}:`, error.message);
      return null;
    }
  }

  /**
   * Create or update store item
   * @param {Object} itemData - Item data
   * @returns {Promise<Object>} Created/updated item
   */
  async createOrUpdateItem(itemData) {
    if (!itemData.id) {
      throw new ValidationError('Item ID is required', 'id', itemData.id);
    }

    if (!itemData.name) {
      throw new ValidationError('Item name is required', 'name', itemData.name);
    }

    if (!itemData.description) {
      throw new ValidationError('Item description is required', 'description', itemData.description);
    }

    if (typeof itemData.price !== 'number' || itemData.price < 0) {
      throw new ValidationError('Valid price is required', 'price', itemData.price);
    }

    if (!itemData.category) {
      throw new ValidationError('Item category is required', 'category', itemData.category);
    }

    try {
      // Set default sell price if not provided
      if (!itemData.sellPrice) {
        itemData.sellPrice = Math.floor(itemData.price * 0.5);
      }

      // Set default values
      const item = {
        ...itemData,
        id: itemData.id.toString(), // Keep numeric IDs as strings
        category: itemData.category.toLowerCase(),
        stackable: itemData.stackable !== false,
        enabled: itemData.enabled !== false,
        effects: itemData.effects || {},
        updatedAt: new Date()
      };

      await this.set(item.id, item);
      return item;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to create/update store item ${itemData.id}`, error);
    }
  }

  /**
   * Delete store item
   * @param {string} itemId - Item ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteItem(itemId) {
    if (!itemId) {
      throw new ValidationError('Item ID is required', 'itemId', itemId);
    }

    try {
      await this.delete(itemId.toString());
      return true;
    } catch (error) {
      console.error(`Error deleting store item ${itemId}:`, error.message);
      return false;
    }
  }

  /**
   * Enable/disable store item
   * @param {string} itemId - Item ID
   * @param {boolean} enabled - Enable status
   * @returns {Promise<boolean>} Success status
   */
  async setItemEnabled(itemId, enabled) {
    if (!itemId) {
      throw new ValidationError('Item ID is required', 'itemId', itemId);
    }

    if (typeof enabled !== 'boolean') {
      throw new ValidationError('Enabled must be a boolean', 'enabled', enabled);
    }

    try {
      const item = await this.get(itemId.toString());
      if (!item) {
        return false;
      }

      item.enabled = enabled;
      item.updatedAt = new Date();
      
      await this.set(item.id, item);
      return true;
    } catch (error) {
      console.error(`Error setting item enabled status for ${itemId}:`, error.message);
      return false;
    }
  }

  /**
   * Use an item (handles item-specific logic)
   * @param {string} userId - User ID
   * @param {Object} item - Store item data
   * @param {number} quantity - Quantity to use
   * @returns {Promise<Object>} Result object with success status and message
   */
  async useItem(userId, item, quantity = 1) {
    if (!userId || !item) {
      throw new ValidationError('User ID and item are required');
    }

    try {
      // Get user service from the service registry
      const { getService } = require('./index');
      const userService = getService('user');

      // Handle different item categories
      switch (item.category) {
        case 'banknotes':
          return await this.useBanknote(userId, item, quantity, userService);
        
        case 'consumables':
          // Future: Handle consumable items
          return { success: false, message: 'Consumable items are not implemented yet' };
        
        case 'tools':
          // Future: Handle tool items
          return { success: false, message: 'Tool items are not implemented yet' };
        
        default:
          return { success: false, message: `Items of category '${item.category}' cannot be used` };
      }
    } catch (error) {
      console.error(`Error using item ${item.id}:`, error.message);
      return { success: false, message: 'An error occurred while using the item' };
    }
  }

  /**
   * Use a banknote item
   * @private
   * @param {string} userId - User ID
   * @param {Object} item - Banknote item data
   * @param {number} quantity - Quantity to use
   * @param {Object} userService - User service instance
   * @returns {Promise<Object>} Result object
   */
  async useBanknote(userId, item, quantity, userService) {
    if (!item.bankLimitIncrease) {
      return { success: false, message: 'This banknote has no bank limit increase value' };
    }

    try {
      // Get current bank limit
      const currentLimit = await userService.getBankLimit(userId);
      const increaseAmount = item.bankLimitIncrease * quantity;
      const newLimit = currentLimit + increaseAmount;
      
      // Update bank limit
      const updateSuccess = await userService.updateBankLimit(userId, newLimit);
      
      if (updateSuccess) {
        const quantityText = quantity > 1 ? ` x${quantity}` : '';
        const message = `Used **${item.name}**${quantityText}! Your bank limit increased by **${this.formatCurrency(increaseAmount)}** coins to **${this.formatCurrency(newLimit)}** coins total.`;
        
        return { 
          success: true, 
          message: message,
          oldLimit: currentLimit,
          newLimit: newLimit,
          increase: increaseAmount
        };
      } else {
        return { success: false, message: 'Failed to update bank limit' };
      }
    } catch (error) {
      console.error(`Error using banknote ${item.id}:`, error.message);
      return { success: false, message: 'Failed to process banknote usage' };
    }
  }

  /**
   * Format currency for display
   * @private
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    return Math.floor(amount).toLocaleString();
  }

  /**
   * Initialize default store items with numeric IDs
   * @returns {Promise<void>}
   */
  async initializeDefaultItems() {
    const defaultItems = [
      {
        id: '1',
        name: 'Dirt Banknote',
        description: 'Increases your bank limit by 20,000 coins',
        price: 20000,
        sellPrice: 10000,
        emoji: '🌱',
        category: 'banknotes',
        bankLimitIncrease: 20000,
        stackable: true,
        enabled: true
      },
      {
        id: '2',
        name: 'Commoner Banknote',
        description: 'Increases your bank limit by 50,000 coins',
        price: 45000,
        sellPrice: 22500,
        emoji: '🪙',
        category: 'banknotes',
        bankLimitIncrease: 50000,
        stackable: true,
        enabled: true
      },
      {
        id: '3',
        name: 'Regular Banknote',
        description: 'Increases your bank limit by 100,000 coins',
        price: 90000,
        sellPrice: 45000,
        emoji: '💵',
        category: 'banknotes',
        bankLimitIncrease: 100000,
        stackable: true,
        enabled: true
      },
      {
        id: '4',
        name: 'Noble Banknote',
        description: 'Increases your bank limit by 500,000 coins',
        price: 400000,
        sellPrice: 200000,
        emoji: '👑',
        category: 'banknotes',
        bankLimitIncrease: 500000,
        stackable: true,
        enabled: true
      },
      {
        id: '5',
        name: 'Royal Banknote',
        description: 'Increases your bank limit by 1,000,000 coins',
        price: 800000,
        sellPrice: 400000,
        emoji: '💎',
        category: 'banknotes',
        bankLimitIncrease: 1000000,
        stackable: true,
        enabled: true
      },
      {
        id: '6',
        name: 'Mythical Banknote',
        description: 'Increases your bank limit by 10,000,000 coins',
        price: 8000000,
        sellPrice: 4000000,
        emoji: '🌌',
        category: 'banknotes',
        bankLimitIncrease: 10000000,
        stackable: true,
        enabled: true
      }
    ];

    try {
      for (const item of defaultItems) {
        await this.createOrUpdateItem(item);
      }
      console.log('✅ Default store items initialized');
    } catch (error) {
      console.error('Error initializing default store items:', error.message);
    }
  }
}

module.exports = StoreService;