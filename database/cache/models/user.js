/**
 * User Cache Model
 * Auto-fetching wrapper for user data using TTL cache system
 * All methods automatically handle cache-first reads and background database writes
 */
class User {
  constructor() {
    // Get the auto-fetch cache from the unified interface
    const { userCache } = require('../index');
    this.cache = userCache;
  }

  // ===== LAST.FM METHODS =====
  async getLastFMUsername(userId) {
    return await this.cache.getField(userId, 'LastFMUsername');
  }

  async setLastFMUsername(userId, username) {
    return await this.cache.setField(userId, 'LastFMUsername', username);
  }

  async getLastFMLibrary(userId) {
    return await this.cache.getField(userId, 'LastFMLibrary') || { artists: [], albums: [], tracks: [] };
  }

  async setLastFMLibrary(userId, library) {
    return await this.cache.setField(userId, 'LastFMLibrary', library);
  }

  async getLastFMSettings(userId) {
    return await this.cache.getField(userId, 'LastFMSettings') || {};
  }

  async setLastFMSettings(userId, settings) {
    return await this.cache.setField(userId, 'LastFMSettings', settings);
  }

  // ===== GAMBLING METHODS =====
  async getGambling(userId) {
    return await this.cache.getField(userId, 'Gambling') || {
      wallet: 1000,
      bank: 0,
      dailyClaim: { lastClaimed: null, streak: 0 },
      robCooldown: null,
      lastWorked: null,
      begCooldown: null,
      lastInterestClaim: null,
      totalGambled: 0,
      totalWon: 0,
      totalLost: 0
    };
  }

  async setGambling(userId, gambling) {
    return await this.cache.setField(userId, 'Gambling', gambling);
  }

  async getWallet(userId) {
    const gambling = await this.getGambling(userId);
    return gambling.wallet || 0;
  }

  async setWallet(userId, amount) {
    const gambling = await this.getGambling(userId);
    gambling.wallet = amount;
    return await this.setGambling(userId, gambling);
  }

  async getBank(userId) {
    const gambling = await this.getGambling(userId);
    return gambling.bank || 0;
  }

  async setBank(userId, amount) {
    const gambling = await this.getGambling(userId);
    gambling.bank = amount;
    return await this.setGambling(userId, gambling);
  }

  async addMoney(userId, amount, location = 'wallet') {
    const gambling = await this.getGambling(userId);
    gambling[location] = (gambling[location] || 0) + amount;
    return await this.setGambling(userId, gambling);
  }

  async removeMoney(userId, amount, location = 'wallet') {
    const gambling = await this.getGambling(userId);
    gambling[location] = Math.max(0, (gambling[location] || 0) - amount);
    return await this.setGambling(userId, gambling);
  }

  async hasGamblingAccount(userId) {
    const gambling = await this.getGambling(userId);
    return gambling && (gambling.wallet !== undefined || gambling.bank !== undefined);
  }

  async createGamblingAccount(userId) {
    const defaultGambling = {
      wallet: 1000,
      bank: 0,
      dailyClaim: { lastClaimed: null, streak: 0 },
      robCooldown: null,
      lastWorked: null,
      begCooldown: null,
      lastInterestClaim: null,
      totalGambled: 0,
      totalWon: 0,
      totalLost: 0
    };
    return await this.setGambling(userId, defaultGambling);
  }

  async getTotalMoney(userId) {
    const gambling = await this.getGambling(userId);
    return (gambling.wallet || 0) + (gambling.bank || 0);
  }

  // Alias for getGambling to match command usage
  async getGamblingData(userId) {
    return await this.getGambling(userId);
  }

  // Alias for setGambling to match command usage
  async setGamblingData(userId, gambling) {
    return await this.setGambling(userId, gambling);
  }

  // Update wallet balance (add/subtract amount)
  async updateWalletBalance(userId, amount) {
    const gambling = await this.getGambling(userId);
    gambling.wallet = Math.max(0, (gambling.wallet || 0) + amount);
    return await this.setGambling(userId, gambling);
  }

  // Update daily claim data
  async updateDailyClaim(userId, newStreak) {
    const gambling = await this.getGambling(userId);
    gambling.dailyClaim = {
      lastClaimed: new Date(),
      streak: newStreak
    };
    return await this.setGambling(userId, gambling);
  }

