const { getService } = require('../index');

/**
 * Antinuke Service
 * Manages antinuke protection system
 */
class AntinukeService {
  constructor() {
    this.actionTracking = new Map(); // Track actions per user per guild
  }

  /**
   * Get guild service instance
   * @returns {Object} Guild service
   */
  getGuildService() {
    return getService('guild');
  }

  /**
   * Get antinuke settings for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Antinuke settings
   */
  async getSettings(guildId) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = this.getDefaultSettings();
      await guildService.set(guildId, guildData);
    }
    
    return guildData.Antinuke;
  }

  /**
   * Get default antinuke settings
   * @returns {Object} Default settings
   */
  getDefaultSettings() {
    return {
      enabled: false,
      whitelist: [],
      admins: [],
      modules: {
        role: { enabled: false, limit: 3, timeframe: 10000, punishment: 'strip' },
        kick: { enabled: false, limit: 3, timeframe: 10000, punishment: 'strip' },
        ban: { enabled: false, limit: 3, timeframe: 10000, punishment: 'strip' },
        channel: { enabled: false, limit: 3, timeframe: 10000, punishment: 'strip' },
        webhook: { enabled: false, limit: 3, timeframe: 10000, punishment: 'strip' },
        botadd: { enabled: false, punishment: 'kick' },
        permissions: { enabled: false, punishment: 'strip', watched: [] }
      },
      logs: []
    };
  }

  /**
   * Check if user is whitelisted
   * @param {string} guildId - Guild ID
   * @param {string} userId - User/Bot ID
   * @returns {Promise<boolean>} True if whitelisted
   */
  async isWhitelisted(guildId, userId) {
    const settings = await this.getSettings(guildId);
    return settings.whitelist.some(w => w.id === userId);
  }

  /**
   * Check if user is antinuke admin
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if admin
   */
  async isAdmin(guildId, userId) {
    const settings = await this.getSettings(guildId);
    return settings.admins.some(a => a.userId === userId);
  }

  /**
   * Add user/bot to whitelist
   * @param {string} guildId - Guild ID
   * @param {string} targetId - User/Bot ID to whitelist
   * @param {string} type - 'user' or 'bot'
   * @param {string} addedBy - User ID who added
   * @returns {Promise<boolean>} Success status
   */
  async addToWhitelist(guildId, targetId, type, addedBy) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = this.getDefaultSettings();
    }

    // Check if already whitelisted
    if (guildData.Antinuke.whitelist.some(w => w.id === targetId)) {
      return false;
    }

    guildData.Antinuke.whitelist.push({
      id: targetId,
      type: type,
      addedBy: addedBy,
      addedAt: new Date()
    });

    await guildService.set(guildId, guildData);
    return true;
  }

  /**
   * Remove user/bot from whitelist
   * @param {string} guildId - Guild ID
   * @param {string} targetId - User/Bot ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeFromWhitelist(guildId, targetId) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke || !guildData.Antinuke.whitelist) {
      return false;
    }

    const initialLength = guildData.Antinuke.whitelist.length;
    guildData.Antinuke.whitelist = guildData.Antinuke.whitelist.filter(w => w.id !== targetId);

    if (guildData.Antinuke.whitelist.length < initialLength) {
      await guildService.set(guildId, guildData);
      return true;
    }

    return false;
  }

  /**
   * Get whitelist
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Whitelist array
   */
  async getWhitelist(guildId) {
    const settings = await this.getSettings(guildId);
    return settings.whitelist || [];
  }

  /**
   * Add antinuke admin
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID to add as admin
   * @param {string} addedBy - User ID who added
   * @returns {Promise<boolean>} Success status
   */
  async addAdmin(guildId, userId, addedBy) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = this.getDefaultSettings();
    }

    // Check if already admin
    if (guildData.Antinuke.admins.some(a => a.userId === userId)) {
      return false;
    }

    guildData.Antinuke.admins.push({
      userId: userId,
      addedBy: addedBy,
      addedAt: new Date()
    });

    await guildService.set(guildId, guildData);
    return true;
  }

  /**
   * Remove antinuke admin
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeAdmin(guildId, userId) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke || !guildData.Antinuke.admins) {
      return false;
    }

    const initialLength = guildData.Antinuke.admins.length;
    guildData.Antinuke.admins = guildData.Antinuke.admins.filter(a => a.userId !== userId);

    if (guildData.Antinuke.admins.length < initialLength) {
      await guildService.set(guildId, guildData);
      return true;
    }

    return false;
  }

  /**
   * Get admins list
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Admins array
   */
  async getAdmins(guildId) {
    const settings = await this.getSettings(guildId);
    return settings.admins || [];
  }

  /**
   * Toggle module on/off
   * @param {string} guildId - Guild ID
   * @param {string} moduleName - Module name (role, kick, ban, etc.)
   * @param {boolean} enabled - Enable or disable
   * @param {Object} options - Optional settings (threshold, punishment)
   * @returns {Promise<boolean>} Success status
   */
  async toggleModule(guildId, moduleName, enabled, options = {}) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = this.getDefaultSettings();
    }

    if (!guildData.Antinuke.modules[moduleName]) {
      return false;
    }

    guildData.Antinuke.modules[moduleName].enabled = enabled;

    // Update threshold if provided
    if (options.threshold !== undefined && guildData.Antinuke.modules[moduleName].limit !== undefined) {
      const threshold = parseInt(options.threshold);
      if (threshold >= 1 && threshold <= 10) {
        guildData.Antinuke.modules[moduleName].limit = threshold;
      }
    }

    // Update punishment if provided
    if (options.punishment && ['strip', 'kick', 'ban'].includes(options.punishment)) {
      guildData.Antinuke.modules[moduleName].punishment = options.punishment;
    }

    await guildService.set(guildId, guildData);
    return true;
  }

  /**
   * Update module settings
   * @param {string} guildId - Guild ID
   * @param {string} moduleName - Module name
   * @param {Object} settings - Settings to update (threshold, punishment)
   * @returns {Promise<boolean>} Success status
   */
  async updateModuleSettings(guildId, moduleName, settings) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = this.getDefaultSettings();
    }

    if (!guildData.Antinuke.modules[moduleName]) {
      return false;
    }

    // Update threshold
    if (settings.threshold !== undefined && guildData.Antinuke.modules[moduleName].limit !== undefined) {
      const threshold = parseInt(settings.threshold);
      if (threshold >= 1 && threshold <= 10) {
        guildData.Antinuke.modules[moduleName].limit = threshold;
      }
    }

    // Update punishment
    if (settings.punishment && ['strip', 'kick', 'ban'].includes(settings.punishment)) {
      guildData.Antinuke.modules[moduleName].punishment = settings.punishment;
    }

    await guildService.set(guildId, guildData);
    return true;
  }

  /**
   * Add watched permission
   * @param {string} guildId - Guild ID
   * @param {string} permission - Permission name
   * @returns {Promise<boolean>} Success status
   */
  async addWatchedPermission(guildId, permission) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = this.getDefaultSettings();
    }

    if (!guildData.Antinuke.modules.permissions.watched) {
      guildData.Antinuke.modules.permissions.watched = [];
    }

    if (guildData.Antinuke.modules.permissions.watched.includes(permission)) {
      return false;
    }

    guildData.Antinuke.modules.permissions.watched.push(permission);
    await guildService.set(guildId, guildData);
    return true;
  }

  /**
   * Remove watched permission
   * @param {string} guildId - Guild ID
   * @param {string} permission - Permission name
   * @returns {Promise<boolean>} Success status
   */
  async removeWatchedPermission(guildId, permission) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke || !guildData.Antinuke.modules.permissions.watched) {
      return false;
    }

    const initialLength = guildData.Antinuke.modules.permissions.watched.length;
    guildData.Antinuke.modules.permissions.watched = guildData.Antinuke.modules.permissions.watched.filter(p => p !== permission);

    if (guildData.Antinuke.modules.permissions.watched.length < initialLength) {
      await guildService.set(guildId, guildData);
      return true;
    }

    return false;
  }

  /**
   * Track action and return recent actions within timeframe
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} actionType - Action type (role, kick, ban, etc.)
   * @param {number} timeframe - Timeframe in ms to consider (default 10000)
   * @returns {Array} Array of action timestamps within timeframe
   */
  trackAction(guildId, userId, actionType, timeframe = 10000) {
    const key = `${guildId}-${userId}-${actionType}`;
    const now = Date.now();
    
    if (!this.actionTracking.has(key)) {
      this.actionTracking.set(key, []);
    }

    const actions = this.actionTracking.get(key);
    actions.push(now);

    // Clean up old actions using the module's timeframe (with some buffer)
    const cleanupTime = Math.max(timeframe * 2, 60000); // At least 1 minute or 2x timeframe
    const filtered = actions.filter(time => now - time < cleanupTime);
    this.actionTracking.set(key, filtered);

    // Return only actions within the actual timeframe for checking
    return filtered.filter(time => now - time < timeframe);
  }

  /**
   * Check if action should be blocked
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} actionType - Action type
   * @param {Object} guild - Discord guild object (optional, for owner check)
   * @returns {Promise<Object>} { blocked: boolean, reason: string }
   */
  async checkAction(guildId, userId, actionType, guild = null) {
    const settings = await this.getSettings(guildId);

    // If antinuke not enabled, allow
    if (!settings.enabled) {
      return { blocked: false };
    }

    // If server owner, always allow
    if (guild && guild.ownerId === userId) {
      return { blocked: false };
    }

    // If whitelisted, allow
    if (await this.isWhitelisted(guildId, userId)) {
      return { blocked: false };
    }

    // If antinuke admin, allow
    if (await this.isAdmin(guildId, userId)) {
      return { blocked: false };
    }

    // Check if module is enabled
    const module = settings.modules[actionType];
    if (!module || !module.enabled) {
      return { blocked: false };
    }

    // Track action and get recent actions within module's timeframe
    const actions = this.trackAction(guildId, userId, actionType, module.timeframe);

    // Check if limit exceeded
    if (actions.length > module.limit) {
      return {
        blocked: true,
        reason: `Exceeded ${actionType} limit (${module.limit} actions in ${module.timeframe / 1000}s)`
      };
    }

    return { blocked: false };
  }

  /**
   * Log antinuke action
   * @param {string} guildId - Guild ID
   * @param {string} action - Action description
   * @param {string} userId - User ID
   * @param {string} details - Additional details
   * @returns {Promise<void>}
   */
  async logAction(guildId, action, userId, details = null) {
    const guildService = this.getGuildService();
    const guildData = await guildService.ensureGuildData(guildId);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = this.getDefaultSettings();
    }

    if (!guildData.Antinuke.logs) {
      guildData.Antinuke.logs = [];
    }

    guildData.Antinuke.logs.push({
      action,
      userId,
      details,
      timestamp: new Date()
    });

    // Keep only last 100 logs
    if (guildData.Antinuke.logs.length > 100) {
      guildData.Antinuke.logs = guildData.Antinuke.logs.slice(-100);
    }

    await guildService.set(guildId, guildData);
  }

  /**
   * Apply punishment to a user
   * @param {Object} guild - Discord guild
   * @param {string} userId - User ID to punish
   * @param {string} punishment - Punishment type (strip/kick/ban)
   * @param {string} reason - Reason for punishment
   * @param {Array} permissions - Permissions to strip (if punishment is strip)
   * @returns {Promise<boolean>} Success status
   */
  async applyPunishment(guild, userId, punishment, reason, permissions = []) {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return false;

      switch (punishment) {
        case 'strip': {
          // Remove roles with dangerous permissions
          const dangerousRoles = member.roles.cache.filter(r => {
            if (r.id === guild.id) return false; // Skip @everyone
            
            // Check if role has any of the specified permissions
            if (permissions.length > 0) {
              return permissions.some(perm => r.permissions.has(perm));
            }
            
            return false;
          });
          
          for (const [, role] of dangerousRoles) {
            await member.roles.remove(role, reason).catch(() => {});
          }
          return true;
        }

        case 'kick': {
          await member.kick(reason).catch(() => {});
          return true;
        }

        case 'ban': {
          await member.ban({ reason, deleteMessageSeconds: 0 }).catch(() => {});
          return true;
        }

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }
}

module.exports = AntinukeService;
