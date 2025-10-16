/**
 * Guild Cache Model
 * Auto-fetching wrapper for guild data using TTL cache system
 * All methods automatically handle cache-first reads and background database writes
 */
class Guild {
  constructor() {
    // Get the auto-fetch cache from the unified interface
    const { guildCache } = require('../index');
    this.cache = guildCache;
  }

  // ===== PREFIX METHODS =====
  async getPrefix(guildId) {
    const prefix = await this.cache.getField(guildId, 'Prefix');
    return prefix || ','; // Default prefix if null/undefined
  }

  async setPrefix(guildId, prefix) {
    return await this.cache.setField(guildId, 'Prefix', prefix);
  }

  // ===== WELCOME SYSTEM =====
  async getWelcomeChannel(guildId) {
    return await this.cache.getField(guildId, 'WelcomeChannel');
  }

  async getWelcomeMessage(guildId) {
    return await this.cache.getField(guildId, 'WelcomeMessage');
  }

  async setWelcome(guildId, channelId, message) {
    await this.cache.setField(guildId, 'WelcomeChannel', channelId);
    return await this.cache.setField(guildId, 'WelcomeMessage', message);
  }

  async setWelcomeChannel(guildId, channelId) {
    return await this.cache.setField(guildId, 'WelcomeChannel', channelId);
  }

  async removeWelcome(guildId) {
    await this.cache.setField(guildId, 'WelcomeChannel', null);
    return await this.cache.setField(guildId, 'WelcomeMessage', null);
  }

  // ===== LEAVE SYSTEM =====
  async getLeaveChannel(guildId) {
    return await this.cache.getField(guildId, 'LeaveChannel');
  }

  async getLeaveMessage(guildId) {
    return await this.cache.getField(guildId, 'LeaveMessage');
  }

  async setLeave(guildId, channelId, message) {
    await this.cache.setField(guildId, 'LeaveChannel', channelId);
    return await this.cache.setField(guildId, 'LeaveMessage', message);
  }

  async removeLeave(guildId) {
    await this.cache.setField(guildId, 'LeaveChannel', null);
    return await this.cache.setField(guildId, 'LeaveMessage', null);
  }

  // ===== BOOST SYSTEM =====
  async getBoostChannel(guildId) {
    return await this.cache.getField(guildId, 'BoostChannel');
  }

  async getBoostMessage(guildId) {
    return await this.cache.getField(guildId, 'BoostMessage');
  }

  async getBoostRole(guildId) {
    return await this.cache.getField(guildId, 'BoostRole');
  }

  async setBoost(guildId, channelId, message) {
    await this.cache.setField(guildId, 'BoostChannel', channelId);
    return await this.cache.setField(guildId, 'BoostMessage', message);
  }

  async setBoostChannel(guildId, channelId) {
    return await this.cache.setField(guildId, 'BoostChannel', channelId);
  }

  async setBoostRole(guildId, roleId) {
    return await this.cache.setField(guildId, 'BoostRole', roleId);
  }

  async removeBoost(guildId) {
    await this.cache.setField(guildId, 'BoostChannel', null);
    return await this.cache.setField(guildId, 'BoostMessage', null);
  }

  async removeBoostRole(guildId) {
    return await this.cache.setField(guildId, 'BoostRole', null);
  }

  // ===== VANITY SYSTEM =====
  async getVanity(guildId) {
    return await this.cache.getField(guildId, 'Vanity');
  }

  async getVanityRoles(guildId) {
    return await this.cache.getField(guildId, 'VanityRoles') || [];
  }

  async getVanityMessage(guildId) {
    return await this.cache.getField(guildId, 'VanityMessage');
  }

  async getVanityLogChannel(guildId) {
    return await this.cache.getField(guildId, 'VanityLogChannel');
  }

  async setVanity(guildId, vanityText) {
    return await this.cache.setField(guildId, 'Vanity', vanityText);
  }

  async setVanityRoles(guildId, roles) {
    return await this.cache.setField(guildId, 'VanityRoles', roles);
  }

  async setVanityMessage(guildId, channelId, message) {
    await this.cache.setField(guildId, 'VanityLogChannel', channelId);
    return await this.cache.setField(guildId, 'VanityMessage', message);
  }

  async removeVanityMessage(guildId) {
    await this.cache.setField(guildId, 'VanityLogChannel', null);
    return await this.cache.setField(guildId, 'VanityMessage', null);
  }

  // ===== JAIL SYSTEM =====
  async getJailRoleID(guildId) {
    return await this.cache.getField(guildId, 'JailRoleID');
  }

  async getJailChannelID(guildId) {
    return await this.cache.getField(guildId, 'JailChannelID');
  }

  async setJail(guildId, roleId, channelId) {
    await this.cache.setField(guildId, 'JailRoleID', roleId);
    return await this.cache.setField(guildId, 'JailChannelID', channelId);
  }

  // ===== AFK SYSTEM =====
  async getAFKStatus(guildId, userId) {
    const afkList = await this.cache.getField(guildId, 'AFK') || [];
    return afkList.find(afk => afk.userId === userId);
  }

  async setAFKStatus(guildId, userId, message = 'AFK') {
    let afkList = await this.cache.getField(guildId, 'AFK') || [];
    afkList = afkList.filter(afk => afk.userId !== userId);
    afkList.push({ userId, message, since: new Date() });
    return await this.cache.setField(guildId, 'AFK', afkList);
  }

  async removeAFKStatus(guildId, userId) {
    let afkList = await this.cache.getField(guildId, 'AFK') || [];
    afkList = afkList.filter(afk => afk.userId !== userId);
    return await this.cache.setField(guildId, 'AFK', afkList);
  }

  // ===== FORCE NICK SYSTEM =====
  async getForceNick(guildId, userId) {
    const forceNickList = await this.cache.getField(guildId, 'ForceNick') || [];
    return forceNickList.find(fn => fn.userId === userId);
  }

  async setForceNick(guildId, userId, nickname, setBy) {
    let forceNickList = await this.cache.getField(guildId, 'ForceNick') || [];
    forceNickList = forceNickList.filter(fn => fn.userId !== userId);
    forceNickList.push({ userId, nickname, setBy, setAt: new Date() });
    return await this.cache.setField(guildId, 'ForceNick', forceNickList);
  }

  async removeForceNick(guildId, userId) {
    let forceNickList = await this.cache.getField(guildId, 'ForceNick') || [];
    forceNickList = forceNickList.filter(fn => fn.userId !== userId);
    return await this.cache.setField(guildId, 'ForceNick', forceNickList);
  }

  async getAllForceNicks(guildId) {
    return await this.cache.getField(guildId, 'ForceNick') || [];
  }

  async clearAllForceNicks(guildId) {
    return await this.cache.setField(guildId, 'ForceNick', []);
  }

  // ===== AUTO ROLES =====
  async getAutoRoles(guildId) {
    return await this.cache.getField(guildId, 'AutoRoles') || [];
  }

  async addAutoRole(guildId, roleId) {
    let autoRoles = await this.cache.getField(guildId, 'AutoRoles') || [];
    if (!autoRoles.includes(roleId)) {
      autoRoles.push(roleId);
      return await this.cache.setField(guildId, 'AutoRoles', autoRoles);
    }
    return true;
  }

  async removeAutoRole(guildId, roleId) {
    let autoRoles = await this.cache.getField(guildId, 'AutoRoles') || [];
    autoRoles = autoRoles.filter(id => id !== roleId);
    return await this.cache.setField(guildId, 'AutoRoles', autoRoles);
  }

  async clearAllAutoRoles(guildId) {
    return await this.cache.setField(guildId, 'AutoRoles', []);
  }

  // ===== AUTO REACT =====
  async getAutoReacts(guildId) {
    return await this.cache.getField(guildId, 'AutoReact') || [];
  }

  async addAutoReact(guildId, word, emojiId, emojiName, isCustom) {
    let autoReacts = await this.cache.getField(guildId, 'AutoReact') || [];
    autoReacts.push({ word: word.toLowerCase(), emojiId, emojiName, isCustom });
    return await this.cache.setField(guildId, 'AutoReact', autoReacts);
  }

