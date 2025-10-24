# Service Layer Completion Plan

## Overview
This document tracks the completion status of service layer methods for all bot commands. The goal is to ensure all commands use the service layer instead of direct database access.

---

## ✅ COMPLETED Services

### GuildService
**Status:** Core methods implemented

#### Auto React System
- ✅ `getAutoReacts(guildId)` - Get all autoreacts
- ✅ `addAutoReact(guildId, word, emojiId, emojiName, isCustom)` - Add autoreact
- ✅ `removeAutoReact(guildId, word)` - Remove autoreact
- ✅ `clearAllAutoReacts(guildId)` - Clear all autoreacts

#### Auto Responder System
- ✅ `getAutoResponders(guildId)` - Get all autoresponders
- ✅ `addAutoResponder(guildId, autoresponderData)` - Add autoresponder
- ✅ `removeAutoResponder(guildId, trigger)` - Remove autoresponder
- ✅ `clearAllAutoResponders(guildId)` - Clear all autoresponders

#### Swear Tracking System
- ✅ `addSwear(guildId, userId, swear)` - Track swear usage
- ✅ `getSwears(guildId, userId)` - Get user swears
- ✅ `getAllSwears(guildId)` - Get all swears
- ✅ `clearUserSwears(guildId, userId)` - Clear user swears
- ✅ `getUserSwearData(guildId, userId)` - Get aggregated swear data
- ✅ `getSwearLeaderboard(guildId, limit)` - Get swear leaderboard
- ✅ `getUserSwearPosition(guildId, userId)` - Get user position
- ✅ `getSwearTracker(guildId)` - Get raw swear data
- ✅ `clearAllSwearData(guildId)` - Clear all swear data

#### Level System
- ✅ `isLevelSystemEnabled(guildId)` - Check if enabled
- ✅ `setLevelSystemEnabled(guildId, enabled)` - Enable/disable
- ✅ `enableLevelSystem(guildId)` - Enable system
- ✅ `disableLevelSystem(guildId)` - Disable system
- ✅ `getUserLevel(guildId, userId)` - Get user level data
- ✅ `addExperience(guildId, userId, expGain)` - Add XP
- ✅ `addUserExperience(guildId, userId, expGain)` - Alias for addExperience
- ✅ `getUserLeaderboard(guildId, limit)` - Get leaderboard
- ✅ `getUserRank(guildId, userId)` - Get user rank
- ✅ `setUserLevel(guildId, userId, level, experience)` - Set level
- ✅ `resetAllUserLevels(guildId)` - Reset all levels
- ✅ `removeUserLevel(guildId, userId)` - Remove user level
- ✅ `getRequiredExperience(level)` - Calculate required XP
- ✅ `calculateTotalExperience(level, currentExp)` - Calculate total XP
- ✅ `getLevelMessageMode(guildId)` - Get message mode
- ✅ `getLevelUpChannel(guildId)` - Get level up channel
- ✅ `getLevelRoles(guildId)` - Get level roles
- ✅ `addLevelRole(guildId, level, roleId)` - Add level role
- ✅ `removeLevelRole(guildId, level)` - Remove level role
- ✅ `getLastSyncTime(guildId)` - Get last sync time
- ✅ `updateLastSyncTime(guildId)` - Update sync time
- ✅ `setLevelMessageMode(guildId, mode)` - Set message mode
- ✅ `setLevelUpChannel(guildId, channelId)` - Set level up channel

#### Starboard System
- ✅ `getStarboardChannel(guildId)` - Get starboard channel
- ✅ `getStarboardThreshold(guildId)` - Get threshold
- ✅ `getStarboardEmoji(guildId)` - Get emoji
- ✅ `setStarboardSettings(guildId, channelId, threshold, emoji)` - Set settings
- ✅ `findStarboardMessage(guildId, messageId)` - Find message
- ✅ `addStarboardMessage(guildId, messageId, starboardMessageId, channelId, authorId, count)` - Add message
- ✅ `updateStarboardMessageCount(guildId, messageId, count)` - Update count
- ✅ `removeStarboardMessage(guildId, messageId)` - Remove message

