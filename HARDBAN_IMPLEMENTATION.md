# Hardban System Implementation

## Overview
A persistent ban system that only antinuke admins and the server owner can manage. Hardbanned users are automatically re-banned if they try to rejoin, even if removed from Discord's ban list.

## Files Created/Modified

### New Files
1. **commands/moderation/hardban/hardban.js** - Command to hardban users and list hardbans (with `list` subcommand)
2. **commands/moderation/hardban/README.md** - Documentation for the hardban system

### Modified Files
1. **database/models/guild.js**
   - Added `Hardbans` array to store hardban records
   - Added index for `Hardbans.userId` for fast lookups
   - Added 'hardban' and 'unhardban' to moderation action enum

2. **database/services/data/GuildService.js**
   - Added `addHardban()` - Add user to hardban list
   - Added `removeHardban()` - Remove user from hardban list
   - Added `isHardbanned()` - Check if user is hardbanned
   - Added `getHardban()` - Get hardban info for a user
   - Added `getAllHardbans()` - Get all hardbans for a guild
   - Added `Hardbans: []` to default guild data

3. **events/server/join.js**
   - Added `checkHardban()` function to enforce hardbans on join
   - Modified `guildMemberAdd` event to check hardbans before any other processing
   - Auto-bans hardbanned users immediately upon join

4. **commands/moderation/ban/unban.js**
   - Modified to automatically detect hardbanned users
   - Requires antinuke admin or server owner permission to unban hardbanned users
   - Regular moderators can only unban non-hardbanned users
   - Automatically removes user from hardban list when unbanning

## How It Works

### 1. Hardban Command Flow
```
User runs ,hardban @target reason
  ↓
Check if user is antinuke admin or server owner
  ↓
Add target to Hardbans array in database
  ↓
Ban target from Discord
  ↓
Create moderation case
  ↓
Log action to webhook
```

### 2. Join Event Flow
```
User joins server
  ↓
Check if user is in Hardbans array
  ↓
If hardbanned: Ban immediately and log
  ↓
If not hardbanned: Continue normal join processing
```

### 3. Unban Command Flow (Modified)
```
User runs ,unban @target
  ↓
Check if user has Ban Members permission
  ↓
Check if target is hardbanned
  ↓
If hardbanned: Check if user is antinuke admin or server owner
  ↓
If not authorized: Deny with message
  ↓
If authorized: Remove from Hardbans array
  ↓
Unban target from Discord
  ↓
Create moderation case (unhardban or unban)
  ↓
Log action to webhook
```

## Database Schema

```javascript
Hardbans: [{
  userId: String,        // Discord user ID
  reason: String,        // Reason for hardban
  bannedBy: String,      // ID of user who issued hardban
  bannedAt: Date         // Timestamp of hardban
}]
```

## Permission System

Only these users can use hardban commands:
- Server owner (always)
- Antinuke admins (checked via `antinukeService.isAdmin()`)

Regular moderators with "Ban Members" permission **cannot** use hardban commands.

## Key Features

1. **Persistent Enforcement**: Hardbanned users are re-banned on join, even if removed from Discord's ban list
2. **Restricted Access**: Only antinuke admins and server owner can manage hardbans
3. **Automatic Protection**: No manual intervention needed - bot enforces hardbans automatically
4. **Full Logging**: All hardban actions are logged to moderation logs
5. **Moderation History**: Hardbans appear in moderation case history
6. **List View**: View all hardbanned users with reasons and dates

## Testing Checklist

- [ ] Hardban a user who is in the server
- [ ] Hardban a user who is not in the server (by ID)
- [ ] Verify hardbanned user is auto-banned when they try to rejoin
- [ ] Verify only antinuke admins and server owner can use hardban commands
- [ ] Verify regular moderators cannot use hardban commands
- [ ] Unhardban a user and verify they can rejoin
- [ ] View hardban list with `,hardbans` command
- [ ] Verify moderation cases are created for hardban/unhardban actions
- [ ] Verify webhook logging works for all hardban actions

## Commands Summary

| Command | Permission | Description |
|---------|-----------|-------------|
| `,hardban [user] (reason)` | Antinuke Admin / Owner | Permanently ban a user |
| `,hardban list` | Antinuke Admin / Owner | List all hardbanned users |
| `,unban [user] (reason)` | Ban Members (regular) / Antinuke Admin or Owner (hardbans) | Unban a user (auto-detects hardbans) |

## Notes

- Hardbans are stored per-guild, not globally
- The system checks hardbans before any other join processing (autoroles, welcome messages, etc.)
- If a hardbanned user somehow gets unbanned from Discord, they'll be re-banned on next join attempt
- The original ban reason and banner are preserved in the hardban record
