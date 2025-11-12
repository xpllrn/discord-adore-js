# Antinuke Protection System

A comprehensive server protection system that prevents malicious actions and mass operations.

## Features

- **Whitelist System**: Exempt trusted users and bots from antinuke checks
- **Admin System**: Delegate antinuke management to trusted members
- **Module-Based Protection**: Enable/disable specific protection modules
- **Permission Monitoring**: Watch for dangerous permission changes
- **Action Logging**: Track all antinuke events and actions taken

## Commands

### Setup & Configuration

#### `antinuke config`
View the current antinuke configuration for your server.

**Example:**
```
,antinuke config
```

### Whitelist Management

#### `antinuke whitelist <@user|@bot>`
Add a user or bot to the whitelist. Whitelisted entities bypass all antinuke checks.

**Example:**
```
,antinuke whitelist @TrustedUser
,antinuke whitelist @TrustedBot
```

#### `antinuke list`
View all whitelisted users and bots.

**Example:**
```
,antinuke list
```

### Protection Modules

#### `antinuke role <on|off>`
Prevent mass role deletion. Monitors role delete actions and blocks users who exceed the limit.

**Default Limit:** 3 role deletions in 10 seconds

**Example:**
```
,antinuke role on
,antinuke role off
```

#### `antinuke kick <on|off>`
Prevent mass member kicks. Monitors kick actions and blocks users who exceed the limit.

**Default Limit:** 3 kicks in 10 seconds

**Example:**
```
,antinuke kick on
```

#### `antinuke ban <on|off>`
Prevent mass member bans. Monitors ban actions, blocks users, and unbans victims.

**Default Limit:** 3 bans in 10 seconds

**Example:**
```
,antinuke ban on
```

#### `antinuke channel <on|off>`
Prevent mass channel creation and deletion. Monitors channel actions and blocks users who exceed the limit.

**Default Limit:** 3 channel actions in 10 seconds

**Example:**
```
,antinuke channel on
```

#### `antinuke webhook <on|off>`
Prevent mass webhook creation. Monitors webhook creation and blocks users who exceed the limit.

**Default Limit:** 3 webhook creations in 10 seconds

**Example:**
```
,antinuke webhook on
```

#### `antinuke botadd <on|off>`
Prevent unauthorized bot additions. Automatically kicks bots added by non-whitelisted users.

**Example:**
```
,antinuke botadd on
```

### Permission Monitoring

#### `antinuke permissions grant <permission>`
Start watching for a specific permission being granted to roles.

**Available Permissions:**
- `Administrator`
- `ManageGuild`
- `ManageRoles`
- `ManageChannels`
- `ManageWebhooks`
- `BanMembers`
- `KickMembers`
- `MentionEveryone`

**Example:**
```
,antinuke permissions grant Administrator
,antinuke permissions grant ManageRoles
```

#### `antinuke permissions remove <permission>`
Stop watching a specific permission.

**Example:**
```
,antinuke permissions remove Administrator
```

### Admin Management

#### `antinuke admin <@user>`
Give a user permission to manage antinuke settings. Only the server owner can add admins.

**Example:**
```
,antinuke admin @TrustedModerator
```

#### `antinuke admins`
View all users with antinuke admin permissions.

**Example:**
```
,antinuke admins
```

## How It Works

### Action Tracking
The antinuke system tracks actions per user per guild. When a user performs a protected action (like deleting a role), it's logged with a timestamp. If the user exceeds the configured limit within the timeframe, the system takes action.

### Automatic Response
When a limit is exceeded:
1. The malicious action is logged
2. Dangerous permissions are removed from the user
3. For bans: victims are automatically unbanned
4. For channels: newly created channels are deleted
5. For webhooks: created webhooks are deleted
6. For bots: unauthorized bots are kicked

### Whitelist Bypass
Users and bots on the whitelist completely bypass all antinuke checks. Use this for:
- Trusted administrators
- Legitimate bots (moderation bots, music bots, etc.)
- Bot accounts you control

### Permission Monitoring
When watching permissions, the system monitors role updates. If a watched permission is granted to a role:
- The action is logged
- If `Administrator` is granted, the role permissions are reverted
- The user who made the change has their dangerous permissions removed

## Permissions Required

### For the Bot
- `View Audit Log` - Required to identify who performed actions
- `Manage Roles` - Required to remove dangerous permissions
- `Kick Members` - Required for bot add protection
- `Ban Members` - Required to unban victims of mass bans
- `Manage Channels` - Required to delete malicious channels
- `Manage Webhooks` - Required to delete malicious webhooks

### For Users
- **Server Owner**: Full access to all antinuke commands
- **Antinuke Admins**: Can manage all antinuke settings except adding/removing admins

## Best Practices

1. **Whitelist Trusted Users**: Add your co-owners and trusted admins to the whitelist
2. **Whitelist Legitimate Bots**: Add all your server bots to prevent false positives
3. **Start with Basic Modules**: Enable `role`, `kick`, and `ban` protection first
4. **Monitor Administrator Permission**: Always watch the `Administrator` permission
5. **Designate Admins**: Give antinuke admin to your moderation team
6. **Review Logs**: Check antinuke logs regularly to ensure it's working correctly

## Example Setup

```bash
# Enable basic protections
,antinuke role on
,antinuke kick on
,antinuke ban on
,antinuke channel on
,antinuke webhook on
,antinuke botadd on

# Watch dangerous permissions
,antinuke permissions grant Administrator
,antinuke permissions grant ManageRoles
,antinuke permissions grant ManageGuild

# Whitelist trusted users
,antinuke whitelist @CoOwner
,antinuke whitelist @TrustedAdmin

# Whitelist legitimate bots
,antinuke whitelist @MEE6
,antinuke whitelist @Dyno
,antinuke whitelist @MusicBot

# Add antinuke admins
,antinuke admin @HeadModerator

# Check configuration
,antinuke config
```

## Troubleshooting

### False Positives
If legitimate actions are being blocked:
- Add the user to the whitelist
- Adjust the limits (contact bot developer)
- Temporarily disable the specific module

### Not Working
If antinuke isn't blocking actions:
- Ensure the module is enabled (`,antinuke config`)
- Check if the user is whitelisted (`,antinuke list`)
- Verify the bot has required permissions
- Ensure the bot can access audit logs

### Bot Kicked Legitimate Bot
If a legitimate bot was kicked:
- Re-invite the bot
- Add it to the whitelist immediately
- The bot add protection only triggers for non-whitelisted users

## Notes

- Only the server owner and antinuke admins can use antinuke commands
- The server owner cannot be blocked by antinuke
- Whitelisted users bypass ALL antinuke checks
- Action limits reset after 1 minute
- Logs are kept for the last 100 actions per server