#### Giveaway System
- ✅ `getGiveawayByMessageId(guildId, messageId)` - Get by message
- ✅ `getGiveaway(guildId, giveawayId)` - Get by ID
- ✅ `addGiveawayParticipant(guildId, giveawayId, userId)` - Add participant
- ✅ `getActiveGiveaways(guildId)` - Get active giveaways

#### Last.fm Crown System
- ✅ `getLastFMCrown(guildId, artistName)` - Get crown
- ✅ `setLastFMCrown(guildId, artistName, userId, plays)` - Set crown
- ✅ `getAllLastFMCrowns(guildId)` - Get all crowns
- ✅ `getUserLastFMCrowns(guildId, userId)` - Get user crowns
- ✅ `removeLastFMCrown(guildId, artistName)` - Remove crown

#### Message Tracking
- ✅ `trackMessage(guildId, userId)` - Track message
- ✅ `getMessageStats(guildId, userId)` - Get stats

#### Sticky Messages
- ✅ `updateStickyMessageActivity(guildId, channelId)` - Update activity

#### Counting System
- ✅ `getCounting(guildId)` - Get counting config
- ✅ `setCounting(guildId, countingData)` - Set counting config

#### Welcome/Leave/Boost Messages (Multi-Message System)
- ✅ `getWelcomeMessages(guildId)` - Get all welcome messages
- ✅ `addWelcomeMessage(guildId, channelId, message)` - Add/update welcome message
- ✅ `removeWelcomeMessage(guildId, channelId)` - Remove welcome message
- ✅ `getLeaveMessages(guildId)` - Get all leave messages
- ✅ `addLeaveMessage(guildId, channelId, message)` - Add/update leave message
- ✅ `removeLeaveMessage(guildId, channelId)` - Remove leave message
- ✅ `getBoostMessages(guildId)` - Get all boost messages
- ✅ `addBoostMessage(guildId, channelId, message)` - Add/update boost message
- ✅ `removeBoostMessage(guildId, channelId)` - Remove boost message

#### Starboard System (Individual Setters)
- ✅ `setStarboardChannel(guildId, channelId)` - Set starboard channel
- ✅ `setStarboardThreshold(guildId, threshold)` - Set starboard threshold
- ✅ `setStarboardEmoji(guildId, emoji)` - Set starboard emoji

#### Ticket System
- ✅ `getTicketSystem(guildId)` - Get ticket system configuration
- ✅ `setTicketSystem(guildId, config)` - Set ticket system configuration
- ✅ `createTicket(guildId, userId, channelId)` - Create a new ticket
- ✅ `closeTicket(guildId, channelId, closedBy)` - Close a ticket
- ✅ `getActiveTickets(guildId)` - Get active tickets
- ✅ `getTicketByChannel(guildId, channelId)` - Get ticket by channel ID

#### Voice Manager System
- ✅ `getVoiceManager(guildId)` - Get voice manager configuration
- ✅ `setVoiceManager(guildId, config)` - Set voice manager configuration
- ✅ `addTempChannel(guildId, channelId, ownerId)` - Add temporary channel
- ✅ `removeTempChannel(guildId, channelId)` - Remove temporary channel
- ✅ `getTempChannels(guildId)` - Get temporary channels
- ✅ `getTempChannel(guildId, channelId)` - Get temporary channel by ID
- ✅ `updateTempChannelSettings(guildId, channelId, settings)` - Update temp channel settings

#### Logging System
- ✅ `getLoggingConfig(guildId)` - Get logging configuration
- ✅ `setLoggingChannel(guildId, channelId, webhookUrl, logTypes, createdBy)` - Set logging channel
- ✅ `removeLoggingChannel(guildId, channelId)` - Remove logging channel
- ✅ `clearLoggingConfig(guildId)` - Clear all logging configurations
- ✅ `getLoggingConfigForChannel(guildId, channelId)` - Get logging config for channel
- ✅ `setLoggingEnabled(guildId, channelId, enabled)` - Update logging enabled status

