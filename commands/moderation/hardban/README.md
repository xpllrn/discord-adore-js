# Hardban System

The hardban system provides persistent bans that can only be managed by antinuke admins and the server owner.

## Features

- **Persistent Enforcement**: Hardbanned users are automatically banned again if they try to rejoin, even if removed from Discord's ban list
- **Restricted Access**: Only antinuke admins and the server owner can hardban/unhardban users
- **Automatic Protection**: The bot checks every member join and enforces hardbans immediately
- **Integrated with Unban**: The `,unban` command automatically detects hardbanned users and requires elevated permissions

## Commands

### `,hardban [user] (reason)`
Permanently ban a user with hardban protection.

**Aliases:** None  
**Permission:** Antinuke Admin or Server Owner  
**Example:** `,hardban @user raiding the server`

**Features:**
- Adds user to the hardban list
- Bans the user from Discord
- Logs the action in moderation logs
- Creates a moderation case

### `,hardban list`
View all hardbanned users in the server.

**Aliases:** None  
**Permission:** Antinuke Admin or Server Owner  
**Example:** `,hardban list`

**Features:**
- Shows all hardbanned users
- Displays reason, banner, and date for each hardban
- Supports up to 25 hardbans per page

### `,unban [user] (reason)`
Unban a user from the server. Automatically handles hardbanned users.

**Aliases:** None  
**Permission:** Ban Members (regular bans) or Antinuke Admin/Server Owner (hardbans)  
**Example:** `,unban @user appeal accepted`

**Features:**
- Automatically detects if user is hardbanned
- Requires antinuke admin or server owner permission for hardbanned users
- Regular moderators can only unban non-hardbanned users
- Removes user from hardban list if applicable
- Unbans the user from Discord
- Logs the action in moderation logs
- Creates a moderation case

## How It Works

1. **Hardban Enforcement**: When a user joins the server, the bot checks if they're on the hardban list
2. **Automatic Ban**: If found, the user is immediately banned with the original reason
3. **Logging**: All hardban enforcements are logged to the moderator log channel
4. **Persistence**: Even if someone removes the user from Discord's ban list, they'll be banned again on rejoin

## Database Schema

Hardbans are stored in the guild document:

```javascript
Hardbans: [{
  userId: String,        // Discord user ID
  reason: String,        // Reason for hardban
  bannedBy: String,      // ID of user who issued hardban
  bannedAt: Date         // Timestamp of hardban
}]
```

## Permission Requirements

To use hardban commands, users must be either:
- The server owner, OR
- An antinuke admin (added via antinuke system)

Regular moderators with "Ban Members" permission cannot use hardban commands.

## Moderation Case Types

The hardban system adds two new moderation case types:
- `hardban` - When a user is hardbanned
- `unhardban` - When a hardban is removed

These appear in moderation history alongside other actions.