  async removeAutoReact(guildId, word) {
    let autoReacts = await this.cache.getField(guildId, 'AutoReact') || [];
    autoReacts = autoReacts.filter(ar => ar.word !== word.toLowerCase());
    return await this.cache.setField(guildId, 'AutoReact', autoReacts);
  }

  async clearAllAutoReacts(guildId) {
    return await this.cache.setField(guildId, 'AutoReact', []);
  }

  // ===== AUTO RESPONDER =====
  async getAutoResponders(guildId) {
    const autoResponders = await this.cache.getField(guildId, 'AutoResponder') || [];

    // Ensure all autoresponders have proper strict field (fix for legacy data)
    return autoResponders.map(ar => ({
      ...ar,
      strict: ar.strict !== undefined ? ar.strict : true
    }));
  }

  async addAutoResponder(guildId, trigger, response, options = {}) {
    let autoResponders = await this.cache.getField(guildId, 'AutoResponder') || [];
    autoResponders.push({
      trigger, response,
      reply: options.reply || false,
      strict: options.strict !== undefined ? options.strict : true,
      delete: options.delete || false,
      selfDestruct: options.selfDestruct || 0
    });
    return await this.cache.setField(guildId, 'AutoResponder', autoResponders);
  }

  async removeAutoResponder(guildId, trigger) {
    let autoResponders = await this.cache.getField(guildId, 'AutoResponder') || [];
    autoResponders = autoResponders.filter(ar => ar.trigger !== trigger);
    return await this.cache.setField(guildId, 'AutoResponder', autoResponders);
  }

  async clearAllAutoResponders(guildId) {
    return await this.cache.setField(guildId, 'AutoResponder', []);
  }

  async findAutoResponder(guildId, trigger) {
    const autoResponders = await this.getAutoResponders(guildId);
    const found = autoResponders.find(ar => ar.trigger === trigger);

    // Ensure strict field is properly set if found
    if (found) {
      return {
        ...found,
        strict: found.strict !== undefined ? found.strict : true
      };
    }

    return found;
  }

  // ===== MODERATION METHODS =====
  async getModerationCases(guildId) {
    return await this.cache.getField(guildId, 'Moderation') || [];
  }

  async getNextCaseId(guildId) {
    const cases = await this.getModerationCases(guildId);
    return cases.length > 0 ? Math.max(...cases.map(c => c.caseId)) + 1 : 1;
  }

  async addModerationCase(guildId, userId, moderatorId, action, reason, duration = null) {
    let cases = await this.getModerationCases(guildId);
    const caseId = await this.getNextCaseId(guildId);

    cases.push({
      caseId,
      userId,
      moderatorId,
      action,
      reason,
      duration,
      timestamp: new Date()
    });

    return await this.cache.setField(guildId, 'Moderation', cases);
  }

  async getUserModerationCases(guildId, userId) {
    const cases = await this.getModerationCases(guildId);
    return cases.filter(c => c.userId === userId);
  }

  async getModerationCase(guildId, caseId) {
    const cases = await this.getModerationCases(guildId);
    return cases.find(c => c.caseId === caseId);
  }

  // ===== MESSAGE STATS METHODS =====
  async getMessageStats(guildId) {
    return await this.cache.getField(guildId, 'MessageStats') || [];
  }

  async trackMessage(guildId, userId) {
    let messageStats = await this.getMessageStats(guildId);

    // Get today's date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find existing entry for user and today
    const existingEntry = messageStats.find(stat =>
      stat.userId === userId &&
      new Date(stat.date).getTime() === today.getTime()
    );

    if (existingEntry) {
      // Increment count for today
      existingEntry.count += 1;
    } else {
      // Create new entry for today
      messageStats.push({
        userId: userId,
        date: today,
        count: 1
      });
    }

    return await this.cache.setField(guildId, 'MessageStats', messageStats);
  }

  // ===== SWEAR TRACKER METHODS =====
  async getSwearTracker(guildId) {
    return await this.cache.getField(guildId, 'SwearTracker') || [];
  }

  async getUserSwearData(guildId, userId) {
    const swearTracker = await this.getSwearTracker(guildId);
    return swearTracker.find(entry => entry.userId === userId);
  }

  async addSwear(guildId, userId, word) {
    let swearTracker = await this.getSwearTracker(guildId);

    // Find or create user entry
    let userEntry = swearTracker.find(entry => entry.userId === userId);
    if (!userEntry) {
      userEntry = {
        userId,
        swears: [],
        totalSwears: 0,
        todaySwears: 0,
        lastSwearDate: new Date()
      };
      swearTracker.push(userEntry);
    }

    // Find or create swear word entry
    let swearEntry = userEntry.swears.find(s => s.word === word.toLowerCase());
    if (!swearEntry) {
      swearEntry = {
        word: word.toLowerCase(),
        count: 0,
        lastUsed: new Date()
      };
      userEntry.swears.push(swearEntry);
    }

    // Update counts
    swearEntry.count += 1;
    swearEntry.lastUsed = new Date();
    userEntry.totalSwears += 1;

    // Check if it's a new day for today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSwearDay = new Date(userEntry.lastSwearDate);
    lastSwearDay.setHours(0, 0, 0, 0);

    if (today.getTime() !== lastSwearDay.getTime()) {
      userEntry.todaySwears = 1;
    } else {
      userEntry.todaySwears += 1;
    }

    userEntry.lastSwearDate = new Date();

    return await this.cache.setField(guildId, 'SwearTracker', swearTracker);
  }

  // Clear all swear tracking data
  async clearAllSwearData(guildId) {
    return await this.cache.setField(guildId, 'SwearTracker', []);
  }

  async getSwearLeaderboard(guildId) {
    const swearTracker = await this.getSwearTracker(guildId);

    // Calculate totals and sort by total swears
    const leaderboard = swearTracker
      .map(entry => ({
        userId: entry.userId,
        totalSwears: entry.totalSwears || 0,
        todaySwears: entry.todaySwears || 0,
        calculatedTotal: entry.swears ? entry.swears.reduce((total, swear) => total + swear.count, 0) : 0
      }))
      .filter(entry => entry.calculatedTotal > 0)
      .sort((a, b) => b.calculatedTotal - a.calculatedTotal);

    return leaderboard;
  }

  async getUserSwearPosition(guildId, userId) {
    const leaderboard = await this.getSwearLeaderboard(guildId);
    const position = leaderboard.findIndex(entry => entry.userId === userId);
    return position >= 0 ? position + 1 : null;
  }

  async clearSwearTracker(guildId) {
    return await this.cache.setField(guildId, 'SwearTracker', []);
  }

  async resetSwearTracker(guildId) {
    return await this.clearSwearTracker(guildId);
  }

  // ===== REMINDERS METHODS =====
  async getReminders(guildId) {
    return await this.cache.getField(guildId, 'Reminders') || [];
  }

  async addReminder(guildId, userId, content, remindAt, channelId) {
    let reminders = await this.getReminders(guildId);
    const id = reminders.length > 0 ? Math.max(...reminders.map(r => r.id)) + 1 : 1;

    reminders.push({
      id,
      userId,
      content,
      remindAt,
      channelId,
      createdAt: new Date()
    });

    return await this.cache.setField(guildId, 'Reminders', reminders);
  }

  async removeReminder(guildId, reminderId) {
    let reminders = await this.getReminders(guildId);
    reminders = reminders.filter(r => r.id !== reminderId);
    return await this.cache.setField(guildId, 'Reminders', reminders);
  }

  async getUserReminders(guildId, userId) {
    const reminders = await this.getReminders(guildId);
    return reminders.filter(r => r.userId === userId);
  }

