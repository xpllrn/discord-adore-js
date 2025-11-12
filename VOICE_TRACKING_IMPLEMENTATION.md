# Voice Tracking & Enhanced Message Stats Implementation

## Overview
Added comprehensive voice tracking to the leveling system and enhanced the `msg` command to show detailed statistics.

## Features Added

### 1. Voice Time Tracking
- Tracks time spent in voice channels (per day)
- Stores daily voice statistics
- Calculates today, this week, and this month totals
- Only tracks active time (excludes muted/deafened users)

### 2. Voice XP System
- Awards 10-15 XP per minute in voice
- 1-minute cooldown between XP awards
- Triggers level-up notifications
- Assigns level roles automatically

### 3. Enhanced Message Stats
- **Today's messages**: Messages sent today
- **This week's messages**: Messages sent this week
- **This month's messages**: Messages sent this month
- **Total messages**: All-time message count

### 4. Updated `msg` Command
Shows comprehensive statistics:
```
Messages                    Voice Time
Today: X                    Today: Xh Xm
This Week: X                This Week: Xh Xm
This Month: X               This Month: Xh Xm
Total: X
```

## Database Changes

### Guild Model Updates
1. **UserLevels Schema** - Added voice tracking fields:
   - `voiceJoinTime`: Timestamp when user joined voice
   - `lastVoiceXPTime`: Last time XP was awarded for voice

2. **New VoiceStats Schema**:
   - `userId`: User ID
   - `date`: Date of the voice session
   - `minutes`: Minutes spent in voice that day

3. **MessageStats Schema** - Enhanced to track daily messages instead of single counter

### New Indexes
- `VoiceStats.userId`
- `VoiceStats.date`
- `VoiceStats.userId + VoiceStats.date` (compound)

## GuildService Methods Added

### Voice Tracking
- `trackVoiceTime(guildId, userId, minutes)` - Track voice time
- `getVoiceStats(guildId, userId)` - Get voice stats (today/week/month)
- `setVoiceJoinTime(guildId, userId, joinTime)` - Set voice join time
- `clearVoiceJoinTime(guildId, userId)` - Clear voice join time
- `getVoiceJoinTime(guildId, userId)` - Get voice join time
- `getLastVoiceXPTime(guildId, userId)` - Get last voice XP time
- `updateLastVoiceXPTime(guildId, userId, time)` - Update last voice XP time

### Message Stats Enhanced
- `getMessageStats(guildId, userId)` - Now returns object with today/week/month/total
- `trackMessage(guildId, userId)` - Now tracks daily messages

## Event Handler Updates

### voiceStateUpdate.js
New functionality:
1. **Join Detection**: Records join time when user enters voice (if not muted/deafened)
2. **Leave Detection**: Calculates time spent and tracks it
3. **State Changes**: Handles mute/unmute, deafen/undeafen state changes
4. **XP Awards**: Awards 10-15 XP per minute spent in voice
5. **Level Up**: Triggers level-up notifications for voice leveling

## Usage

### For Users
```
;msg @user          - View detailed message and voice stats
;msg                - View your own stats
```

### Voice Tracking Behavior
- User must be in voice channel and NOT muted/deafened
- XP awarded every minute (10-15 XP)
- Time tracked in minute increments
- Stats reset daily but accumulated for week/month views

## Technical Notes

### Performance Considerations
- Uses atomic operations to prevent race conditions
- Daily tracking reduces database size
- Indexed queries for fast lookups
- Cache invalidation on updates

### Edge Cases Handled
- User mutes/unmutes while in voice
- User moves between channels
- Bot restarts while user in voice
- Multiple rapid state changes

### Future Enhancements
- Voice leaderboard command
- Configurable XP rates for voice
- AFK channel detection
- Voice activity rewards
