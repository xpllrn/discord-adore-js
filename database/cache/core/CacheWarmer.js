const chalk = require('chalk');

/**
 * Intelligent Cache Warming System
 * Preloads frequently accessed data and implements smart warming strategies
 */
class CacheWarmer {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.warmingStrategies = new Map();
    this.accessPatterns = new Map();
    this.warmingQueue = [];
    this.isWarming = false;
    this.stats = {
      totalWarmed: 0,
      strategiesExecuted: 0,
      accessPatternsTracked: 0,
      warmingTime: 0
    };

    // Initialize default warming strategies
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default warming strategies
   */
  initializeDefaultStrategies() {
    // Strategy 1: Warm frequently accessed guilds
    this.addWarmingStrategy('frequent-guilds', {
      priority: 1,
      interval: 5 * 60 * 1000, // 5 minutes
      execute: async () => {
        const frequentGuilds = this.getFrequentlyAccessedKeys('guild', 20);
        if (frequentGuilds.length > 0) {
          await this.warmGuildData(frequentGuilds);
        }
      }
    });

    // Strategy 2: Warm active users
    this.addWarmingStrategy('active-users', {
      priority: 2,
      interval: 10 * 60 * 1000, // 10 minutes
      execute: async () => {
        const activeUsers = this.getFrequentlyAccessedKeys('user', 50);
        if (activeUsers.length > 0) {
          await this.warmUserData(activeUsers);
        }
      }
    });

    // Strategy 3: Warm gambling leaderboard data
    this.addWarmingStrategy('gambling-leaderboard', {
      priority: 3,
      interval: 15 * 60 * 1000, // 15 minutes
      execute: async () => {
        await this.warmGamblingLeaderboard();
      }
    });

    // Strategy 4: Warm system configuration
    this.addWarmingStrategy('system-config', {
      priority: 4,
      interval: 30 * 60 * 1000, // 30 minutes
      execute: async () => {
        await this.warmSystemData();
      }
    });

    // Strategy 5: Predictive warming based on time patterns
    this.addWarmingStrategy('predictive-warming', {
      priority: 5,
      interval: 20 * 60 * 1000, // 20 minutes
      execute: async () => {
        await this.predictiveWarm();
      }
    });
  }

  /**
   * Add a custom warming strategy
   * @param {string} name - Strategy name
   * @param {Object} strategy - Strategy configuration
   */
  addWarmingStrategy(name, strategy) {
    this.warmingStrategies.set(name, {
      ...strategy,
      lastExecuted: 0,
      executions: 0
    });
  }

  /**
   * Start cache warming
   */
  start() {
    console.log(chalk.blue('🔥 Cache warming system started'));
    
    // Execute warming strategies periodically
    setInterval(() => {
      this.executeWarmingStrategies();
    }, 60000); // Check every minute

    // Initial warming
    setTimeout(() => {
      this.executeWarmingStrategies();
    }, 5000); // Start after 5 seconds
  }

