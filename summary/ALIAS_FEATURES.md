# Alias System - Advanced Features

## Overview
The alias system now supports advanced templating with placeholders and role operations, making it easy to create powerful shortcuts for complex commands.

## Placeholder Syntax

### Basic Usage
Use `{0}` in your alias to insert the first argument when the alias is called.

**Example:**
```
alias add pic role {0} @PicPerms
```

**Usage:**
```
,pic @user
```

**Expands to:**
```
,role @user @PicPerms
```

### More Examples

**Timeout shortcut:**
```
alias add shh timeout {0} 5m
```
Usage: `,shh @user` → `,timeout @user 5m`

**Ban with reason:**
```
alias add quickban ban {0} Spam
```
Usage: `,quickban @user` → `,ban @user Spam`

## Role Operations

### Prefix Syntax
- `+ROLEID` - Force add role (won't remove if already present)
- `-ROLEID` - Force remove role (won't add if not present)
- `ROLEID` or `@Role` - Toggle role (add if missing, remove if present)

### Examples

**Add multiple roles:**
```
alias add mod role {0} +123456789, +987654321
```
Usage: `,mod @user` → Adds both roles to the user

**Remove specific role:**
```
alias add unverify role {0} -123456789
```
Usage: `,unverify @user` → Removes the role from the user

**Mixed operations:**
```
alias add promote role {0} +123456789, +987654321, -111111111
```
Usage: `,promote @user` → Adds first two roles, removes the third

**With role mentions:**
```
alias add pic role {0} @PicPerms
```
Usage: `,pic @user` → Toggles the @PicPerms role

## How It Works

1. **Alias Creation**: When you create an alias with `{0}`, it's stored as a template
2. **Alias Execution**: When you use the alias, the first argument replaces `{0}`
3. **Command Processing**: The expanded command is then executed normally
4. **Role Parsing**: The role command handles `+` and `-` prefixes for role operations

## Limitations

- Only one placeholder `{0}` is supported per alias
- The placeholder always takes the first argument after the alias name
- Role IDs must be valid and the bot must have permission to manage them
- Role hierarchy rules still apply (can't manage roles above the bot's highest role)

## Tips

- Use role IDs instead of mentions for more reliable aliases
- Test your aliases with yourself first before using on others
- Remember that `+` forces add, `-` forces remove, and no prefix toggles
- You can combine multiple role operations in one alias using commas

## Examples in Action

### Picture Permissions
```
alias add pic role {0} @PicPerms
,pic @john
```
Result: Toggles @PicPerms role for @john

### Quick Mute
```
alias add shh timeout {0} 5m
,shh @spammer
```
Result: Times out @spammer for 5 minutes

### Staff Promotion
```
alias add staff role {0} +123456789, +987654321, -111111111
,staff @newmod
```
Result: Adds staff roles and removes member role from @newmod