  // Update beg cooldown
  async updateBegCooldown(userId) {
    const gambling = await this.getGambling(userId);
    gambling.begCooldown = new Date();
    return await this.setGambling(userId, gambling);
  }

  // Update work timestamp
  async updateWorkTimestamp(userId) {
    const gambling = await this.getGambling(userId);
    gambling.lastWorked = new Date();
    return await this.setGambling(userId, gambling);
  }

  // Update rob cooldown
  async updateRobCooldown(userId) {
    const gambling = await this.getGambling(userId);
    gambling.robCooldown = new Date();
    return await this.setGambling(userId, gambling);
  }

  // Transfer money between wallet and bank
  async transferMoney(userId, amount, toBank = true) {
    try {
      const gambling = await this.getGambling(userId);

      if (toBank) {
        // Deposit: wallet -> bank
        if ((gambling.wallet || 0) < amount) return false;
        gambling.wallet = (gambling.wallet || 0) - amount;
        gambling.bank = (gambling.bank || 0) + amount;
      } else {
        // Withdraw: bank -> wallet
        if ((gambling.bank || 0) < amount) return false;
        gambling.bank = (gambling.bank || 0) - amount;
        gambling.wallet = (gambling.wallet || 0) + amount;
      }

      await this.setGambling(userId, gambling);
      return true;
    } catch (error) {
      console.error('Error transferring money:', error);
      return false;
    }
  }

  // Update gambling statistics
  async updateGamblingStats(userId, gambledAmount, wonAmount, lostAmount) {
    const gambling = await this.getGambling(userId);
    gambling.totalGambled = (gambling.totalGambled || 0) + gambledAmount;
    gambling.totalWon = (gambling.totalWon || 0) + wonAmount;
    gambling.totalLost = (gambling.totalLost || 0) + lostAmount;
    return await this.setGambling(userId, gambling);
  }

  // Calculate and apply bank interest
  async calculateBankInterest(userId) {
    try {
      const gambling = await this.getGambling(userId);
      const bankBalance = gambling.bank || 0;

      // No interest if no money in bank
      if (bankBalance <= 0) return 0;

      const lastInterestClaim = gambling.lastInterestClaim;
      const now = new Date();

      // If never claimed interest before, set last claim to now and return 0
      if (!lastInterestClaim) {
        gambling.lastInterestClaim = now;
        await this.setGambling(userId, gambling);
        return 0;
      }

      // Calculate hours since last interest claim
      const hoursSinceLastClaim = (now - new Date(lastInterestClaim)) / (1000 * 60 * 60);

      // Interest rate: 0.1% per hour (2.4% per day)
      const interestRate = 0.001; // 0.1% per hour
      const hoursToCalculate = Math.floor(hoursSinceLastClaim);

      // Only calculate if at least 1 hour has passed
      if (hoursToCalculate < 1) return 0;

      // Calculate compound interest
      const interestEarned = Math.floor(bankBalance * (Math.pow(1 + interestRate, hoursToCalculate) - 1));

      // Cap interest at 10% of bank balance per calculation to prevent abuse
      const maxInterest = Math.floor(bankBalance * 0.1);
      const finalInterest = Math.min(interestEarned, maxInterest);

      if (finalInterest > 0) {
        // Add interest to bank and update last claim time
        gambling.bank = bankBalance + finalInterest;
        gambling.lastInterestClaim = now;
        await this.setGambling(userId, gambling);
      }

      return finalInterest;
    } catch (error) {
      console.error('Error calculating bank interest:', error);
      return 0;
    }
  }

  // ===== ROLEPLAY METHODS =====
  async getRoleplay(userId) {
    return await this.cache.getField(userId, 'Roleplay') || { given: [], received: [] };
  }

  async setRoleplay(userId, roleplay) {
    return await this.cache.setField(userId, 'Roleplay', roleplay);
  }