  /**
   * Execute warming strategies based on priority and intervals
   */
  async executeWarmingStrategies() {
    if (this.isWarming) return;

    const now = Date.now();
    const strategiesToExecute = [];

    // Find strategies that need to be executed
    for (const [name, strategy] of this.warmingStrategies) {
      const timeSinceLastExecution = now - strategy.lastExecuted;
      if (timeSinceLastExecution >= strategy.interval) {
        strategiesToExecute.push({ name, strategy });
      }
    }

    if (strategiesToExecute.length === 0) return;

    // Sort by priority
    strategiesToExecute.sort((a, b) => a.strategy.priority - b.strategy.priority);

    this.isWarming = true;
    const startTime = Date.now();

    try {
      for (const { name, strategy } of strategiesToExecute) {
        try {
          console.log(chalk.gray(`🔥 Executing warming strategy: ${name}`));
          await strategy.execute();
          strategy.lastExecuted = now;
          strategy.executions++;
          this.stats.strategiesExecuted++;
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Warming strategy ${name} failed:`, error.message));
        }
      }
    } finally {
      this.isWarming = false;
      this.stats.warmingTime += Date.now() - startTime;
    }
  }

  /**
   * Track access patterns for intelligent warming
   * @param {string} cacheType - Type of cache (guild, user, system)
   * @param {string} key - Cache key
   */
  trackAccess(cacheType, key) {
    const accessKey = `${cacheType}:${key}`;
    const now = Date.now();
    
    if (!this.accessPatterns.has(accessKey)) {
      this.accessPatterns.set(accessKey, {
        count: 0,
        lastAccess: now,
        firstAccess: now,
        hourlyPattern: new Array(24).fill(0),
        dailyPattern: new Array(7).fill(0)
      });
    }

    const pattern = this.accessPatterns.get(accessKey);
    pattern.count++;
    pattern.lastAccess = now;
    
    // Track hourly and daily patterns
    const hour = new Date(now).getHours();
    const day = new Date(now).getDay();
    pattern.hourlyPattern[hour]++;
    pattern.dailyPattern[day]++;

    this.stats.accessPatternsTracked++;
  }

  /**
   * Get frequently accessed keys
   * @param {string} cacheType - Cache type
   * @param {number} limit - Number of keys to return
   * @returns {Array} Array of frequently accessed keys
   */
  getFrequentlyAccessedKeys(cacheType, limit = 10) {
    const keys = [];
    
    for (const [accessKey, pattern] of this.accessPatterns) {
      if (accessKey.startsWith(`${cacheType}:`)) {
        const key = accessKey.substring(cacheType.length + 1);
        keys.push({
          key,
          count: pattern.count,
          lastAccess: pattern.lastAccess,
          score: this.calculateAccessScore(pattern)
        });
      }
    }

    return keys
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.key);
  }

  /**
   * Calculate access score for prioritizing warming
   * @param {Object} pattern - Access pattern
   * @returns {number} Access score
   */
  calculateAccessScore(pattern) {
    const now = Date.now();
    const recency = Math.max(0, 1 - (now - pattern.lastAccess) / (24 * 60 * 60 * 1000)); // Recency factor
    const frequency = Math.log(pattern.count + 1); // Frequency factor
    const consistency = this.calculateConsistency(pattern.hourlyPattern); // Consistency factor
    
    return frequency * recency * consistency;
  }

  /**
   * Calculate consistency score from hourly pattern
   * @param {Array} hourlyPattern - Hourly access pattern
   * @returns {number} Consistency score
   */
  calculateConsistency(hourlyPattern) {
    const total = hourlyPattern.reduce((sum, count) => sum + count, 0);
    if (total === 0) return 0;

    const average = total / hourlyPattern.length;
    const variance = hourlyPattern.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / hourlyPattern.length;
    
    // Lower variance means more consistent access pattern
    return Math.max(0, 1 - variance / (average * average + 1));
  }

  /**
   * Warm guild data
   * @param {Array} guildIds - Array of guild IDs to warm
   */
  async warmGuildData(guildIds) {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      if (!models || !models.Guild) return;

      const guilds = await models.Guild.find({
        GuildID: { $in: guildIds }
      }).lean();

      const keyValuePairs = {};
      for (const guild of guilds) {
        keyValuePairs[guild.GuildID] = guild;
      }

      if (Object.keys(keyValuePairs).length > 0) {
        await this.cacheManager.guildCache.mset(keyValuePairs);
        this.stats.totalWarmed += Object.keys(keyValuePairs).length;
      }
    } catch (error) {
      console.warn('Guild warming failed:', error.message);
    }
  }

  /**
   * Warm user data
   * @param {Array} userIds - Array of user IDs to warm
   */
  async warmUserData(userIds) {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      if (!models || !models.User) return;

      const users = await models.User.find({
        UserID: { $in: userIds }
      }).lean();

      const keyValuePairs = {};
      for (const user of users) {
        keyValuePairs[user.UserID] = user;
      }

      if (Object.keys(keyValuePairs).length > 0) {
        await this.cacheManager.userCache.mset(keyValuePairs);
        this.stats.totalWarmed += Object.keys(keyValuePairs).length;
      }
    } catch (error) {
      console.warn('User warming failed:', error.message);
    }
  }

  /**
   * Warm gambling leaderboard data
   */
  async warmGamblingLeaderboard() {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      if (!models || !models.User) return;

      // Warm top 100 richest users
      const topUsers = await models.User.find({
        $or: [
          { 'Gambling.wallet': { $gt: 0 } },
          { 'Gambling.bank': { $gt: 0 } }
        ]
      })
      .sort({ 
        $expr: { 
          $add: [
            { $ifNull: ['$Gambling.wallet', 0] },
            { $ifNull: ['$Gambling.bank', 0] }
          ]
        }
      })
      .limit(100)
      .lean();

      const keyValuePairs = {};
      for (const user of topUsers) {
        keyValuePairs[user.UserID] = user;
      }

      if (Object.keys(keyValuePairs).length > 0) {
        await this.cacheManager.userCache.mset(keyValuePairs);
        this.stats.totalWarmed += Object.keys(keyValuePairs).length;
      }
    } catch (error) {
      console.warn('Gambling leaderboard warming failed:', error.message);
    }
  }

  /**
   * Warm system data
   */
  async warmSystemData() {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      if (!models || !models.System) return;

      const systems = await models.System.find({}).lean();
      
      const keyValuePairs = {};
      for (const system of systems) {
        keyValuePairs[system._id] = system;
      }

      if (Object.keys(keyValuePairs).length > 0) {
        await this.cacheManager.systemCache.mset(keyValuePairs);
        this.stats.totalWarmed += Object.keys(keyValuePairs).length;
      }
    } catch (error) {
      console.warn('System warming failed:', error.message);
    }
  }

  /**
   * Predictive warming based on access patterns
   */
  async predictiveWarm() {
    const now = Date.now();
    const currentHour = new Date(now).getHours();
    const currentDay = new Date(now).getDay();

    // Find keys that are likely to be accessed soon based on patterns
    const predictedKeys = {
      guild: [],
      user: []
    };

    for (const [accessKey, pattern] of this.accessPatterns) {
      const [cacheType, key] = accessKey.split(':', 2);
      
      if (cacheType !== 'guild' && cacheType !== 'user') continue;

      // Check if this key is typically accessed at this time
      const hourlyScore = pattern.hourlyPattern[currentHour] / Math.max(1, pattern.count);
      const dailyScore = pattern.dailyPattern[currentDay] / Math.max(1, pattern.count);
      
      if (hourlyScore > 0.1 || dailyScore > 0.1) { // 10% threshold
        predictedKeys[cacheType].push(key);
      }
    }

    // Warm predicted keys
    if (predictedKeys.guild.length > 0) {
      await this.warmGuildData(predictedKeys.guild.slice(0, 20));
    }
    
    if (predictedKeys.user.length > 0) {
      await this.warmUserData(predictedKeys.user.slice(0, 50));
    }
  }

  /**
   * Get warming statistics
   * @returns {Object} Warming statistics
   */
  getStats() {
    return {
      ...this.stats,
      strategiesCount: this.warmingStrategies.size,
      accessPatternsCount: this.accessPatterns.size,
      isWarming: this.isWarming,
      averageWarmingTime: this.stats.strategiesExecuted > 0 
        ? this.stats.warmingTime / this.stats.strategiesExecuted 
        : 0
    };
  }

  /**
   * Clear access patterns older than specified time
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanupAccessPatterns(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    const now = Date.now();
    let cleaned = 0;

    for (const [key, pattern] of this.accessPatterns) {
      if (now - pattern.lastAccess > maxAge) {
        this.accessPatterns.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(chalk.gray(`🧹 Cleaned ${cleaned} old access patterns`));
    }
  }
}

module.exports = CacheWarmer;