  async updateReminderNextTrigger(guildId, reminderId, nextTrigger) {
    let reminders = await this.getReminders(guildId);
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.nextTrigger = nextTrigger;
      await this.cache.setField(guildId, 'Reminders', reminders);
      return true;
    }
    return false;
  }

  // ===== GUILD NAME HISTORY METHODS =====
  async getGuildNameHistory(guildId) {
    return await this.cache.getField(guildId, 'GuildNameHistory') || [];
  }

  async addGuildNameChange(guildId, oldName, newName, changedBy) {
    const history = await this.getGuildNameHistory(guildId);
    history.push({ oldName, newName, changedBy, changedAt: new Date() });
    return await this.cache.setField(guildId, 'GuildNameHistory', history);
  }

  async clearAllGuildNameHistory(guildId) {
    return await this.cache.setField(guildId, 'GuildNameHistory', []);
  }

  // ===== STARBOARD METHODS =====
  async getStarboardChannel(guildId) {
    return await this.cache.getField(guildId, 'StarboardChannel');
  }

  async setStarboardChannel(guildId, channelId) {
    return await this.cache.setField(guildId, 'StarboardChannel', channelId);
  }

  async getStarboardThreshold(guildId) {
    const threshold = await this.cache.getField(guildId, 'StarboardThreshold');
    return threshold || 3; // Default threshold
  }

  async setStarboardThreshold(guildId, threshold) {
    return await this.cache.setField(guildId, 'StarboardThreshold', threshold);
  }

  // Update starboard message count
  async updateStarboardMessageCount(guildId, messageId, count) {
    let starboardMessages = await this.cache.getField(guildId, 'StarboardMessages') || [];

    // Find existing message by originalMessageId (correct field name)
    const existingIndex = starboardMessages.findIndex(msg => msg.originalMessageId === messageId);

    if (existingIndex !== -1) {
      // Update existing message count
      starboardMessages[existingIndex].reactionCount = count;
      starboardMessages[existingIndex].lastUpdated = new Date();
    } else {
      // This should not happen - message should already exist from addStarboardMessage()
      console.warn(`Starboard message not found for originalMessageId: ${messageId}`);
      return false;
    }

    return await this.cache.setField(guildId, 'StarboardMessages', starboardMessages);
  }

  async getStarboardEmoji(guildId) {
    const emoji = await this.cache.getField(guildId, 'StarboardEmoji');
    return emoji || '⭐'; // Default emoji
  }

  async setStarboardEmoji(guildId, emoji) {
    return await this.cache.setField(guildId, 'StarboardEmoji', emoji);
  }

  async getStarboardMessages(guildId) {
    return await this.cache.getField(guildId, 'StarboardMessages') || [];
  }

  async addStarboardMessage(guildId, originalMessageId, starboardMessageId, channelId, authorId, reactionCount) {
    let messages = await this.getStarboardMessages(guildId);
    messages.push({
      originalMessageId,
      starboardMessageId,
      channelId,
      authorId,
      reactionCount,
      createdAt: new Date()
    });
    return await this.cache.setField(guildId, 'StarboardMessages', messages);
  }

  async updateStarboardMessage(guildId, originalMessageId, reactionCount) {
    let messages = await this.getStarboardMessages(guildId);
    const message = messages.find(m => m.originalMessageId === originalMessageId);
    if (message) {
      message.reactionCount = reactionCount;
      return await this.cache.setField(guildId, 'StarboardMessages', messages);
    }
    return false;
  }

  async removeStarboardMessage(guildId, originalMessageId) {
    let messages = await this.getStarboardMessages(guildId);
    messages = messages.filter(m => m.originalMessageId !== originalMessageId);
    return await this.cache.setField(guildId, 'StarboardMessages', messages);
  }

  async findStarboardMessage(guildId, originalMessageId) {
    const messages = await this.getStarboardMessages(guildId);
    return messages.find(m => m.originalMessageId === originalMessageId);
  }

  // ===== VOICE MANAGER METHODS =====
  async getVoiceManager(guildId) {
    return await this.cache.getField(guildId, 'VoiceManager') || {
      enabled: false,
      categoryId: null,
      joinChannelId: null,
      mutedChannelId: null,
      tempChannels: []
    };
  }

  async setVoiceManager(guildId, voiceManager) {
    return await this.cache.setField(guildId, 'VoiceManager', voiceManager);
  }

  async enableVoiceManager(guildId, categoryId, joinChannelId, mutedChannelId) {
    const voiceManager = {
      enabled: true,
      categoryId,
      joinChannelId,
      mutedChannelId,
      tempChannels: []
    };
    return await this.setVoiceManager(guildId, voiceManager);
  }

  async disableVoiceManager(guildId) {
    const voiceManager = {
      enabled: false,
      categoryId: null,
      joinChannelId: null,
      mutedChannelId: null,
      tempChannels: []
    };
    return await this.setVoiceManager(guildId, voiceManager);
  }

  async addTempVoiceChannel(guildId, channelId, ownerId) {
    const voiceManager = await this.getVoiceManager(guildId);
    voiceManager.tempChannels = voiceManager.tempChannels || [];
    voiceManager.tempChannels.push({
      channelId,
      ownerId,
      createdAt: new Date(),
      settings: {
        locked: false,
        hidden: false,
        userLimit: 0,
        rejectedUsers: [],
        permittedUsers: [],
        customName: null
      }
    });
    return await this.setVoiceManager(guildId, voiceManager);
  }

  async removeTempVoiceChannel(guildId, channelId) {
    const voiceManager = await this.getVoiceManager(guildId);
    voiceManager.tempChannels = (voiceManager.tempChannels || []).filter(tc => tc.channelId !== channelId);
    return await this.setVoiceManager(guildId, voiceManager);
  }

  async getTempVoiceChannel(guildId, channelId) {
    const voiceManager = await this.getVoiceManager(guildId);
    const tempChannel = (voiceManager.tempChannels || []).find(tc => tc.channelId === channelId);

    // Ensure settings object exists for backward compatibility
    if (tempChannel && !tempChannel.settings) {
      tempChannel.settings = {
        locked: false,
        hidden: false,
        userLimit: 0,
        rejectedUsers: [],
        permittedUsers: [],
        customName: null
      };
    }

    return tempChannel;
  }

  async getTempVoiceChannelsByOwner(guildId, ownerId) {
    const voiceManager = await this.getVoiceManager(guildId);
    return (voiceManager.tempChannels || []).filter(tc => tc.ownerId === ownerId);
  }

  async markInviteAsJoined(guildId, inviterUserId, invitedUserId) {
    const voiceManager = await this.getVoiceManager(guildId);
    const inviteCooldowns = voiceManager.inviteCooldowns || [];

    const cooldown = inviteCooldowns.find(cd =>
      cd.userId === inviterUserId &&
      cd.invitedUserId === invitedUserId &&
      !cd.hasJoined
    );

    if (cooldown) {
      cooldown.hasJoined = true;
      voiceManager.inviteCooldowns = inviteCooldowns;
      return await this.setVoiceManager(guildId, voiceManager);
    }

    return false;
  }

  // Setup voice manager system
  async setupVoiceManager(guildId, categoryId, joinChannelId, mutedChannelId) {
    const voiceManager = {
      enabled: true,
      categoryId: categoryId,
      joinChannelId: joinChannelId,
      mutedChannelId: mutedChannelId,
      tempChannels: [],
      inviteCooldowns: [],
      setupAt: new Date()
    };

    return await this.setVoiceManager(guildId, voiceManager);
  }

  // Clean up invalid invite cooldowns (migration helper)
  async cleanupInvalidInviteCooldowns(guildId) {
    const voiceManager = await this.getVoiceManager(guildId);
    if (!voiceManager || !voiceManager.inviteCooldowns) return false;

    // Filter out cooldowns that don't have required fields
    const validCooldowns = voiceManager.inviteCooldowns.filter(cd =>
      cd.userId && cd.invitedUserId && cd.invitedAt
    );

    // Add missing channelId field to valid cooldowns
    validCooldowns.forEach(cd => {
      if (!cd.hasOwnProperty('channelId')) {
        cd.channelId = null;
      }
    });

    voiceManager.inviteCooldowns = validCooldowns;
    return await this.setVoiceManager(guildId, voiceManager);
  }

  // Update temporary voice channel settings
  async updateTempVoiceChannel(guildId, channelId, settings) {
    const voiceManager = await this.getVoiceManager(guildId);
    if (!voiceManager) return false;

    const tempChannels = voiceManager.tempChannels || [];
    const channelIndex = tempChannels.findIndex(ch => ch.channelId === channelId);

    if (channelIndex === -1) return false;

    // Ensure settings object exists
    if (!tempChannels[channelIndex].settings) {
      tempChannels[channelIndex].settings = {
        locked: false,
        hidden: false,
        userLimit: 0,
        rejectedUsers: [],
        permittedUsers: [],
        customName: null
      };
    }

    // Update the channel settings
    tempChannels[channelIndex].settings = { ...tempChannels[channelIndex].settings, ...settings };
    voiceManager.tempChannels = tempChannels;

    return await this.setVoiceManager(guildId, voiceManager);
  }

  // Check invite cooldown
  async checkInviteCooldown(guildId, inviterUserId, invitedUserId) {
    const voiceManager = await this.getVoiceManager(guildId);
    if (!voiceManager) return { canInvite: true };

    const inviteCooldowns = voiceManager.inviteCooldowns || [];
    const cooldown = inviteCooldowns.find(cd =>
      cd.userId === inviterUserId &&
      cd.invitedUserId === invitedUserId &&
      !cd.hasJoined
    );

    if (cooldown) {
      const now = new Date();
      const cooldownTime = 5 * 60 * 1000; // 5 minutes
      const timeSinceInvite = now.getTime() - new Date(cooldown.invitedAt).getTime();

      if (timeSinceInvite < cooldownTime) {
        return {
          canInvite: false,
          timeLeft: cooldownTime - timeSinceInvite
        };
      }
    }

    return { canInvite: true };
  }

  // Add invite cooldown
  async addInviteCooldown(guildId, inviterUserId, invitedUserId, channelId = null) {
    const voiceManager = await this.getVoiceManager(guildId);
    if (!voiceManager) return false;

    let inviteCooldowns = voiceManager.inviteCooldowns || [];

    // Remove existing cooldown for this pair
    inviteCooldowns = inviteCooldowns.filter(cd =>
      !(cd.userId === inviterUserId && cd.invitedUserId === invitedUserId)
    );

    // Add new cooldown
    inviteCooldowns.push({
      userId: inviterUserId,
      channelId: channelId,
      invitedUserId: invitedUserId,
      invitedAt: new Date(),
      hasJoined: false
    });

    voiceManager.inviteCooldowns = inviteCooldowns;
    return await this.setVoiceManager(guildId, voiceManager);
  }

  // Transfer voice channel ownership
  async transferVoiceChannelOwnership(guildId, channelId, newOwnerId) {
    const voiceManager = await this.getVoiceManager(guildId);
    if (!voiceManager) return false;

    const tempChannels = voiceManager.tempChannels || [];
    const channelIndex = tempChannels.findIndex(ch => ch.channelId === channelId);

    if (channelIndex === -1) return false;

    tempChannels[channelIndex].ownerId = newOwnerId;
    tempChannels[channelIndex].transferredAt = new Date();
    voiceManager.tempChannels = tempChannels;

    return await this.setVoiceManager(guildId, voiceManager);
  }

  // ===== LAST.FM CROWN METHODS =====
  async getLastFMCrown(guildId, artist) {
    const crowns = await this.cache.getField(guildId, 'LastFMCrowns') || [];
    return crowns.find(crown => crown.artist.toLowerCase() === artist.toLowerCase());
  }

  async setLastFMCrown(guildId, artist, userId, plays) {
    let crowns = await this.cache.getField(guildId, 'LastFMCrowns') || [];

    // Remove existing crown for this artist
    crowns = crowns.filter(crown => crown.artist.toLowerCase() !== artist.toLowerCase());

    // Add new crown
    crowns.push({
      artist: artist,
      userId: userId,
      plays: plays,
      setAt: new Date()
    });

    return await this.cache.setField(guildId, 'LastFMCrowns', crowns);
  }

  // ===== TICKET SYSTEM METHODS =====
  async getTicketSystem(guildId) {
    return await this.cache.getField(guildId, 'TicketSystem') || {
      enabled: false,
      categoryId: null,
      supportRoleId: null,
      setupChannelId: null,
      setupMessageId: null,
      activeTickets: [],
      ticketCounter: 0
    };
  }

  async setTicketSystem(guildId, ticketSystem) {
    return await this.cache.setField(guildId, 'TicketSystem', ticketSystem);
  }

  async enableTicketSystem(guildId, categoryId = null) {
    const ticketSystem = await this.getTicketSystem(guildId);
    ticketSystem.enabled = true;
    if (categoryId) ticketSystem.categoryId = categoryId;
    return await this.setTicketSystem(guildId, ticketSystem);
  }

  async disableTicketSystem(guildId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    ticketSystem.enabled = false;
    return await this.setTicketSystem(guildId, ticketSystem);
  }

  async setTicketCategory(guildId, categoryId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    ticketSystem.categoryId = categoryId;
    return await this.setTicketSystem(guildId, ticketSystem);
  }

  async setTicketSupportRole(guildId, roleId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    ticketSystem.supportRoleId = roleId;
    return await this.setTicketSystem(guildId, ticketSystem);
  }

  async setTicketSetup(guildId, channelId, messageId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    ticketSystem.setupChannelId = channelId;
    ticketSystem.setupMessageId = messageId;
    return await this.setTicketSystem(guildId, ticketSystem);
  }

  async createTicket(guildId, userId, channelId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    ticketSystem.ticketCounter += 1;

    const ticket = {
      channelId,
      userId,
      ticketNumber: ticketSystem.ticketCounter,
      createdAt: new Date(),
      status: 'open',
      closedBy: null,
      closedAt: null
    };

    ticketSystem.activeTickets.push(ticket);
    await this.setTicketSystem(guildId, ticketSystem);
    return ticket;
  }

  async getTicket(guildId, channelId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    return ticketSystem.activeTickets.find(ticket => ticket.channelId === channelId);
  }

  async getUserTickets(guildId, userId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    return ticketSystem.activeTickets.filter(ticket => ticket.userId === userId && ticket.status === 'open');
  }

  async closeTicket(guildId, channelId, closedBy) {
    const ticketSystem = await this.getTicketSystem(guildId);
    const ticket = ticketSystem.activeTickets.find(t => t.channelId === channelId);

    if (ticket) {
      ticket.status = 'closed';
      ticket.closedBy = closedBy;
      ticket.closedAt = new Date();
      return await this.setTicketSystem(guildId, ticketSystem);
    }
    return false;
  }

  async reopenTicket(guildId, channelId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    const ticket = ticketSystem.activeTickets.find(t => t.channelId === channelId);

    if (ticket) {
      ticket.status = 'open';
      ticket.closedBy = null;
      ticket.closedAt = null;
      return await this.setTicketSystem(guildId, ticketSystem);
    }
    return false;
  }

  async removeTicket(guildId, channelId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    ticketSystem.activeTickets = ticketSystem.activeTickets.filter(t => t.channelId !== channelId);
    return await this.setTicketSystem(guildId, ticketSystem);
  }

  async getActiveTickets(guildId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    return ticketSystem.activeTickets.filter(ticket => ticket.status === 'open');
  }

  async getAllTickets(guildId) {
    const ticketSystem = await this.getTicketSystem(guildId);
    return ticketSystem.activeTickets;
  }

  // ===== LOGGING SYSTEM METHODS =====
  async getLoggingConfig(guildId) {
    return await this.cache.getField(guildId, 'LoggingConfig') || [];
  }

  async setLoggingConfig(guildId, loggingConfig) {
    return await this.cache.setField(guildId, 'LoggingConfig', loggingConfig);
  }

  async addLoggingConfig(guildId, config) {
    let loggingConfigs = await this.getLoggingConfig(guildId);

    // Check if config already exists for this channel
    const existingIndex = loggingConfigs.findIndex(c => c.channelId === config.channelId);

    if (existingIndex !== -1) {
      // Update existing config
      loggingConfigs[existingIndex] = { ...loggingConfigs[existingIndex], ...config };
    } else {
      // Add new config
      loggingConfigs.push(config);
    }

    return await this.setLoggingConfig(guildId, loggingConfigs);
  }

  async removeLoggingConfig(guildId, channelId, logType = null) {
    let loggingConfigs = await this.getLoggingConfig(guildId);

    if (logType) {
      // Remove specific log type from channel
      const config = loggingConfigs.find(c => c.channelId === channelId);
      if (config) {
        config.logTypes = config.logTypes.filter(type => type !== logType);

        // Remove entire config if no log types left
        if (config.logTypes.length === 0) {
          loggingConfigs = loggingConfigs.filter(c => c.channelId !== channelId);
        }
      }
    } else {
      // Remove entire config for channel
      loggingConfigs = loggingConfigs.filter(c => c.channelId !== channelId);
    }

    return await this.setLoggingConfig(guildId, loggingConfigs);
  }

  async getLoggingConfigForChannel(guildId, channelId) {
    const loggingConfigs = await this.getLoggingConfig(guildId);
    return loggingConfigs.find(config => config.channelId === channelId);
  }

  async getLoggingConfigsForType(guildId, logType) {
    const loggingConfigs = await this.getLoggingConfig(guildId);
    return loggingConfigs.filter(config =>
      config.enabled &&
      config.logTypes.includes(logType)
    );
  }

  async updateLoggingConfig(guildId, channelId, updates) {
    let loggingConfigs = await this.getLoggingConfig(guildId);
    const configIndex = loggingConfigs.findIndex(c => c.channelId === channelId);

    if (configIndex !== -1) {
      loggingConfigs[configIndex] = { ...loggingConfigs[configIndex], ...updates };
      return await this.setLoggingConfig(guildId, loggingConfigs);
    }

    return false;
  }

  // ===== LEVEL SYSTEM METHODS =====
  async isLevelSystemEnabled(guildId) {
    const levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    return levelSystem.enabled || false;
  }

  async enableLevelSystem(guildId) {
    let levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    levelSystem.enabled = true;
    return await this.cache.setField(guildId, 'LevelSystem', levelSystem);
  }

  async disableLevelSystem(guildId) {
    let levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    levelSystem.enabled = false;
    return await this.cache.setField(guildId, 'LevelSystem', levelSystem);
  }

  async getLevelMessageMode(guildId) {
    const levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    return levelSystem.messageMode || 'context';
  }

  async setLevelMessageMode(guildId, mode) {
    let levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    levelSystem.messageMode = mode;
    return await this.cache.setField(guildId, 'LevelSystem', levelSystem);
  }

  async getLevelUpChannel(guildId) {
    const levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    return levelSystem.levelUpChannel;
  }

  async setLevelUpChannel(guildId, channelId) {
    let levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    levelSystem.levelUpChannel = channelId;
    return await this.cache.setField(guildId, 'LevelSystem', levelSystem);
  }

  async getLevelRoles(guildId) {
    const levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    return levelSystem.levelRoles || [];
  }

  async addLevelRole(guildId, level, roleId) {
    let levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    if (!levelSystem.levelRoles) levelSystem.levelRoles = [];

    // Remove existing role for this level
    levelSystem.levelRoles = levelSystem.levelRoles.filter(lr => lr.level !== level);

    // Add new role
    levelSystem.levelRoles.push({ level, roleId });

    return await this.cache.setField(guildId, 'LevelSystem', levelSystem);
  }

  async removeLevelRole(guildId, level) {
    let levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    if (!levelSystem.levelRoles) return false;

    const initialLength = levelSystem.levelRoles.length;
    levelSystem.levelRoles = levelSystem.levelRoles.filter(lr => lr.level !== level);

    if (levelSystem.levelRoles.length < initialLength) {
      await this.cache.setField(guildId, 'LevelSystem', levelSystem);
      return true;
    }
    return false;
  }

  async getLastSyncTime(guildId) {
    const levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    return levelSystem.lastSyncTime;
  }

  async updateLastSyncTime(guildId) {
    let levelSystem = await this.cache.getField(guildId, 'LevelSystem') || {};
    levelSystem.lastSyncTime = new Date();
    return await this.cache.setField(guildId, 'LevelSystem', levelSystem);
  }

  async getUserLevel(guildId, userId) {
    const userLevels = await this.cache.getField(guildId, 'UserLevels') || [];
    return userLevels.find(ul => ul.userId === userId) || {
      userId,
      level: 1,
      experience: 0,
      totalExperience: 0,
      lastMessageTime: null
    };
  }

  async setUserLevel(guildId, userId, level, experience = null) {
    let userLevels = await this.cache.getField(guildId, 'UserLevels') || [];
    const userIndex = userLevels.findIndex(ul => ul.userId === userId);

    if (userIndex !== -1) {
      userLevels[userIndex].level = level;
      if (experience !== null) {
        userLevels[userIndex].experience = experience;
        userLevels[userIndex].totalExperience = this.calculateTotalExperience(level, experience);
      }
    } else {
      const exp = experience !== null ? experience : 0;
      userLevels.push({
        userId,
        level,
        experience: exp,
        totalExperience: this.calculateTotalExperience(level, exp),
        lastMessageTime: null
      });
    }

    return await this.cache.setField(guildId, 'UserLevels', userLevels);
  }

  async addUserExperience(guildId, userId, expGain) {
    let userLevels = await this.cache.getField(guildId, 'UserLevels') || [];
    const userIndex = userLevels.findIndex(ul => ul.userId === userId);

    let userData;
    if (userIndex !== -1) {
      userData = userLevels[userIndex];
    } else {
      userData = { userId, level: 1, experience: 0, totalExperience: 0, lastMessageTime: null };
      userLevels.push(userData);
    }

    userData.experience += expGain;
    userData.totalExperience += expGain;
    userData.lastMessageTime = new Date();

    // Check for level up
    const requiredExp = this.getRequiredExperience(userData.level);
    let leveledUp = false;

    while (userData.experience >= requiredExp) {
      userData.experience -= requiredExp;
      userData.level++;
      leveledUp = true;
    }

    await this.cache.setField(guildId, 'UserLevels', userLevels);

    return { leveledUp, newLevel: userData.level, userData };
  }

  async getUserLeaderboard(guildId, limit = 10) {
    const userLevels = await this.cache.getField(guildId, 'UserLevels') || [];
    return userLevels
      .sort((a, b) => {
        if (a.level !== b.level) return b.level - a.level;
        return b.experience - a.experience;
      })
      .slice(0, limit);
  }

  async getUserRank(guildId, userId) {
    const userLevels = await this.cache.getField(guildId, 'UserLevels') || [];
    const sorted = userLevels.sort((a, b) => {
      if (a.level !== b.level) return b.level - a.level;
      return b.experience - a.experience;
    });

    const rank = sorted.findIndex(ul => ul.userId === userId) + 1;
    return rank > 0 ? rank : null;
  }

  async resetAllUserLevels(guildId) {
    return await this.cache.setField(guildId, 'UserLevels', []);
  }

  async removeUserLevel(guildId, userId) {
    let userLevels = await this.cache.getField(guildId, 'UserLevels') || [];
    userLevels = userLevels.filter(ul => ul.userId !== userId);
    return await this.cache.setField(guildId, 'UserLevels', userLevels);
  }

  // Helper methods for level calculations
  getRequiredExperience(level) {
    return Math.floor(100 * Math.pow(1.2, level - 1));
  }

  calculateTotalExperience(level, currentExp) {
    let total = currentExp;
    for (let i = 1; i < level; i++) {
      total += this.getRequiredExperience(i);
    }
    return total;
  }





  // ===== GENERIC FIELD ACCESS =====
  async getField(guildId, field) {
    return await this.cache.getField(guildId, field);
  }

  async setField(guildId, field, value) {
    return await this.cache.setField(guildId, field, value);
  }

  async get(guildId) {
    return await this.cache.get(guildId);
  }

  async getGuild(guildId) {
    return await this.cache.get(guildId);
  }

  async updateGuild(guildId, updates) {
    const currentData = await this.cache.get(guildId) || {};
    const updatedData = { ...currentData, ...updates };
    return this.cache.set(guildId, updatedData);
  }

  set(guildId, data) {
    return this.cache.set(guildId, data);
  }

  // ===== STICKY MESSAGE METHODS =====
  async getStickyMessages(guildId) {
    return await this.cache.getField(guildId, 'StickyMessages') || [];
  }

  // ===== SCHEDULED NUKE METHODS =====
  async getScheduledNukes(guildId) {
    return await this.cache.getField(guildId, 'ScheduledNukes') || [];
  }

  async addScheduledNuke(guildId, nukeData) {
    let scheduledNukes = await this.getScheduledNukes(guildId);

    // Generate unique ID
    const existingIds = scheduledNukes.map(nuke => nuke.id);
    let newId = 1;
    while (existingIds.includes(newId)) {
      newId++;
    }

    const newNuke = {
      id: newId,
      channelId: nukeData.channelId,
      interval: nukeData.interval,
      message: nukeData.message || 'first',
      nextNuke: nukeData.nextNuke,
      createdAt: new Date(),
      createdBy: nukeData.createdBy,
      enabled: true
    };

    scheduledNukes.push(newNuke);
    await this.cache.setField(guildId, 'ScheduledNukes', scheduledNukes);
    return newNuke;
  }

  async removeScheduledNuke(guildId, channelId) {
    let scheduledNukes = await this.getScheduledNukes(guildId);
    const originalLength = scheduledNukes.length;

    scheduledNukes = scheduledNukes.filter(nuke => nuke.channelId !== channelId);

    if (scheduledNukes.length !== originalLength) {
      await this.cache.setField(guildId, 'ScheduledNukes', scheduledNukes);
      return true;
    }
    return false;
  }

  async updateNextNukeTime(guildId, channelId, nextNuke) {
    let scheduledNukes = await this.getScheduledNukes(guildId);
    const nuke = scheduledNukes.find(n => n.channelId === channelId);

    if (nuke) {
      nuke.nextNuke = nextNuke;
      await this.cache.setField(guildId, 'ScheduledNukes', scheduledNukes);
      return true;
    }
    return false;
  }

  async getScheduledNuke(guildId, channelId) {
    const scheduledNukes = await this.getScheduledNukes(guildId);
    return scheduledNukes.find(nuke => nuke.channelId === channelId);
  }

  // ===== POJ (PING ON JOIN) METHODS =====
  async getPojMessages(guildId) {
    return await this.cache.getField(guildId, 'PojMessages') || [];
  }

  async addPojMessage(guildId, channelId, message) {
    let pojMessages = await this.getPojMessages(guildId);

    // Check if we already have 5 channels (limit)
    if (pojMessages.length >= 5) {
      throw new Error('Maximum of 5 poj channels allowed per server');
    }

    // Check if channel already has a poj message
    const existingIndex = pojMessages.findIndex(poj => poj.channelId === channelId);
    if (existingIndex !== -1) {
      // Update existing message
      pojMessages[existingIndex].message = message;
      pojMessages[existingIndex].createdAt = new Date();
    } else {
      // Add new poj message
      pojMessages.push({
        channelId: channelId,
        message: message,
        createdAt: new Date()
      });
    }

    return await this.cache.setField(guildId, 'PojMessages', pojMessages);
  }

  async removePojMessage(guildId, channelId) {
    let pojMessages = await this.getPojMessages(guildId);
    const originalLength = pojMessages.length;

    pojMessages = pojMessages.filter(poj => poj.channelId !== channelId);

    if (pojMessages.length !== originalLength) {
      await this.cache.setField(guildId, 'PojMessages', pojMessages);
      return true;
    }
    return false;
  }

  async getPojMessage(guildId, channelId) {
    const pojMessages = await this.getPojMessages(guildId);
    return pojMessages.find(poj => poj.channelId === channelId);
  }

  async clearAllPojMessages(guildId) {
    return await this.cache.setField(guildId, 'PojMessages', []);
  }

  async getStickyMessage(guildId, channelId) {
    const stickyMessages = await this.getStickyMessages(guildId);
    return stickyMessages.find(sm => sm.channelId === channelId);
  }

  async setStickyMessage(guildId, channelId, message) {
    let stickyMessages = await this.getStickyMessages(guildId);

    // Remove existing sticky message for this channel if it exists
    stickyMessages = stickyMessages.filter(sm => sm.channelId !== channelId);

    // Add new sticky message
    stickyMessages.push({
      channelId,
      message,
      lastActivity: new Date(),
      lastStickyMessageId: null,
      createdAt: new Date()
    });

    return await this.cache.setField(guildId, 'StickyMessages', stickyMessages);
  }

  async removeStickyMessage(guildId, channelId) {
    let stickyMessages = await this.getStickyMessages(guildId);
    stickyMessages = stickyMessages.filter(sm => sm.channelId !== channelId);
    return await this.cache.setField(guildId, 'StickyMessages', stickyMessages);
  }

  async getAllStickyMessages(guildId) {
    return await this.getStickyMessages(guildId);
  }

  async updateStickyMessageActivity(guildId, channelId) {
    let stickyMessages = await this.getStickyMessages(guildId);
    const stickyMessage = stickyMessages.find(sm => sm.channelId === channelId);

    if (stickyMessage) {
      stickyMessage.lastActivity = new Date();
      await this.cache.setField(guildId, 'StickyMessages', stickyMessages);
      return true;
    }
    return false;
  }

  async updateStickyMessageId(guildId, channelId, messageId) {
    let stickyMessages = await this.getStickyMessages(guildId);
    const stickyMessage = stickyMessages.find(sm => sm.channelId === channelId);

    if (stickyMessage) {
      stickyMessage.lastStickyMessageId = messageId;
      await this.cache.setField(guildId, 'StickyMessages', stickyMessages);
      return true;
    }
    return false;
  }

  async getInactiveStickyMessages(guildId, inactivityMinutes = 15) {
    const stickyMessages = await this.getStickyMessages(guildId);
    const cutoffTime = new Date(Date.now() - (inactivityMinutes * 60 * 1000));

    return stickyMessages.filter(sm => {
      const lastActivity = new Date(sm.lastActivity);
      return lastActivity <= cutoffTime;
    });
  }

  // ===== WELCOME MESSAGES METHODS =====
  async getWelcomeMessages(guildId) {
    return await this.cache.getField(guildId, 'WelcomeMessages') || [];
  }

  async addWelcomeMessage(guildId, channelId, message) {
    let welcomeMessages = await this.getWelcomeMessages(guildId);

    // Remove existing welcome message for this channel if it exists
    welcomeMessages = welcomeMessages.filter(wm => wm.channelId !== channelId);

    // Add new welcome message
    welcomeMessages.push({
      channelId,
      message,
      createdAt: new Date()
    });

    return await this.cache.setField(guildId, 'WelcomeMessages', welcomeMessages);
  }

  async removeWelcomeMessage(guildId, channelId) {
    let welcomeMessages = await this.getWelcomeMessages(guildId);
    welcomeMessages = welcomeMessages.filter(wm => wm.channelId !== channelId);
    return await this.cache.setField(guildId, 'WelcomeMessages', welcomeMessages);
  }

  async getWelcomeMessage(guildId, channelId) {
    const welcomeMessages = await this.getWelcomeMessages(guildId);
    return welcomeMessages.find(wm => wm.channelId === channelId);
  }

  // ===== LEAVE MESSAGES METHODS =====
  async getLeaveMessages(guildId) {
    return await this.cache.getField(guildId, 'LeaveMessages') || [];
  }

  async addLeaveMessage(guildId, channelId, message) {
    let leaveMessages = await this.getLeaveMessages(guildId);

    // Remove existing leave message for this channel if it exists
    leaveMessages = leaveMessages.filter(lm => lm.channelId !== channelId);

    // Add new leave message
    leaveMessages.push({
      channelId,
      message,
      createdAt: new Date()
    });

    return await this.cache.setField(guildId, 'LeaveMessages', leaveMessages);
  }

  async removeLeaveMessage(guildId, channelId) {
    let leaveMessages = await this.getLeaveMessages(guildId);
    leaveMessages = leaveMessages.filter(lm => lm.channelId !== channelId);
    return await this.cache.setField(guildId, 'LeaveMessages', leaveMessages);
  }

  async getLeaveMessage(guildId, channelId) {
    const leaveMessages = await this.getLeaveMessages(guildId);
    return leaveMessages.find(lm => lm.channelId === channelId);
  }

  // ===== BOOST MESSAGES METHODS =====
  async getBoostMessages(guildId) {
    return await this.cache.getField(guildId, 'BoostMessages') || [];
  }

  async addBoostMessage(guildId, channelId, message) {
    let boostMessages = await this.getBoostMessages(guildId);

    // Remove existing boost message for this channel if it exists
    boostMessages = boostMessages.filter(bm => bm.channelId !== channelId);

    // Add new boost message
    boostMessages.push({
      channelId,
      message,
      createdAt: new Date()
    });

    return await this.cache.setField(guildId, 'BoostMessages', boostMessages);
  }

  async removeBoostMessage(guildId, channelId) {
    let boostMessages = await this.getBoostMessages(guildId);
    boostMessages = boostMessages.filter(bm => bm.channelId !== channelId);
    return await this.cache.setField(guildId, 'BoostMessages', boostMessages);
  }

  async getBoostMessage(guildId, channelId) {
    const boostMessages = await this.getBoostMessages(guildId);
    return boostMessages.find(bm => bm.channelId === channelId);
  }

  // ===== GIVEAWAY METHODS =====
  async getGiveaways(guildId) {
    return await this.cache.getField(guildId, 'Giveaways') || [];
  }

  async getActiveGiveaways(guildId) {
    const giveaways = await this.getGiveaways(guildId);
    return giveaways.filter(g => g.isActive);
  }

  async getGiveaway(guildId, giveawayId) {
    const giveaways = await this.getGiveaways(guildId);
    return giveaways.find(g => g.id === giveawayId);
  }

  async getGiveawayByMessageId(guildId, messageId) {
    const giveaways = await this.getGiveaways(guildId);
    return giveaways.find(g => g.messageId === messageId);
  }

  async getNextGiveawayId(guildId) {
    const giveaways = await this.getGiveaways(guildId);
    return giveaways.length > 0 ? Math.max(...giveaways.map(g => g.id)) + 1 : 1;
  }

  async addGiveaway(guildId, giveawayData) {
    let giveaways = await this.getGiveaways(guildId);
    const id = await this.getNextGiveawayId(guildId);

    const newGiveaway = {
      id,
      title: giveawayData.title,
      description: giveawayData.description || 'React with 🎉 to enter the giveaway.',
      channelId: giveawayData.channelId,
      messageId: giveawayData.messageId,
      hostId: giveawayData.hostId,
      winners: giveawayData.winners,
      endTime: giveawayData.endTime,
      requirements: giveawayData.requirements || { level: null, roleId: null },
      participants: [],
      winnerIds: [],
      image: giveawayData.image || null,
      isActive: true,
      createdAt: new Date()
    };

    giveaways.push(newGiveaway);
    await this.cache.setField(guildId, 'Giveaways', giveaways);
    return newGiveaway;
  }

  async updateGiveaway(guildId, giveawayId, updateData) {
    let giveaways = await this.getGiveaways(guildId);
    const giveawayIndex = giveaways.findIndex(g => g.id === giveawayId);

    if (giveawayIndex === -1) return null;

    // Update the giveaway with new data
    giveaways[giveawayIndex] = { ...giveaways[giveawayIndex], ...updateData };
    await this.cache.setField(guildId, 'Giveaways', giveaways);
    return giveaways[giveawayIndex];
  }

  async deleteGiveaway(guildId, giveawayId) {
    let giveaways = await this.getGiveaways(guildId);
    giveaways = giveaways.filter(g => g.id !== giveawayId);
    return await this.cache.setField(guildId, 'Giveaways', giveaways);
  }

  async addGiveawayParticipant(guildId, giveawayId, userId) {
    let giveaways = await this.getGiveaways(guildId);
    const giveaway = giveaways.find(g => g.id === giveawayId);

    if (!giveaway || !giveaway.isActive) return false;

    if (!giveaway.participants.includes(userId)) {
      giveaway.participants.push(userId);
      await this.cache.setField(guildId, 'Giveaways', giveaways);
      return true;
    }
    return false;
  }

  async removeGiveawayParticipant(guildId, giveawayId, userId) {
    let giveaways = await this.getGiveaways(guildId);
    const giveaway = giveaways.find(g => g.id === giveawayId);

    if (!giveaway) return false;

    const index = giveaway.participants.indexOf(userId);
    if (index > -1) {
      giveaway.participants.splice(index, 1);
      await this.cache.setField(guildId, 'Giveaways', giveaways);
      return true;
    }
    return false;
  }

  async endGiveaway(guildId, giveawayId, winnerIds = []) {
    let giveaways = await this.getGiveaways(guildId);
    const giveaway = giveaways.find(g => g.id === giveawayId);

    if (!giveaway) return null;

    giveaway.isActive = false;
    giveaway.winnerIds = winnerIds;
    await this.cache.setField(guildId, 'Giveaways', giveaways);
    return giveaway;
  }

  async getExpiredGiveaways(guildId) {
    const giveaways = await this.getActiveGiveaways(guildId);
    const now = new Date();
    return giveaways.filter(g => new Date(g.endTime) <= now);
  }

  // ===== BOOSTER ROLE METHODS =====
  async getBoosterRoleSystem(guildId) {
    return await this.cache.getField(guildId, 'BoosterRoleSystem') || { baseRoleId: null, enabled: false };
  }

  async setBoosterRoleBaseRole(guildId, roleId) {
    const system = await this.getBoosterRoleSystem(guildId);
    system.baseRoleId = roleId;
    system.enabled = roleId !== null;
    return await this.cache.setField(guildId, 'BoosterRoleSystem', system);
  }

  async getBoosterRoleBaseRole(guildId) {
    const system = await this.getBoosterRoleSystem(guildId);
    return system.baseRoleId;
  }

  async isBoosterRoleSystemEnabled(guildId) {
    const system = await this.getBoosterRoleSystem(guildId);
    return system.enabled && system.baseRoleId;
  }

  async getBoosterRoles(guildId) {
    return await this.cache.getField(guildId, 'BoosterRoles') || [];
  }

  async getBoosterRole(guildId, boosterRoleId) {
    const boosterRoles = await this.getBoosterRoles(guildId);
    return boosterRoles.find(br => br.id === boosterRoleId);
  }

  async getBoosterRoleByRoleId(guildId, roleId) {
    const boosterRoles = await this.getBoosterRoles(guildId);
    return boosterRoles.find(br => br.roleId === roleId);
  }

  async getUserBoosterRole(guildId, userId) {
    const boosterRoles = await this.getBoosterRoles(guildId);
    return boosterRoles.find(br => br.ownerId === userId || br.userId === userId);
  }

  async getNextBoosterRoleId(guildId) {
    const boosterRoles = await this.getBoosterRoles(guildId);
    return boosterRoles.length > 0 ? Math.max(...boosterRoles.map(br => br.id)) + 1 : 1;
  }

  async addBoosterRole(guildId, boosterRoleData) {
    let boosterRoles = await this.getBoosterRoles(guildId);
    const id = await this.getNextBoosterRoleId(guildId);

    const newBoosterRole = {
      id,
      roleId: boosterRoleData.roleId,
      ownerId: boosterRoleData.ownerId,
      name: boosterRoleData.name,
      color: boosterRoleData.color || null,
      icon: boosterRoleData.icon || null,
      sharedWith: [],
      pendingShares: [],
      createdAt: new Date(),
      lastUsed: new Date()
    };

    boosterRoles.push(newBoosterRole);
    await this.cache.setField(guildId, 'BoosterRoles', boosterRoles);
    return newBoosterRole;
  }

  async updateBoosterRole(guildId, boosterRoleId, updateData) {
    let boosterRoles = await this.getBoosterRoles(guildId);
    const boosterRoleIndex = boosterRoles.findIndex(br => br.id === boosterRoleId);

    if (boosterRoleIndex === -1) return null;

    // Update the booster role with new data
    boosterRoles[boosterRoleIndex] = { ...boosterRoles[boosterRoleIndex], ...updateData };
    await this.cache.setField(guildId, 'BoosterRoles', boosterRoles);
    return boosterRoles[boosterRoleIndex];
  }

  async deleteBoosterRole(guildId, boosterRoleId) {
    let boosterRoles = await this.getBoosterRoles(guildId);
    boosterRoles = boosterRoles.filter(br => br.id !== boosterRoleId);
    return await this.cache.setField(guildId, 'BoosterRoles', boosterRoles);
  }

  async updateBoosterRoleLastUsed(guildId, boosterRoleId) {
    return await this.updateBoosterRole(guildId, boosterRoleId, { lastUsed: new Date() });
  }

  async addBoosterRoleShare(guildId, boosterRoleId, userId) {
    let boosterRoles = await this.getBoosterRoles(guildId);
    const boosterRole = boosterRoles.find(br => br.id === boosterRoleId);

    if (!boosterRole) return false;

    // Check if already shared with this user
    if (boosterRole.sharedWith.find(s => s.userId === userId)) return false;

    // Check if at limit (5 people)
    if (boosterRole.sharedWith.length >= 5) return false;

    boosterRole.sharedWith.push({
      userId,
      sharedAt: new Date()
    });

    await this.cache.setField(guildId, 'BoosterRoles', boosterRoles);
    return true;
  }

  async removeBoosterRoleShare(guildId, boosterRoleId, userId) {
    let boosterRoles = await this.getBoosterRoles(guildId);
    const boosterRole = boosterRoles.find(br => br.id === boosterRoleId);

    if (!boosterRole) return false;

    boosterRole.sharedWith = boosterRole.sharedWith.filter(s => s.userId !== userId);
    await this.cache.setField(guildId, 'BoosterRoles', boosterRoles);
    return true;
  }

  async addBoosterRolePendingShare(guildId, boosterRoleId, userId, messageId, channelId) {
    let boosterRoles = await this.getBoosterRoles(guildId);
    const boosterRole = boosterRoles.find(br => br.id === boosterRoleId);

    if (!boosterRole) return false;

    // Remove any existing pending share for this user
    boosterRole.pendingShares = boosterRole.pendingShares.filter(ps => ps.userId !== userId);

    boosterRole.pendingShares.push({
      userId,
      messageId,
      channelId,
      sharedAt: new Date()
    });

    await this.cache.setField(guildId, 'BoosterRoles', boosterRoles);
    return true;
  }

  async removeBoosterRolePendingShare(guildId, boosterRoleId, userId) {
    let boosterRoles = await this.getBoosterRoles(guildId);
    const boosterRole = boosterRoles.find(br => br.id === boosterRoleId);

    if (!boosterRole) return false;

    boosterRole.pendingShares = boosterRole.pendingShares.filter(ps => ps.userId !== userId);
    await this.cache.setField(guildId, 'BoosterRoles', boosterRoles);
    return true;
  }

  async getBoosterRoleByPendingShare(guildId, messageId) {
    const boosterRoles = await this.getBoosterRoles(guildId);
    return boosterRoles.find(br => br.pendingShares.some(ps => ps.messageId === messageId));
  }

  async getUnusedBoosterRoles(guildId, daysSinceLastUsed = 30) {
    const boosterRoles = await this.getBoosterRoles(guildId);
    const cutoffDate = new Date(Date.now() - (daysSinceLastUsed * 24 * 60 * 60 * 1000));

    return boosterRoles.filter(br => {
      const lastUsed = new Date(br.lastUsed);
      return lastUsed < cutoffDate;
    });
  }

  // ===== BOOST TRACKING METHODS =====
  async getBoostHistory(guildId) {
    return await this.cache.getField(guildId, 'BoostHistory') || [];
  }

  async trackBoostEvent(guildId, userId, action) {
    let boostHistory = await this.getBoostHistory(guildId);

    const newEvent = {
      userId: userId,
      action: action, // 'add' or 'remove'
      timestamp: new Date(),
      boostStartTime: null
    };

    // If this is a 'remove' action, find when they started boosting
    if (action === 'remove') {
      // Find the most recent 'add' event for this user
      const userHistory = boostHistory
        .filter(event => event.userId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const lastAddEvent = userHistory.find(event => event.action === 'add');
      if (lastAddEvent) {
        newEvent.boostStartTime = new Date(lastAddEvent.timestamp);
      }
    }

    // Add new boost event
    boostHistory.push(newEvent);

    // Keep only the last 100 events to prevent unlimited growth
    if (boostHistory.length > 100) {
      boostHistory = boostHistory.slice(-100);
    }

    return await this.cache.setField(guildId, 'BoostHistory', boostHistory);
  }

  async getRecentBoostAdds(guildId, limit = 20) {
    const boostHistory = await this.getBoostHistory(guildId);
    return boostHistory
      .filter(event => event.action === 'add')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getRecentBoostRemoves(guildId, limit = 20) {
    const boostHistory = await this.getBoostHistory(guildId);
    return boostHistory
      .filter(event => event.action === 'remove')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // ===== AUTOPOST CHANNEL METHODS =====
  async getAutopostChannels(guildId) {
    return await this.cache.getField(guildId, 'AutopostChannels') || [];
  }

  async addAutopostChannel(guildId, autopostData) {
    let autopostChannels = await this.getAutopostChannels(guildId);
    autopostChannels.push(autopostData);
    return await this.cache.setField(guildId, 'AutopostChannels', autopostChannels);
  }

  async removeAutopostChannel(guildId, channelId, category = null) {
    let autopostChannels = await this.getAutopostChannels(guildId);

    if (category) {
      // Remove specific category from channel
      autopostChannels = autopostChannels.filter(ap => !(ap.channelId === channelId && ap.category === category));
    } else {
      // Remove all categories from channel
      autopostChannels = autopostChannels.filter(ap => ap.channelId !== channelId);
    }

    return await this.cache.setField(guildId, 'AutopostChannels', autopostChannels);
  }

  async clearAllAutopostChannels(guildId) {
    return await this.cache.setField(guildId, 'AutopostChannels', []);
  }

  async updateAutopostLastPosted(guildId, channelId, category, lastPosted = new Date()) {
    let autopostChannels = await this.getAutopostChannels(guildId);
    const autopost = autopostChannels.find(ap =>
      ap.channelId === channelId && ap.category === category
    );

    if (autopost) {
      autopost.lastPosted = lastPosted;
      await this.cache.setField(guildId, 'AutopostChannels', autopostChannels);
      return true;
    }
    return false;
  }

  // ===== VANITY DISABLED STATE METHODS =====
  async isVanityDisabled(guildId) {
    return await this.cache.getField(guildId, 'VanityDisabled') || false;
  }

  async disableVanity(guildId, reason) {
    await this.cache.setField(guildId, 'VanityDisabled', true);
    await this.cache.setField(guildId, 'VanityDisabledReason', reason);
    await this.cache.setField(guildId, 'VanityLastDisabled', new Date());
    return true;
  }

  async enableVanity(guildId) {
    await this.cache.setField(guildId, 'VanityDisabled', false);
    await this.cache.setField(guildId, 'VanityDisabledReason', null);
    return true;
  }

  async getVanityDisabledInfo(guildId) {
    const disabled = await this.cache.getField(guildId, 'VanityDisabled') || false;
    const reason = await this.cache.getField(guildId, 'VanityDisabledReason');
    const lastDisabled = await this.cache.getField(guildId, 'VanityLastDisabled');

    return {
      disabled,
      reason,
      lastDisabled
    };
  }
}

module.exports = new Guild();
