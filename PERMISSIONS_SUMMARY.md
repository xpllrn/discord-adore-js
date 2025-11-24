# Permission System Summary

## Permission Categories

### 1. Discord Permissions (underscore format)
These are official Discord permissions that match the API format:

- `administrator` - Full server control
- `ban_members` - Ban members from server
- `kick_members` - Kick members from server
- `manage_guild` - Manage server settings
- `manage_channels` - Create/edit/delete channels
- `manage_roles` - Create/edit/delete roles
- `manage_messages` - Delete messages, pin messages
- `manage_expressions` - Manage emojis, stickers, soundboard
- `manage_nicknames` - Change other members' nicknames
- `moderate_members` - Timeout members
- `manage_webhooks` - Create/edit/delete webhooks
- `view_audit_log` - View server audit log
- `mention_everyone` - Mention @everyone and @here
- `mute_members` - Mute members in voice channels
- `deafen_members` - Deafen members in voice channels
- `move_members` - Move members between voice channels

### 2. Custom Permissions (readable format)
These are bot-specific permissions for special roles:

- `developer` - Bot developers only (formerly `dev`)
- `Server Booster` - Server boosters only
- `Server Owner` - Server owner only

## Current Usage Statistics

**Total Commands with Permissions:** 66
**Unique Permissions Used:** 14

### Discord Permissions Usage:
1. `manage_guild` - 16 commands
2. `manage_channels` - 10 commands
3. `manage_messages` - 9 commands
4. `manage_roles` - 5 commands
5. `moderate_members` - 6 commands
6. `manage_expressions` - 4 commands
7. `administrator` - 3 commands
8. `ban_members` - 2 commands
9. `manage_nicknames` - 2 commands
10. `kick_members` - 1 command

### Custom Permissions Usage:
1. `developer` - 5 commands (dev tools)
2. `Server Booster` - 1 command (boost role customization)
3. `Server Owner` - 1 command (server profile customization)

## Special Cases

### `manage_guild_and_manage_roles`
- **File:** `commands/server/roles/autorole.js`
- **Issue:** This combines two permissions into one string
- **Recommendation:** Should be split into two separate permission checks in the command logic

## Unused Discord Permissions

These Discord permissions are available but not currently used in any commands:

- `view_audit_log`
- `manage_webhooks`
- `mute_members`
- `deafen_members`
- `move_members`
- `mention_everyone`
- `view_guild_insights`
- `external_emojis`
- `change_nickname`
- `send_messages`

## Removed Permissions

### `user`
- **Removed from:** `commands/fun/random/blacktea.js`
- **Reason:** Not a real permission, any user can use commands by default

### `send_messages`
- **Removed from:** `commands/fun/random/quote.js`
- **Reason:** Users need Send Messages permission to use commands anyway

## For Fake Permissions Command

When listing permissions in the fakepermissions command, use these categories:

**Discord Permissions (can be faked):**
- administrator
- ban_members
- kick_members
- manage_guild
- manage_channels
- manage_roles
- manage_messages
- manage_expressions
- manage_nicknames
- moderate_members
- manage_webhooks
- view_audit_log
- mention_everyone

**Custom Permissions (cannot be faked):**
- developer
- Server Booster
- Server Owner