  async addRoleplayInteraction(userId, targetUserId, action, type = 'given') {
    const roleplay = await this.getRoleplay(userId);
    const interactions = roleplay[type] || [];

    // Use correct field name based on type
    const fieldName = type === 'given' ? 'targetUserId' : 'fromUserId';
    const searchValue = type === 'given' ? targetUserId : targetUserId; // targetUserId is actually fromUserId for received

    const existing = interactions.find(i => i[fieldName] === searchValue && i.action === action);
    if (existing) {
      existing.count = (existing.count || 0) + 1;
    } else {
      const newInteraction = { action, count: 1 };
      newInteraction[fieldName] = searchValue;
      interactions.push(newInteraction);
    }

    roleplay[type] = interactions;
    await this.setRoleplay(userId, roleplay);
    return existing ? existing.count : 1;
  }

  async trackRoleplayInteraction(userId, targetUserId, action) {
    // Track the interaction for the user who performed the action
    const count = await this.addRoleplayInteraction(userId, targetUserId, action, 'given');

    // Also track it for the target user as 'received' (if not self-action)
    // For received, the userId becomes the target, and targetUserId becomes the fromUserId
    if (userId !== targetUserId) {
      await this.addRoleplayInteraction(targetUserId, userId, action, 'received');
    }

    return count;
  }

  async getRoleplayCount(userId, targetUserId, action) {
    const roleplay = await this.getRoleplay(userId);
    const givenInteractions = roleplay.given || [];
    const interaction = givenInteractions.find(i => i.targetUserId === targetUserId && i.action === action);
    return interaction ? interaction.count : 0;
  }

  // ===== NOTES METHODS =====
  async getNotes(userId) {
    return await this.cache.getField(userId, 'Notes') || [];
  }

  async addNote(userId, content) {
    const notes = await this.getNotes(userId);
    const id = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
    notes.push({ id, content, createdAt: new Date() });
    return await this.cache.setField(userId, 'Notes', notes);
  }

  async removeNote(userId, noteId) {
    let notes = await this.getNotes(userId);
    notes = notes.filter(n => n.id !== noteId);
    return await this.cache.setField(userId, 'Notes', notes);
  }

  async clearNotes(userId) {
    return await this.cache.setField(userId, 'Notes', []);
  }

  // Alias for getNotes
  async getNotesData(userId) {
    return await this.getNotes(userId);
  }

  // Alias for clearNotes
  async clearAllNotes(userId) {
    return await this.clearNotes(userId);
  }

  // ===== NAME HISTORY METHODS =====
  async getNameHistory(userId) {
    return await this.cache.getField(userId, 'NameHistory') || [];
  }

  async addNameChange(userId, type, oldName, newName, guildId = null) {
    const history = await this.getNameHistory(userId);
    history.push({ type, oldName, newName, guildId, changedAt: new Date() });
    return await this.cache.setField(userId, 'NameHistory', history);
  }

  async clearAllNameHistory(userId) {
    return await this.cache.setField(userId, 'NameHistory', []);
  }

  // ===== BIRTHDAY METHODS =====
  async getBirthday(userId) {
    return await this.cache.getField(userId, 'Birthday') || { day: null, month: null, setAt: null };
  }

  async setBirthday(userId, day, month) {
    const birthday = { day, month, setAt: new Date() };
    return await this.cache.setField(userId, 'Birthday', birthday);
  }

  async removeBirthday(userId) {
    return await this.cache.setField(userId, 'Birthday', { day: null, month: null, setAt: null });
  }

  // Alias for removeBirthday
  async clearBirthday(userId) {
    return await this.removeBirthday(userId);
  }

  // Get formatted birthday string
  async getFormattedBirthday(userId) {
    const birthday = await this.getBirthday(userId);
    if (!birthday || !birthday.day || !birthday.month) {
      return null;
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = monthNames[birthday.month - 1];
    const day = birthday.day;

    // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const getOrdinalSuffix = (num) => {
      const j = num % 10;
      const k = num % 100;
      if (j === 1 && k !== 11) return 'st';
      if (j === 2 && k !== 12) return 'nd';
      if (j === 3 && k !== 13) return 'rd';
      return 'th';
    };

    return `${monthName} ${day}${getOrdinalSuffix(day)}`;
  }