#### Booster Role System
- ✅ `getBoosterRoleSystem(guildId)` - Get booster role system configuration
- ✅ `setBoosterRoleSystem(guildId, baseRoleId, enabled)` - Set booster role system configuration
- ✅ `addBoosterRole(guildId, userId, roleId, name, color, icon)` - Add booster role
- ✅ `removeBoosterRole(guildId, userId)` - Remove booster role
- ✅ `getBoosterRoles(guildId)` - Get booster roles
- ✅ `getBoosterRoleByUser(guildId, userId)` - Get booster role by user ID
- ✅ `updateBoosterRole(guildId, userId, updates)` - Update booster role

#### AFK System
- ✅ `setUserAFK(guildId, userId, reason)` - Set user AFK status
- ✅ `removeUserAFK(guildId, userId)` - Remove user AFK status
- ✅ `getUserAFK(guildId, userId)` - Get user AFK status
- ✅ `getAllAFK(guildId)` - Get all AFK users

#### Force Nick System
- ✅ `addForceNick(guildId, userId, nickname, setBy)` - Add forced nickname
- ✅ `removeForceNick(guildId, userId)` - Remove forced nickname
- ✅ `getForceNick(guildId, userId)` - Get forced nickname
- ✅ `getAllForceNicks(guildId)` - Get all forced nicknames

---

### UserService
**Status:** Core methods implemented

#### Birthday System
- ✅ `getBirthday(userId)` - Get birthday
- ✅ `setBirthday(userId, day, month)` - Set birthday
- ✅ `clearBirthday(userId)` - Clear birthday
- ✅ `getFormattedBirthday(userId)` - Get formatted string
- ✅ `isBirthday(userId)` - Check if today
- ✅ `getUsersWithBirthday(day, month)` - Get users with birthday

#### Roleplay System
- ✅ `trackRoleplayInteraction(userId, targetId, action)` - Track interaction
- ✅ `getRoleplayCount(userId, targetId, action)` - Get count
- ✅ `getRoleplayGiven(userId, action)` - Get given interactions
- ✅ `getRoleplayReceived(userId, action)` - Get received interactions
- ✅ `getRoleplayLeaderboard(action, limit)` - Get leaderboard

#### Last.fm System
- ✅ `getLastFMUsername(userId)` - Get username
- ✅ `setLastFMUsername(userId, username)` - Set username
- ✅ `getLastFMLibrary(userId)` - Get library
- ✅ `setLastFMLibrary(userId, library)` - Set library
- ✅ `getLastFMSettings(userId)` - Get settings
- ✅ `setLastFMSettings(userId, settings)` - Set settings

#### TicTacToe System
- ✅ `getTicTacToeStats(userId)` - Get stats
- ✅ `updateTicTacToeStats(userId, result)` - Update stats
- ✅ `resetTicTacToeStats(userId)` - Reset stats

#### Gambling System
- ✅ `getGamblingData(userId)` - Get gambling data
- ✅ `updateWallet(userId, amount)` - Update wallet
- ✅ `transferMoney(userId, amount, toBank)` - Transfer money
- ✅ `updateDailyClaim(userId, streak)` - Update daily
- ✅ `updateWorkTimestamp(userId)` - Update work time
- ✅ `updateGamblingStats(userId, gambled, won, lost)` - Update stats

---

### SystemService
**Status:** Core methods implemented

#### Blacklist System
- ✅ `isUserBlacklisted(userId)` - Check user
- ✅ `isServerBlacklisted(serverId)` - Check server
- ✅ `addUserToBlacklist(userId, reason, addedBy)` - Add user
- ✅ `addServerToBlacklist(serverId, reason, addedBy)` - Add server
- ✅ `removeUserFromBlacklist(userId)` - Remove user
- ✅ `removeServerFromBlacklist(serverId)` - Remove server
- ✅ `getBlacklistInfo()` - Get info

#### Instance Configuration
- ✅ `getInstanceConfig(instanceId)` - Get config
- ✅ `setInstanceConfig(instanceId, config)` - Set config
- ✅ `getInstanceBotStatus(instanceId)` - Get bot status
- ✅ `setInstanceBotStatus(instanceId, botStatus)` - Set bot status
- ✅ `removeInstanceConfig(instanceId)` - Remove config
- ✅ `getAllInstanceConfigs()` - Get all configs

#### Global Settings
- ✅ `getGlobalSetting(key)` - Get setting
- ✅ `setGlobalSetting(key, value)` - Set setting
- ✅ `removeGlobalSetting(key)` - Remove setting
- ✅ `getAllGlobalSettings()` - Get all settings

