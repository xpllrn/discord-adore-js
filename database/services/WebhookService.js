const BaseService = require('./core/BaseService');
const { ValidationError, NotFoundError, DatabaseWriteError } = require('./core/errors');

/**
 * Webhook Service
 * Handles all webhook-related data operations
 */
class WebhookService extends BaseService {
  constructor() {
    super({
      modelName: 'Webhook',
      keyField: 'webhookId',
      database: 'local',
      ttl: 30 * 60 * 1000, // 30 minutes TTL
      maxSize: 1000 // Max 1000 webhooks in cache
    });

    this.initialized = true;
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
      throw new DatabaseWriteError(`Failed to write webhook data for ${key}`, error);
    }
  }

  async readFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      const doc = await Model.findOne(query).lean();
      return doc || null;
    } catch (error) {
      console.error(`Error reading webhook data for ${key}:`, error.message);
      return null;
    }
  }

  async deleteFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      await Model.deleteOne(query);
    } catch (error) {
      throw new DatabaseWriteError(`Failed to delete webhook data for ${key}`, error);
    }
  }

  // ===== WEBHOOK OPERATIONS =====

  /**
   * Create a new webhook
   */
  async createWebhook(guildId, name, webhookId, webhookToken, channelId, createdBy) {
    if (!guildId || !name || !webhookId || !webhookToken || !channelId || !createdBy) {
      throw new ValidationError('Missing required webhook data');
    }

    // Generate unique short ID for this guild
    const shortId = await this.generateShortId(guildId);

    const webhookData = {
      guildId,
      shortId,
      name,
      webhookId,
      webhookToken,
      channelId,
      createdBy,
      createdAt: new Date(),
      lastUsed: new Date()
    };

    await this.set(webhookId, webhookData);
    return webhookData;
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId) {
    return await this.get(webhookId);
  }

  /**
   * Get webhook by guild and name
   */
  async getWebhookByName(guildId, name) {
    try {
      const Model = this.getModel();
      const webhook = await Model.findOne({ 
        guildId, 
        name: { $regex: new RegExp(`^${name}$`, 'i') } 
      }).lean();
      
      if (webhook) {
        // Cache the result
        await this.set(webhook.webhookId, webhook);
      }
      
      return webhook;
    } catch (error) {
      console.error(`Error finding webhook by name:`, error);
      return null;
    }
  }

  /**
   * Get all webhooks for a guild
   */
  async getGuildWebhooks(guildId) {
    try {
      const Model = this.getModel();
      const webhooks = await Model.find({ guildId }).lean();
      
      // Cache all webhooks
      for (const webhook of webhooks) {
        await this.set(webhook.webhookId, webhook);
      }
      
      return webhooks;
    } catch (error) {
      console.error(`Error getting guild webhooks:`, error);
      return [];
    }
  }

  /**
   * Update webhook last used time
   */
  async updateLastUsed(webhookId) {
    try {
      const webhook = await this.get(webhookId);
      if (webhook) {
        webhook.lastUsed = new Date();
        await this.set(webhookId, webhook);
      }
    } catch (error) {
      console.error(`Error updating webhook last used:`, error);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId) {
    await this.delete(webhookId);
  }

  /**
   * Get webhook by short ID
   */
  async getWebhookByShortId(guildId, shortId) {
    try {
      const Model = this.getModel();
      const webhook = await Model.findOne({ 
        guildId, 
        shortId: shortId.toLowerCase()
      }).lean();
      
      if (webhook) {
        // Cache the result
        await this.set(webhook.webhookId, webhook);
      }
      
      return webhook;
    } catch (error) {
      console.error(`Error finding webhook by short ID:`, error);
      return null;
    }
  }

  /**
   * Generate unique short ID for guild
   */
  async generateShortId(guildId) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      let shortId = '';
      for (let i = 0; i < 4; i++) {
        shortId += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      // Check if this short ID already exists in this guild
      const existing = await this.getWebhookByShortId(guildId, shortId);
      if (!existing) {
        return shortId;
      }

      attempts++;
    }

    // Fallback to timestamp-based ID if we can't generate a unique one
    return Date.now().toString().slice(-4);
  }

  /**
   * Check if webhook name exists in guild
   */
  async webhookNameExists(guildId, name, excludeId = null) {
    try {
      const Model = this.getModel();
      const query = { 
        guildId, 
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      };
      
      if (excludeId) {
        query.webhookId = { $ne: excludeId };
      }
      
      const existing = await Model.findOne(query).lean();
      return !!existing;
    } catch (error) {
      console.error(`Error checking webhook name:`, error);
      return false;
    }
  }
}

module.exports = WebhookService;