  // Check if today is user's birthday
  async isBirthday(userId) {
    const birthday = await this.getBirthday(userId);
    if (!birthday || !birthday.day || !birthday.month) {
      return false;
    }

    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1; // getMonth() returns 0-11

    return birthday.day === todayDay && birthday.month === todayMonth;
  }

  // ===== TIMEZONE METHODS =====
  async getTimezone(userId) {
    return await this.cache.getField(userId, 'Timezone');
  }

  async setTimezone(userId, timezone) {
    return await this.cache.setField(userId, 'Timezone', timezone);
  }

  // ===== SELF PREFIX METHODS =====
  async getSelfPrefix(userId) {
    return await this.cache.getField(userId, 'SelfPrefix');
  }

  async setSelfPrefix(userId, prefix) {
    return await this.cache.setField(userId, 'SelfPrefix', prefix);
  }

  // ===== TIC TAC TOE METHODS =====
  async getTicTacToe(userId) {
    const data = await this.cache.getField(userId, 'TicTacToe') || {};

    // Handle both old capitalized format and new lowercase format
    return {
      wins: data.wins || data.Wins || 0,
      losses: data.losses || data.Losses || 0,
      draws: data.draws || data.Draws || data.Matches || 0 // Matches was the old field name for draws
    };
  }

  async setTicTacToe(userId, stats) {
    return await this.cache.setField(userId, 'TicTacToe', stats);
  }

  async updateTicTacToeStats(userId, result) {
    const stats = await this.getTicTacToe(userId);

    if (result === 'win') {
      stats.wins = (stats.wins || 0) + 1;
    } else if (result === 'loss') {
      stats.losses = (stats.losses || 0) + 1;
    } else if (result === 'draw') {
      stats.draws = (stats.draws || 0) + 1;
    }

    return await this.setTicTacToe(userId, stats);
  }

  // Alias for getTicTacToe
  async getTicTacToeStats(userId) {
    return await this.getTicTacToe(userId);
  }

  // Get tic-tac-toe win ratio
  async getTicTacToeRatio(userId) {
    const stats = await this.getTicTacToe(userId);
    const totalGames = stats.wins + stats.losses + stats.draws;

    if (totalGames === 0) {
      return { wins: 0, losses: 0, draws: 0, winRate: 0, totalGames: 0 };
    }

    const winRate = ((stats.wins / totalGames) * 100).toFixed(1);

    return {
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      winRate: parseFloat(winRate),
      totalGames: totalGames
    };
  }

  // ===== REMINDER METHODS =====
  async getReminders(userId) {
    return await this.cache.getField(userId, 'Reminders') || [];
  }

  async addReminder(userId, content, duration, isDaily, guildId, channelId, messageUrl) {
    let reminders = await this.getReminders(userId);
    const id = reminders.length > 0 ? Math.max(...reminders.map(r => r.id)) + 1 : 1;

    const nextTrigger = new Date(Date.now() + duration);

    const newReminder = {
      id,
      content,
      duration,
      isDaily,
      nextTrigger,
      guildId,
      channelId,
      messageUrl,
      createdAt: new Date()
    };

    reminders.push(newReminder);
    await this.cache.setField(userId, 'Reminders', reminders);
    return newReminder; // Return the newly added reminder
  }

  async removeReminder(userId, reminderId) {
    let reminders = await this.getReminders(userId);
    const removedReminder = reminders.find(r => r.id === reminderId);
    reminders = reminders.filter(r => r.id !== reminderId);
    await this.cache.setField(userId, 'Reminders', reminders);
    return removedReminder;
  }

  async updateReminderNextTrigger(userId, reminderId, nextTrigger) {
    let reminders = await this.getReminders(userId);
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.nextTrigger = nextTrigger;
      await this.cache.setField(userId, 'Reminders', reminders);
      return true;
    }
    return false;
  }

  async clearReminders(userId) {
    return await this.cache.setField(userId, 'Reminders', []);
  }

  // ===== GENERIC FIELD ACCESS =====
  async getField(userId, field) {
    return await this.cache.getField(userId, field);
  }

  async setField(userId, field, value) {
    return await this.cache.setField(userId, field, value);
  }

  async get(userId) {
    return await this.cache.get(userId);
  }

  set(userId, data) {
    return this.cache.set(userId, data);
  }
}

module.exports = new User();
