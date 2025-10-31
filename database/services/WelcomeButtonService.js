const BaseService = require('./core/BaseService');
const { ValidationError, NotFoundError, DatabaseWriteError } = require('./core/errors');

/**
 * Welcome Button Service
 * Handles tracking of welcome button interactions to prevent spam
 */
class WelcomeButtonService extends BaseService {
  constructor() {
    super({
      modelName: 'WelcomeButton',
      keyField: 'interactionId',
      database: 'local',
      ttl: 5 * 60 * 1000, // 5 minutes TTL for cleanup
      maxSize: 500 // Max 500 interactions in cache
    });

    this.initialized = true;
    
    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredInteractions().catch(error => {
        console.error('Error during welcome button cleanup:', error);
      });
    }, 5 * 60 * 1000);
  }

  // ===== DATABASE OPERATIONS =====

  async writeToDatabase(key, data) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      const updateData = { ...data };
      delete updateData._id;

      await Model.updateOne(query, { $set: updateData }, { upsert: true });
    } catch (error) {
      throw new DatabaseWriteError(`Failed to write welcome button data for ${key}`, error);
    }
  }

  async readFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      const doc = await Model.findOne(query).lean();
      return doc || null;
    } catch (error) {
      console.error(`Error reading welcome button data for ${key}:`, error.message);
      return null;
    }
  }

  async deleteFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      await Model.deleteOne(query);
    } catch (error) {
      throw new DatabaseWriteError(`Failed to delete welcome button data for ${key}`, error);
    }
  }

  // ===== WELCOME BUTTON OPERATIONS =====

  /**
   * Track a welcome button interaction
   */
  async trackInteraction(guildId, messageId, userId) {
    if (!guildId || !messageId || !userId) {
      throw new ValidationError('Missing required interaction data');
    }

    const interactionId = `${guildId}_${messageId}_${userId}`;
    
    const interactionData = {
      guildId,
      messageId,
      userId,
      interactionId,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
    };

    await this.set(interactionId, interactionData);
    return interactionData;
  }

  /**
   * Check if user has already interacted with this welcome button
   */
  async hasUserInteracted(guildId, messageId, userId) {
    const interactionId = `${guildId}_${messageId}_${userId}`;
    const interaction = await this.get(interactionId);
    
    if (!interaction) {
      return false;
    }

    // Check if interaction has expired
    if (interaction.expiresAt && new Date() > new Date(interaction.expiresAt)) {
      // Clean up expired interaction
      await this.delete(interactionId);
      return false;
    }

    return true;
  }

  /**
   * Clean up expired interactions
   */
  async cleanupExpiredInteractions() {
    try {
      const Model = this.getModel();
      const now = new Date();
      
      // Remove expired interactions from database
      await Model.deleteMany({
        expiresAt: { $lt: now }
      });

      // Clean up cache - iterate through cache and remove expired items
      try {
        if (this.cache && typeof this.cache.keys === 'function') {
          const cacheKeys = Array.from(this.cache.keys());
          for (const key of cacheKeys) {
            const interaction = this.cache.get(key);
            if (interaction && interaction.expiresAt && now > new Date(interaction.expiresAt)) {
              this.cache.invalidate(key);
            }
          }
        }
      } catch (cacheError) {
        console.warn('Could not access cache keys for cleanup, skipping cache cleanup:', cacheError.message);
      }
    } catch (error) {
      console.error('Error cleaning up expired welcome button interactions:', error);
    }
  }

  /**
   * Get all interactions for a message (for debugging)
   */
  async getMessageInteractions(guildId, messageId) {
    try {
      const Model = this.getModel();
      const interactions = await Model.find({ 
        guildId, 
        messageId,
        expiresAt: { $gt: new Date() } // Only non-expired
      }).lean();
      
      return interactions;
    } catch (error) {
      console.error(`Error getting message interactions:`, error);
      return [];
    }
  }

  /**
   * Shutdown service and cleanup resources
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    await super.shutdown();
  }
}

module.exports = WelcomeButtonService;