#### Maintenance Mode
- ✅ `isMaintenanceModeEnabled()` - Check status
- ✅ `enableMaintenanceMode(reason, enabledBy)` - Enable
- ✅ `disableMaintenanceMode()` - Disable

---

## 🔄 PENDING - Commands Needing Service Methods

### High Priority

#### 1. Welcome/Leave/Boost Messages
**Commands:** `welcome.js`, `leave.js`, `boost.js`
**Status:** ✅ Methods exist but need verification
- `getWelcomeSettings(guildId)`
- `setWelcomeSettings(guildId, channelId, message)`
- `removeWelcomeSettings(guildId)`
- Similar for Leave and Boost

#### 2. Vanity System
**Command:** `vanity.js`
**Status:** ✅ Methods exist but need verification
- `getVanitySettings(guildId)`
- `setVanitySettings(guildId, vanityText, roles, logChannelId, message)`
- `disableVanity(guildId, reason)`

#### 3. Auto Roles
**Command:** `autorole.js`
**Status:** ✅ Methods exist but need verification
- `getAutoRoles(guildId)`
- `addAutoRole(guildId, roleId)`
- `removeAutoRole(guildId, roleId)`
- `clearAutoRoles(guildId)`

#### 4. Jail System
**Command:** Jail-related commands
**Status:** ✅ Methods exist but need verification
- `getJailSettings(guildId)`
- `setJailSettings(guildId, roleId, channelId)`

#### 5. Ticket System
**Command:** `ticket.js`
**Status:** ✅ Methods implemented
- ✅ `getTicketSystem(guildId)`
- ✅ `setTicketSystem(guildId, config)`
- ✅ `createTicket(guildId, userId, channelId)`
- ✅ `closeTicket(guildId, channelId, closedBy)`
- ✅ `getActiveTickets(guildId)`
- ✅ `getTicketByChannel(guildId, channelId)`

#### 6. Voice Manager
**Command:** `vm.js`
**Status:** ✅ Methods implemented
- ✅ `getVoiceManager(guildId)`
- ✅ `setVoiceManager(guildId, config)`
- ✅ `addTempChannel(guildId, channelId, ownerId)`
- ✅ `removeTempChannel(guildId, channelId)`
- ✅ `getTempChannels(guildId)`
- ✅ `getTempChannel(guildId, channelId)`
- ✅ `updateTempChannelSettings(guildId, channelId, settings)`

#### 7. Logging System
**Command:** `logs.js`
**Status:** ✅ Methods implemented
- ✅ `getLoggingConfig(guildId)`
- ✅ `setLoggingChannel(guildId, channelId, webhookUrl, logTypes, createdBy)`
- ✅ `removeLoggingChannel(guildId, channelId)`
- ✅ `clearLoggingConfig(guildId)`
- ✅ `getLoggingConfigForChannel(guildId, channelId)`
- ✅ `setLoggingEnabled(guildId, channelId, enabled)`

#### 8. Booster Role System
**Command:** `br.js`
**Status:** ✅ Methods implemented
- ✅ `getBoosterRoleSystem(guildId)`
- ✅ `setBoosterRoleSystem(guildId, baseRoleId, enabled)`
- ✅ `addBoosterRole(guildId, userId, roleId, name, color, icon)`
- ✅ `removeBoosterRole(guildId, userId)`
- ✅ `getBoosterRoles(guildId)`
- ✅ `getBoosterRoleByUser(guildId, userId)`
- ✅ `updateBoosterRole(guildId, userId, updates)`

#### 9. Moderation System
**Command:** Various moderation commands
**Status:** ✅ Methods exist but need verification
- `getModerationHistory(guildId, userId, action)`
- `addModerationCase(guildId, caseData)`
- `getModerationCase(guildId, caseId)`
- `removeModerationCase(guildId, caseId)`

#### 10. Reminders System
**Command:** Reminder commands
**Status:** ✅ Methods exist in UserService
- `getReminders(userId)`
- `addReminder(userId, content, duration, isDaily, guildId, channelId, messageUrl)`
- `updateReminderNextTrigger(userId, reminderId, nextTrigger)`

