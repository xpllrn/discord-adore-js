# vleed Bot - Complete Documentation

## About vleed
**vleed** is a powerful, feature-rich Discord bot with advanced moderation, security, customization, and utility features. Built for server owners who want complete control and protection.

- **Bot Name:** vleed (always lowercase)
- **Default Prefix:** `,` (customizable per server)
- **Support Server:** https://dsc.gg/s-invite

---

## 🛡️ Moderation System

### Setup Commands
**`,setup`** - Creates case logs channel (#jail-log) and jail role
**`,setupmute`** - Creates all mute roles (Muted, Image Muted, Reaction Muted, Jailed)

### Core Moderation Commands

**`,ban @user [duration] [reason]`**
- Ban a member from the server
- Optional duration: `7d`, `1h`, `30m` for temporary bans
- Example: `,ban @spammer 7d Spamming in chat`

**`,massban @user1 @user2 @user3 [reason]`**
- Ban multiple members at once
- Useful for raids
- Example: `,massban @user1 @user2 Raid attack`

**`,unban [user ID] [reason]`**
- Unban a user using their Discord ID
- Example: `,unban 123456789012345678 Appeal accepted`

**`,kick @user [reason]`**
- Kick a member from the server
- Example: `,kick @user Breaking rules`

**`,masskick @user1 @user2 @user3 [reason]`**
- Kick multiple members at once

**`,mute @user [duration] [reason]`**
- Text mute a member (prevents sending messages)
- Duration examples: `1h`, `30m`, `1d`
- Example: `,mute @user 1h Spamming`

**`,unmute @user [reason]`**
- Remove text mute from a member

**`,imagemute @user [duration] [reason]`** (aliases: `imute`)
- Prevent member from uploading images/attachments
- Example: `,imagemute @user 1h Inappropriate images`

**`,unimagemute @user [reason]`** (aliases: `unimute`)
- Remove image mute

**`,reactionmute @user [duration] [reason]`** (aliases: `rmute`)
- Prevent member from adding reactions
- Example: `,reactionmute @user 30m Reaction spam`

**`,unreactionmute @user [reason]`** (aliases: `unrmute`)
- Remove reaction mute

**`,jail @user [reason]`**
- Jail a member (restricts them to #jail channel only)
- Example: `,jail @user Timeout needed`

**`,unjail @user [reason]`**
- Remove member from jail

**`,warn @user [reason]`**
- Warn a member
- Example: `,warn @user Please follow the rules`

---

## 🔒 Antinuke System

The antinuke system protects your server from destructive moderator actions. It monitors and limits dangerous actions to prevent server nuking.

### Setup & Configuration

**`,antinuke admin @user`** (Server Owner only)
- Grant antinuke configuration permissions to a user
- ⚠️ WARNING: This is dangerous - they can alter all antinuke settings

**`,antinuke whitelist @user`** (Server Owner/Antinuke Admin)
- Exempt a user from antinuke restrictions
- ⚠️ WARNING: Whitelisted users bypass ALL antinuke checks

**`,antinuke config`**
- View current antinuke configuration

**`,antinuke list`**
- View enabled modules and whitelisted users

**`,antinuke admins`**
- View users with antinuke admin permissions

### Antinuke Modules

Each module can be configured with:
- **Status:** `on` or `off`
- **Threshold:** Number of actions before punishment (1-10)
- **Punishment:** `strip` (remove roles), `kick`, or `ban`

**`,antinuke ban <on|off> [--threshold 1-10] [--do strip|kick|ban]`**
- Prevent mass member bans
- Example: `,antinuke ban on --threshold 3 --do ban`

**`,antinuke kick <on|off> [--threshold 1-10] [--do strip|kick|ban]`**
- Prevent mass member kicks
- Example: `,antinuke kick on --threshold 3 --do ban`

**`,antinuke role <on|off> [--threshold 1-10] [--do strip|kick|ban]`**
- Prevent mass role deletions
- Example: `,antinuke role on --threshold 5 --do kick`

**`,antinuke channel <on|off> [--threshold 1-10] [--do strip|kick|ban]`**
- Prevent mass channel creation/deletion
- Example: `,antinuke channel on --threshold 5 --do kick`

**`,antinuke webhook <on|off> [--threshold 1-10] [--do strip|kick|ban]`**
- Prevent mass webhook creation
- Example: `,antinuke webhook on --threshold 3 --do ban`

**`,antinuke botadd <on|off> [--do strip|kick|ban]`**
- Prevent unauthorized bot additions
- No threshold needed (any bot add triggers it)
- Example: `,antinuke botadd on --do ban`

**`,antinuke permissions <on|off> [--do strip|kick|ban]`**
- Watch dangerous permission grants
- Monitors: Administrator, Ban Members, Kick Members, Manage Guild, Manage Roles, Manage Channels, Manage Webhooks, Mention Everyone
- Example: `,antinuke permissions on --do strip`

---

## 🎨 Customization

### Bot Appearance (Server Owner Only)

**`,customize avatar [image URL]`** (aliases: `custom avatar`)
- Set custom bot avatar for your server
- Attach image or provide URL
- Leave empty to reset to global avatar
- 5 minute cooldown
- Supported: PNG, JPG, GIF
- ⚠️ Monitored for inappropriate content

**`,customize banner [image URL]`** (aliases: `custom banner`)
- Set custom bot banner for your server
- Same rules as avatar

**`,customize bio [text]`** (aliases: `custom bio`)
- Set custom bot bio (max 190 characters)
- Leave empty to reset to global bio

### Prefix Management

**`,prefix`**
- View current server prefix

**`,prefix set [symbol]`** (Administrator)
- Change server prefix (max 3 characters, no spaces)
- Example: `,prefix set !`

**`,prefix remove`** (Administrator, aliases: `prefix reset`, `prefix default`)
- Reset to default prefix (`,`)

**`,selfprefix set [prefix]`** (Premium)
- Set personal prefix that works alongside server prefix
- Example: `,selfprefix set !`

**`,selfprefix remove`** (Premium)
- Remove your personal prefix

---

## 📝 Embed System

vleed has a powerful embed builder with variable support. Create custom embeds for welcome messages, announcements, and more.

### Embed Syntax
```
{embed}$v{parameter: value}$v{parameter: value}
```

### Available Parameters

**Basic Structure:**
- `{title: Your Title}` - Embed title
- `{description: Your description text}` - Main embed text
- `{color: #5865F2}` - Hex color code
- `{url: https://example.com}` - Clickable title URL
- `{timestamp}` - Add current timestamp

**Author Section:**
- `{author: Name}` - Just author name
- `{author: Name && https://icon.url}` - Name with icon
- `{author: Name && https://icon.url && https://url.com}` - Name, icon, and URL

**Footer Section:**
- `{footer: Footer text}` - Just footer text
- `{footer: Footer text && https://icon.url}` - Footer with icon

**Images:**
- `{thumbnail: https://image.url}` - Small image (top right)
- `{image: https://image.url}` - Large image (bottom)

**Fields:**
- `{field: Field Name && Field Value}` - Regular field
- `{field: Field Name && Field Value && inline}` - Inline field

**Buttons:**
- `{button: Link && Button Text && https://url.com && enabled}` - Link button
- `{button: Green && Button Text && emoji && enabled}` - Green button
- `{button: Red && Button Text && emoji && enabled}` - Red button
- `{button: Blue && Button Text && emoji && enabled}` - Blue button
- `{button: Gray && Button Text && emoji && enabled}` - Gray button

**Content:**
- `{content: Message text}` - Text outside the embed

### Variables

**User Variables:**
- `{user.mention}` - Mention the user
- `{user.name}` - Username
- `{user.tag}` - Username#0000
- `{user.id}` - User ID
- `{user.avatar}` - User avatar URL
- `{user.created_at}` - Account creation date
- `{user.joined_at}` - Server join date

**Server Variables:**
- `{server.name}` - Server name
- `{server.id}` - Server ID
- `{server.icon}` - Server icon URL
- `{server.banner}` - Server banner URL
- `{server.membercount}` - Total member count
- `{server.humanmembercount}` - Human member count (no bots)
- `{server.owner}` - Server owner mention

**Channel Variables:**
- `{channel.mention}` - Mention the channel
- `{channel.name}` - Channel name
- `{channel.id}` - Channel ID

### Example Embed
```
{embed}$v{author: {server.name} && {server.icon}}$v{title: Welcome to the server!}$v{description: Hey {user.mention}! 👋\n\nThanks for joining **{server.name}**!\nYou are our **{server.humanmembercount}** member!}$v{thumbnail: {user.avatar}}$v{field: Account Created && {user.created_at} && inline}$v{field: Joined Server && {user.joined_at} && inline}$v{image: {server.banner}}$v{footer: Welcome! && {server.icon}}$v{timestamp}$v{color: #5865F2}$v{button: Link && Read Rules && https://example.com/rules && enabled}$v{button: Green && Get Started && 🚀 && enabled}
```

### Embed Commands

**`,createembed [embed code]`**
- Create and send an embed
- Example: `,createembed {embed}$v{title: Hello}$v{description: World}`

---

## 🤖 AI Assistant

**`,ask [question]`** (aliases: `ai`, `question`)
- Ask the AI assistant anything
- Powered by Google Gemini
- Can reply to messages for context
- Example: `,ask what is the capital of France?`
- Example: Reply to an embed and use `,ask explain this embed`

---

## 📊 Logging System

vleed has comprehensive logging for all server events.

### Log Types:
- **Moderator Logs** - All moderation actions (bans, kicks, mutes, warns)
- **Message Logs** - Message edits and deletions
- **Member Logs** - Member joins and leaves
- **Server Event Logs** - Role changes, channel changes, permission updates

### What Gets Logged:
- Moderation actions with case numbers
- Message edits (before/after)
- Message deletions (with content)
- Member role updates
- Channel permission changes
- Role updates (name, color, permissions)
- Channel updates
- Audit log events

---

## 🎂 Utility Commands

**`,birthday set [MM/DD]`**
- Set your birthday
- Example: `,birthday set 12/25`

**`,birthday remove`**
- Remove your birthday

**`,birthday [user]`**
- View someone's birthday

**`,serverinfo`**
- View detailed server information

**`,userinfo [user]`**
- View detailed user information

**`,avatar [user]`**
- View user's avatar

---

## ⚠️ Common Issues

**"I can't use moderation commands"**
- Make sure you have the required permissions (Ban Members, Kick Members, etc.)
- Check that the bot's role is higher than the target user's highest role
- Ensure the bot has the necessary permissions

**"Antinuke isn't working"**
- Only server owner can initially configure it
- Use `,antinuke admin @user` to grant others access
- Make sure modules are enabled with `,antinuke [module] on`
- Check thresholds are set appropriately

**"Mute commands don't work"**
- Run `,setupmute` first to create mute roles
- Ensure bot has Manage Roles permission
- Bot's role must be higher than mute roles

**"Embed variables aren't working"**
- Make sure variables are spelled correctly: `{user.mention}` not `{user.ping}`
- Some variables like `{server.banner}` may be empty if server has no banner
- Use proper syntax: `$v` between parameters

**"Custom avatar/banner not showing"**
- Only server owner can use customize commands
- Wait 5 minutes between customizations (cooldown)
- Make sure image URL is valid and accessible
- Supported formats: PNG, JPG, GIF

---

## 💎 Premium Features

- Personal prefix (`,selfprefix`)
- Booster role system
- Additional customization options

---

## Important Notes

- vleed is NOT an AI bot - it's a Discord bot with an AI assistant feature (`,ask`)
- The `,ask` command uses an AI to answer questions, but vleed itself is a traditional Discord bot
- All moderation actions are logged and tracked with case numbers
- Antinuke is highly recommended for servers with multiple moderators
- Always test embed codes with `,createembed` before using in automated messages