#### 11. Notes System
**Command:** Notes commands
**Status:** ✅ Methods exist in UserService
- `getNotes(userId)`
- `addNote(userId, content)`
- `removeNote(userId, noteId)`
- `clearNotes(userId)`

#### 12. AFK System
**Command:** AFK commands
**Status:** ✅ Methods implemented in GuildService
- ✅ `setUserAFK(guildId, userId, reason)`
- ✅ `removeUserAFK(guildId, userId)`
- ✅ `getUserAFK(guildId, userId)`
- ✅ `getAllAFK(guildId)`

#### 13. Force Nick System
**Command:** Force nick commands
**Status:** ✅ Methods implemented in GuildService
- ✅ `addForceNick(guildId, userId, nickname, setBy)`
- ✅ `removeForceNick(guildId, userId)`
- ✅ `getForceNick(guildId, userId)`
- ✅ `getAllForceNicks(guildId)`

#### 14. Scheduled Nukes
**Command:** Nuke scheduling
**Status:** ⚠️ Needs methods in GuildService
- `addScheduledNuke(guildId, channelId, time)`
- `removeScheduledNuke(guildId, nukeId)`
- `getScheduledNukes(guildId)`

#### 15. POJ Messages
**Command:** POJ system
**Status:** ⚠️ Needs methods in GuildService
- `addPojMessage(guildId, messageData)`
- `removePojMessage(guildId, messageId)`
- `getPojMessages(guildId)`

#### 16. Autopost Channels
**Command:** Autopost system
**Status:** ⚠️ Needs methods in GuildService
- `addAutopostChannel(guildId, channelId, config)`
- `removeAutopostChannel(guildId, channelId)`
- `getAutopostChannels(guildId)`

---

## 📋 Implementation Tasks

### Phase 1: Verification (Current)
- ✅ Verify all existing methods work correctly
- ✅ Test autoreact, autoresponder, swear tracking
- ✅ Test level system
- ✅ Test starboard and giveaways
- ✅ Test Last.fm integration
- ✅ Test roleplay and birthday systems

### Phase 2: High Priority Missing Methods
1. ⚠️ Ticket System methods
2. ⚠️ Voice Manager methods
3. ⚠️ Logging System methods
4. ⚠️ Booster Role System methods
5. ⚠️ AFK System methods
6. ⚠️ Force Nick methods

### Phase 3: Medium Priority
7. ⚠️ Scheduled Nukes methods
8. ⚠️ POJ Messages methods
9. ⚠️ Autopost Channels methods

### Phase 4: Testing & Optimization
- Test all commands end-to-end
- Optimize cache performance
- Add missing error handling
- Document all methods

---

## 🎯 Next Steps

1. **Immediate:** Test the bot with current implementations
2. **Next:** Identify which commands are throwing errors
3. **Then:** Implement missing methods based on priority
4. **Finally:** Full system test and optimization

---

## 📝 Notes

- All timestamps use UTC
- All methods include proper error handling
- Cache-first strategy for all reads
- Validation on all inputs
- Proper error types (ValidationError, DatabaseWriteError, etc.)

---

**Last Updated:** 2025-01-24
**Status:** Phase 2 Complete - All High Priority Service Methods Implemented

## Phase 2 Completion Summary

All six high-priority service method groups have been successfully implemented in GuildService:

1. ✅ **Ticket System** - 6 methods for support ticket management
2. ✅ **Voice Manager** - 7 methods for temporary voice channel management
3. ✅ **Logging System** - 6 methods for event logging configuration
4. ✅ **Booster Role System** - 7 methods for custom booster role management
5. ✅ **AFK System** - 4 methods for away status tracking
6. ✅ **Force Nick System** - 4 methods for enforced nickname management

**Total Methods Added:** 34 new service methods

All methods follow existing patterns:
- ✅ Proper JSDoc documentation
- ✅ Input validation with ValidationError
- ✅ Cache-first read strategy
- ✅ Write-through caching
- ✅ Graceful error handling
- ✅ UTC timestamps where applicable

**Next Steps:** Phase 3 - Implement remaining medium priority methods (Scheduled Nukes, POJ Messages, Autopost Channels)
