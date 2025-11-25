# adore Bot - Ultra Detailed Documentation

## 📋 Table of Contents
1. [About adore](#about-adore)
2. [Moderation System](#moderation-system)
3. [Antinuke System](#antinuke-system)
4. [Customization](#customization)
5. [Embed System](#embed-system)
6. [Variables](#variables)
7. [Server Configuration](#server-configuration)
8. [Role Systems](#role-systems)
9. [Message Automation](#message-automation)
10. [Integrations](#integrations)
11. [Music & Integration System](#music--integration-system)
12. [Anti-Bully System (NSR)](#anti-bully-system-no-self-react)
13. [Core Bot Commands](#core-bot-commands)
14. [Developer Commands](#developer-commands)
15. [Economy & Gambling System](#economy--gambling-system)
16. [Utility Commands](#utility-commands)
17. [Common Issues](#common-issues)

---

## About adore

**adore** (always lowercase) is a comprehensive Discord bot designed for server owners who demand complete control, security, and customization. Built with advanced features that rival premium bots while remaining accessible.

### Core Information
- **Bot Name:** adore (NOT "adore", "adore", or "adore")
- **Default Prefix:** `,` (fully customizable per server)
- **Support Server:** https://dsc.gg/s-invite
- **Bot Type:** Traditional Discord bot with AI assistant feature
- **Key Strength:** Security, moderation, and deep customization

### What Makes adore Different
- **Not an AI bot** - adore is a traditional Discord bot with an AI assistant command (`,ask`)
- **Security-first** - Advanced antinuke system prevents server destruction
- **Fully customizable** - Custom avatar, banner, bio per server
- **Rich embed system** - Powerful scripting with 50+ variables
- **Comprehensive logging** - Track everything that happens in your server

---

## 🛡️ Moderation System

### Initial Setup

Before using moderation commands, you need to set up the necessary infrastructure:

**Step 1: Create Case Logs & Jail System**
```
,setup
```
This creates:
- `#jail-log` channel - Logs all moderation actions with case numbers
- `Jailed` role - Used for jailing members
- `#jail` channel - Where jailed members are restricted to

**Step 2: Create Mute Roles**
```
,setupmute
```
This creates four roles:
- `Muted` - Prevents sending messages in all channels
- `Image Muted` - Prevents uploading attachments/images
- `Reaction Muted` - Prevents adding reactions
- `Jailed` - Restricts to #jail channel only

**Important Notes:**
- The `Jailed` role CANNOT be renamed (bot finds it by name)
- Bot's role must be higher than all mute roles
- Bot needs `Manage Roles` and `Manage Channels` permissions
- Mute roles automatically get permissions set in all channels

---

### Core Moderation Commands

#### Ban System

**`,ban @user [duration] [reason]`**
- **Permission Required:** Ban Members
- **What it does:** Permanently or temporarily bans a member
- **Duration formats:** `7d` (7 days), `1h` (1 hour), `30m` (30 minutes), `1w` (1 week)
- **Examples:**
  - `,ban @spammer Spamming in chat` - Permanent ban
  - `,ban @user 7d Temporary timeout` - 7 day ban
  - `,ban @troll 1h Trolling` - 1 hour ban
- **Features:**
  - Creates case log entry
  - DMs user with reason (if DMs open)
  - Logs to #jail-log channel
  - Temporary bans auto-unban after duration
- **Limitations:**
  - Cannot ban server owner
  - Cannot ban users with higher roles than bot
  - Cannot ban users with higher roles than you

**`,massban @user1 @user2 @user3 [reason]`**
- **Permission Required:** Ban Members
- **What it does:** Ban multiple members at once
- **Max users:** 10 per command
- **Example:** `,massban @raider1 @raider2 @raider3 Raid attack`
- **Use case:** Perfect for handling raids or coordinated attacks
- **Features:**
  - Bans all users simultaneously
  - Creates individual case logs for each
  - Shows progress as it bans
  - Skips users that can't be banned

**`,unban [user ID] [reason]`**
- **Permission Required:** Ban Members
- **What it does:** Removes a ban from a user
- **Example:** `,unban 123456789012345678 Appeal accepted`
- **How to get user ID:**
  1. Enable Developer Mode in Discord settings
  2. Right-click user in ban list
  3. Click "Copy ID"
- **Features:**
  - Creates case log entry
  - Notifies in #jail-log
  - User can rejoin server immediately

---

#### Kick System

**`,kick @user [reason]`** (aliases: `boot`)
- **Permission Required:** Kick Members
- **What it does:** Removes member from server (they can rejoin)
- **Example:** `,kick @user Breaking rules`
- **Difference from ban:** User can rejoin with invite link
- **Features:**
  - Creates case log
  - DMs user with reason
  - Logs to #jail-log
- **Use case:** Warning that's stronger than mute but less severe than ban

**`,masskick @user1 @user2 @user3 [reason]`**
- **Permission Required:** Kick Members
- **What it does:** Kick multiple members at once
- **Max users:** 10 per command
- **Example:** `,masskick @inactive1 @inactive2 Inactivity purge`

---

#### Mute System

**Role-Based Mutes (Custom Roles):**

**`,mute @user [duration] [reason]`** (Text Mute)
- **Permission Required:** Moderate Members
- **What it does:** Prevents user from sending messages using custom role
- **Duration formats:** `1h`, `30m`, `1d`, `1w`
- **Examples:**
  - `,mute @user 1h Spamming` - 1 hour mute
  - `,mute @user Permanent mute` - Indefinite mute
- **How it works:**
  - Adds `Muted` role to user
  - Role denies `Send Messages` in all channels
  - Auto-unmutes after duration (if specified)
- **Features:**
  - Creates case log
  - DMs user with reason and duration
  - Shows remaining time
  - Can be manually unmuted early

**`,unmute @user [reason]`**
- **Permission Required:** Moderate Members
- **What it does:** Removes text mute
- **Example:** `,unmute @user Good behavior`

**`,imagemute @user [duration] [reason]`** (aliases: `imute`)
- **Permission Required:** Moderate Members
- **What it does:** Prevents uploading images/files/attachments
- **Example:** `,imagemute @user 1h Inappropriate images`
- **Use case:** User posting NSFW content, spam images, or inappropriate files
- **How it works:**
  - Adds `Image Muted` role
  - Role denies `Attach Files` and `Embed Links`
  - User can still send text messages

**`,unimagemute @user [reason]`** (aliases: `unimute`)
- **Permission Required:** Moderate Members
- **What it does:** Removes image mute
- **Example:** `,unimagemute @user`

**`,reactionmute @user [duration] [reason]`** (aliases: `rmute`)
- **Permission Required:** Moderate Members
- **What it does:** Prevents adding reactions to messages
- **Example:** `,reactionmute @user 30m Reaction spam`
- **Use case:** User spamming reactions, using reactions inappropriately
- **How it works:**
  - Adds `Reaction Muted` role
  - Role denies `Add Reactions` permission
  - User can still send messages and view reactions

**`,unreactionmute @user [reason]`** (aliases: `unrmute`)
- **Permission Required:** Moderate Members
- **What it does:** Removes reaction mute
- **Example:** `,unreactionmute @user`

---

**Discord Timeout System (Native):**

**`,mute @user [duration] [reason]`** (aliases: `timeout`, `tu`, `shh`)
- **Permission Required:** Moderate Members
- **What it does:** Uses Discord's built-in timeout feature
- **Duration formats:** `1h`, `30m`, `1d`, `1w` (max 28 days)
- **Examples:**
  - `,timeout @user 1h Spamming` - 1 hour timeout
  - `,mute @user 10m Cool down` - 10 minute timeout
- **How it works:**
  - Uses Discord's native timeout system
  - User cannot send messages, react, join voice, or update profile
  - Shows "Timed Out" status in member list
  - Auto-removes after duration
- **Features:**
  - Creates case log
  - DMs user with reason and duration
  - More restrictive than role-based mutes
  - Cannot be bypassed with permissions

**`,unmute @user [reason]`** (aliases: `untimeout`, `uto`)
- **Permission Required:** Moderate Members
- **What it does:** Removes Discord timeout
- **Example:** `,unmute @user Good behavior`

**Channel-Specific Mutes:**

**`,imute @user [reason]`** (aliases: `imgmute`, `imagemute`)
- **Permission Required:** Moderate Members
- **What it does:** Revoke attachment/embed permissions in current channel only
- **Example:** `,imute @user Inappropriate images`
- **How it works:**
  - Modifies channel permissions for specific user
  - Denies `Attach Files` and `Embed Links` in this channel only
  - User can still post images in other channels
- **Use case:** Channel-specific image restrictions

**`,iunmute @user [reason]`** (aliases: `imgunmute`, `imageunmute`)
- **Permission Required:** Moderate Members
- **What it does:** Restore attachment/embed permissions in current channel
- **Example:** `,iunmute @user`

**`,rmute @user [reason]`** (aliases: `reactmute`, `reactionmute`, `emojimute`, `emotemute`, `emute`)
- **Permission Required:** Moderate Members
- **What it does:** Revoke reaction/emote permissions in current channel only
- **Example:** `,rmute @user Reaction spam`
- **How it works:**
  - Modifies channel permissions for specific user
  - Denies `Add Reactions` in this channel only
  - User can still react in other channels
- **Use case:** Channel-specific reaction restrictions

**`,runmute @user [reason]`** (aliases: `runreactionmute`)
- **Permission Required:** Moderate Members
- **What it does:** Restore reaction/emote permissions in current channel
- **Example:** `,runmute @user`

---

#### Jail System

**`,jail @user [reason]`** (aliases: `basement`)
- **Permission Required:** Manage Roles
- **What it does:** Restricts user to #jail channel only
- **Examples:**
  - `,jail @user Needs timeout to cool down`
  - `,jail list` - View all jailed users
- **How it works:**
  - Adds `Jailed` role
  - Role denies access to all channels except #jail
  - User can only see and talk in #jail
- **Use case:** 
  - User needs timeout but not full mute
  - Want to talk to user about behavior
  - Temporary isolation
- **Features:**
  - Creates case log
  - User can see #jail channel
  - Can communicate with mods in #jail
  - No duration limit (manual unjail required)
  - Can list all jailed users with `,jail list`

**`,unjail @user [reason]`**
- **Permission Required:** Manage Roles
- **What it does:** Removes user from jail
- **Example:** `,unjail @user Discussed behavior`

**`,setup`** (aliases: `setme`)
- **Permission Required:** Administrator
- **What it does:** Automatically setup jail role and channel with proper permissions
- **Example:** `,setup`
- **What it creates:**
  - `Jailed` role with restricted permissions
  - `#jail` channel visible only to jailed users
  - `#jail-log` channel for moderation logs
  - Proper permission overrides in all channels
- **Use case:** Quick setup for new servers
- **Note:** This is the recommended way to set up the jail system

---

#### Warning System

**`,warn @user [reason]`**
- **Permission Required:** Moderate Members
- **What it does:** Issues formal warning to user
- **Example:** `,warn @user Please follow the rules`
- **Features:**
  - Creates case log
  - DMs user with warning
  - Warnings are permanent record
  - Can view all warnings later
- **Use case:** Document rule violations without punishment

**`,unwarn @user [case_id] [reason]`**
- **Permission Required:** Manage Messages
- **What it does:** Remove a specific warning from user's history
- **Example:** `,unwarn @user 42 Appeal accepted`
- **Features:**
  - Removes warning from moderation history
  - Creates log entry for removal
  - Requires case ID from history
- **Use case:** Remove warnings after appeal or mistake

**`,warnings @user`**
- **Permission Required:** Moderate Members
- **What it does:** View all warnings for a user
- **Example:** `,warnings @user`
- **Shows:**
  - Warning count
  - Each warning reason
  - Date of each warning
  - Moderator who issued it

**`,clearwarnings @user`**
- **Permission Required:** Moderate Members
- **What it does:** Remove all warnings from user
- **Example:** `,clearwarnings @user`
- **Use case:** Clean slate after good behavior period

---

#### Moderation History

**`,history @user`**
- **Permission Required:** Manage Messages
- **What it does:** View complete moderation history
- **Example:** `,history @user`
- **Shows:**
  - All bans, kicks, mutes, warns, jails
  - Case numbers
  - Dates and times
  - Moderators who issued them
  - Reasons for each action
  - Current active punishments

**`,history view [caseid]`**
- **Permission Required:** Manage Messages
- **What it does:** View specific case details
- **Example:** `,history view 42`
- **Shows:**
  - Case type (ban, kick, mute, etc.)
  - Target user
  - Moderator
  - Reason
  - Date/time
  - Duration (if applicable)
  - Status (active/expired)

**`,history remove [user] [caseid]`**
- **Permission Required:** Manage Messages
- **What it does:** Remove a specific case from user's history
- **Example:** `,history remove @user 42`
- **Use case:** Remove incorrect or appealed cases

**`,history removeall [user]`**
- **Permission Required:** Manage Messages
- **What it does:** Remove all cases from user's history
- **Example:** `,history removeall @user`
- **Use case:** Complete history wipe for clean slate

**`,modhistory [moderator] [action]`** (aliases: `mhistory`, `mh`)
- **Permission Required:** Manage Messages
- **What it does:** View moderation actions performed by specific moderators
- **Examples:**
  - `,modhistory @mod` - View all actions by moderator
  - `,modhistory @mod ban` - View only bans by moderator
- **Shows:**
  - All actions performed by the moderator
  - Case numbers and types
  - Dates and targets
  - Reasons given
- **Use case:** Audit moderator activity and accountability

**`,case [case ID]`**
- **Permission Required:** Moderate Members
- **What it does:** View specific case details (legacy command)
- **Example:** `,case 42`
- **Note:** Use `,history view [caseid]` instead

---

#### Message Management

**`,purge [amount] [@user]`**
- **Permission Required:** Manage Messages
- **What it does:** Bulk delete messages
- **Amount range:** 1-100 messages
- **Examples:**
  - `,purge 50` - Delete last 50 messages
  - `,purge 100 @spammer` - Delete last 100 messages from specific user
- **Features:**
  - Fast bulk deletion
  - Can filter by user
  - Shows deletion count
  - Cannot delete messages older than 14 days (Discord limitation)
- **Use cases:**
  - Clean up spam
  - Remove bot command spam
  - Clear channel after raid

**`,purge bots [amount]`**
- **Permission Required:** Manage Messages
- **What it does:** Delete only bot messages
- **Example:** `,purge bots 50`
- **Use case:** Clean up bot spam while keeping user messages

**`,purge humans [amount]`**
- **Permission Required:** Manage Messages
- **What it does:** Delete only human messages
- **Example:** `,purge humans 50`
- **Use case:** Clean up user messages while keeping bot responses

**`,purge media [amount]`**
- **Permission Required:** Manage Messages
- **What it does:** Delete messages with attachments or embeds
- **Example:** `,purge media 50`
- **Use case:** Remove image spam or media content

**`,purge between [topMsgID] [lastMsgID]`**
- **Permission Required:** Manage Messages
- **What it does:** Delete all messages between two message IDs
- **Example:** `,purge between 123456789 987654321`
- **How to get message IDs:**
  1. Enable Developer Mode in Discord settings
  2. Right-click message
  3. Click "Copy ID"
- **Use case:** Delete specific conversation range

**`,cleanup [amount]`**
- **Permission Required:** Manage Messages
- **What it does:** Delete bot messages and user commands
- **Example:** `,cleanup 50`
- **Use case:** Remove bot command clutter

---

#### Word Filter

**`,filter add [word]`**
- **Permission Required:** Manage Guild
- **What it does:** Add word to auto-delete filter
- **Example:** `,filter add badword`
- **Features:**
  - Auto-deletes messages containing word
  - Case-insensitive matching
  - Warns user in DM
  - Logs to moderation channel

**`,filter remove [word]`**
- **Permission Required:** Manage Guild
- **What it does:** Remove word from filter
- **Example:** `,filter remove badword`

**`,filter list`**
- **Permission Required:** Manage Guild
- **What it does:** View all filtered words
- **Example:** `,filter list`
- **Shows:** Complete list of filtered words

---


## 🔒 Antinuke System - ULTRA DETAILED

The antinuke system is adore's most powerful security feature. It protects your server from malicious moderators, compromised accounts, and coordinated attacks.

### Why You Need Antinuke

**Real Threats:**
- Compromised moderator accounts
- Rogue moderators going on deletion sprees
- Mass ban attacks using Discord's new mass ban feature
- Webhook spam attacks
- Channel/role deletion raids
- Unauthorized bot additions with dangerous permissions

**What Antinuke Does:**
- Monitors all dangerous moderator actions
- Sets thresholds for actions before punishment
- Automatically punishes violators
- Logs all antinuke events
- Protects against both intentional and accidental damage

### Initial Setup

**Step 1: Enable Antinuke (Server Owner Only)**

Only the server owner can initially configure antinuke. This is by design for security.

**Step 2: Grant Antinuke Admin (Optional)**

```
,antinuke admin @user
```
- **⚠️ DANGER:** This user can modify ALL antinuke settings
- **Use case:** Trusted co-owner or head admin
- **They can:**
  - Enable/disable modules
  - Change thresholds
  - Whitelist users
  - View configuration
- **They cannot:**
  - Remove themselves from antinuke
  - Bypass antinuke if not whitelisted

**Step 3: Whitelist Trusted Users**

```
,antinuke whitelist @user
```
- **⚠️ DANGER:** Whitelisted users bypass ALL antinuke checks
- **Use case:** Trusted admins who need to perform mass actions
- **Examples:**
  - Bot accounts that manage roles
  - Admins who do server reorganization
  - Trusted moderators
- **Best practice:** Only whitelist when necessary, remove after

---

### Antinuke Modules

Each module protects against specific threats. All modules follow this pattern:

```
,antinuke [module] <on|off> [--threshold X] [--do punishment]
```

#### Module: Ban Protection

**`,antinuke ban <on|off> [--threshold 1-10] [--do strip|kick|ban]`**

**What it protects:** Mass member bans

**Why it's critical:** Discord's new mass ban feature allows banning 100+ members instantly. A compromised account could destroy your community in seconds.

**How it works:**
- Tracks bans per moderator
- Counts bans within 60-second window
- Triggers when threshold exceeded
- Applies punishment immediately
- Reverts bans if possible

**Configuration examples:**
```
,antinuke ban on --threshold 3 --do ban
```
- Allows 3 bans per minute
- 4th ban triggers punishment
- Violator gets banned
- All their bans are logged

```
,antinuke ban on --threshold 5 --do strip
```
- Allows 5 bans per minute
- 6th ban triggers punishment
- Violator loses all roles/permissions
- Can't do more damage

**Recommended settings:**
- Small servers (< 100 members): `--threshold 2 --do ban`
- Medium servers (100-1000): `--threshold 3 --do ban`
- Large servers (1000+): `--threshold 5 --do strip`

**Real scenario:**
1. Moderator account gets compromised
2. Attacker starts mass banning members
3. After 3 bans, antinuke triggers
4. Attacker gets banned
5. Server owner gets notified
6. Damage limited to 3 bans instead of hundreds

---

#### Module: Kick Protection

**`,antinuke kick <on|off> [--threshold 1-10] [--do strip|kick|ban]`**

**What it protects:** Mass member kicks

**Why it matters:** While less severe than bans, mass kicks still disrupt your community and force members to rejoin.

**How it works:**
- Same as ban protection
- Tracks kicks per moderator
- 60-second rolling window
- Triggers on threshold

**Configuration examples:**
```
,antinuke kick on --threshold 3 --do ban
```

**Recommended settings:**
- Most servers: `--threshold 3 --do ban`
- High-activity mod teams: `--threshold 5 --do strip`

**Use case:** Rogue moderator kicking active members

---

#### Module: Role Protection

**`,antinuke role <on|off> [--threshold 1-10] [--do strip|kick|ban]`**

**What it protects:** Mass role deletions

**Why it's critical:** Roles contain:
- Permissions
- Color hierarchies
- Member assignments
- Bot integrations
- Reaction role setups

Deleting roles destroys server structure and can't be easily undone.

**How it works:**
- Tracks role deletions
- Monitors role permission changes
- Counts within 60-second window
- Triggers on threshold

**Configuration examples:**
```
,antinuke role on --threshold 5 --do kick
```
- Allows 5 role deletions per minute
- 6th deletion triggers kick
- Prevents complete role structure destruction

**Recommended settings:**
- All servers: `--threshold 5 --do kick`
- Servers with many roles: `--threshold 7 --do strip`

**Real scenario:**
1. Moderator decides to "reorganize" roles
2. Starts deleting old roles
3. Gets carried away, deletes important roles
4. After 5 deletions, antinuke kicks them
5. Remaining roles saved

---

#### Module: Channel Protection

**`,antinuke channel <on|off> [--threshold 1-10] [--do strip|kick|ban]`**

**What it protects:** Mass channel creation/deletion

**Why it matters:** Channels contain:
- Message history
- Pins
- Permissions
- Webhooks
- Integrations

**How it works:**
- Tracks both creation AND deletion
- Prevents channel spam attacks
- Prevents mass deletion
- 60-second window

**Configuration examples:**
```
,antinuke channel on --threshold 5 --do kick
```

**Attack scenarios it prevents:**
1. **Spam attack:** Creating 50+ channels to flood server
2. **Deletion attack:** Deleting all channels
3. **Reorganization gone wrong:** Accidental mass deletion

**Recommended settings:**
- Small servers: `--threshold 3 --do ban`
- Medium servers: `--threshold 5 --do kick`
- Large servers: `--threshold 7 --do strip`

---

#### Module: Webhook Protection

**`,antinuke webhook <on|off> [--threshold 1-10] [--do strip|kick|ban]`**

**What it protects:** Mass webhook creation

**Why it's critical:** Webhooks can:
- Spam messages
- Impersonate users
- Bypass rate limits
- Send malicious links
- Ping @everyone repeatedly

**How it works:**
- Tracks webhook creation
- Monitors per moderator
- Triggers on threshold
- Deletes created webhooks

**Configuration examples:**
```
,antinuke webhook on --threshold 3 --do ban
```
- Allows 3 webhook creations
- 4th triggers ban
- All webhooks deleted

**Attack scenario:**
1. Compromised account creates 20 webhooks
2. Each webhook spams @everyone
3. After 3 webhooks, antinuke triggers
4. Attacker banned, webhooks deleted
5. Spam limited to 3 webhooks instead of 20

**Recommended settings:**
- All servers: `--threshold 3 --do ban`
- Servers with webhook integrations: `--threshold 5 --do strip`

---

#### Module: Bot Add Protection

**`,antinuke botadd <on|off> [--do strip|kick|ban]`**

**What it protects:** Unauthorized bot additions

**Why it's critical:** Malicious bots can:
- Mass DM members
- Scrape user data
- Spam channels
- Create webhooks
- Modify roles
- Delete channels

**How it works:**
- Monitors all bot additions
- Checks if bot adder is whitelisted
- NO THRESHOLD (any bot add triggers it)
- Immediately kicks bot
- Punishes bot adder

**Configuration examples:**
```
,antinuke botadd on --do ban
```
- Any bot addition triggers
- Bot gets kicked immediately
- Bot adder gets banned

**Important notes:**
- Whitelist users who manage bots
- No threshold because even 1 malicious bot is dangerous
- Bot is always kicked, punishment applies to adder

**Real scenario:**
1. Moderator account compromised
2. Attacker adds malicious bot
3. Antinuke immediately kicks bot
4. Attacker gets banned
5. No damage done

**Recommended settings:**
- All servers: `--do ban`
- Servers with frequent bot testing: Whitelist bot managers

---

#### Module: Permission Protection

**`,antinuke permissions <on|off> [--do strip|kick|ban]`**

**What it protects:** Dangerous permission grants

**Monitored permissions:**
1. **Administrator** - Full server control
2. **Ban Members** - Can ban anyone
3. **Kick Members** - Can kick anyone
4. **Moderate Members** - Can timeout anyone
5. **Mention Everyone** - Can ping @everyone
6. **Manage Guild** - Can change server settings
7. **Manage Channels** - Can delete channels
8. **Manage Roles** - Can modify permissions
9. **Manage Webhooks** - Can create webhooks

**How it works:**
- Monitors role permission changes
- Detects when dangerous permissions added
- NO THRESHOLD (any grant triggers it)
- Reverts permission change
- Punishes moderator

**Configuration examples:**
```
,antinuke permissions on --do strip
```
- Any dangerous permission grant triggers
- Permission change reverted
- Moderator loses all roles

**Why no threshold:** Even ONE Administrator grant to wrong person can destroy server.

**Attack scenario:**
1. Moderator creates new role
2. Gives it Administrator permission
3. Assigns role to alt account
4. Antinuke detects Administrator grant
5. Reverts permission
6. Moderator stripped of roles
7. Alt account doesn't get dangerous permissions

**Recommended settings:**
- All servers: `--do strip`
- High-security servers: `--do ban`

---

### Punishment Types Explained

**Strip (Remove Roles)**
- Removes ALL roles from violator
- Leaves them as basic member
- Can't do any more damage
- Can be manually restored later
- **Use when:** Want to stop them but investigate first

**Kick**
- Removes from server
- Can rejoin with invite
- Loses all roles
- **Use when:** Want them gone but not permanently

**Ban**
- Permanently removes from server
- Cannot rejoin
- Most severe punishment
- **Use when:** Clear malicious intent or compromised account

---

### Antinuke Management Commands

**`,antinuke config`**
- View complete antinuke configuration
- Shows all module states
- Shows thresholds
- Shows punishments
- Shows whitelisted users
- Shows antinuke admins

**`,antinuke list`**
- Quick overview of enabled modules
- Shows whitelisted users
- Shows recent antinuke triggers

**`,antinuke admins`**
- View all users with antinuke admin permissions
- Shows when they were granted access
- Shows who granted them access

---

### Best Practices

**1. Start Conservative**
- Begin with low thresholds (2-3)
- Use `strip` punishment initially
- Monitor for false positives
- Adjust based on server activity

**2. Whitelist Carefully**
- Only whitelist when absolutely necessary
- Remove whitelist after mass actions complete
- Never whitelist unknown users
- Regularly audit whitelist

**3. Multiple Layers**
- Enable ALL modules
- Use varying thresholds
- Combine with Discord's built-in security
- Regular permission audits

**4. Communication**
- Tell moderators about antinuke
- Explain thresholds
- Provide whitelist request process
- Document in mod guidelines

**5. Regular Testing**
- Test antinuke in test server first
- Verify thresholds work for your activity
- Ensure punishments are appropriate
- Check logs regularly

---

### Common Antinuke Scenarios

**Scenario 1: Server Reorganization**
```
Problem: Admin needs to delete 10 old roles
Solution: 
1. ,antinuke whitelist @admin
2. Admin deletes roles
3. ,antinuke whitelist @admin (remove whitelist)
```

**Scenario 2: Compromised Moderator**
```
What happens:
1. Moderator account hacked
2. Attacker starts mass banning
3. After 3 bans, antinuke triggers
4. Attacker banned
5. Owner notified
6. Damage: 3 bans instead of 100+
```

**Scenario 3: Rogue Moderator**
```
What happens:
1. Moderator goes rogue
2. Starts deleting channels
3. After 5 deletions, antinuke triggers
4. Moderator kicked
5. Remaining channels saved
6. Owner can restore deleted channels
```

**Scenario 4: Bot Integration**
```
Problem: Need to add management bot
Solution:
1. ,antinuke whitelist @trusted_admin
2. Trusted admin adds bot
3. Bot functions normally
4. Remove whitelist when done
```

---

### Antinuke Logs

Every antinuke trigger creates detailed logs:

**Log includes:**
- Timestamp
- Violator
- Action type (ban, kick, role delete, etc.)
- Count (how many actions)
- Threshold
- Punishment applied
- Module that triggered
- All affected users/roles/channels

**Where logs go:**
- #jail-log channel
- Antinuke log file
- Owner DM (optional)

---


## 🎨 Customization System

adore allows complete per-server customization of the bot's appearance.

### Bot Appearance (Server Owner Only)

**Why Server Owner Only?**
- Prevents abuse
- Ensures accountability
- Protects against inappropriate content
- Maintains bot integrity

**⚠️ IMPORTANT WARNING:**
All customizations are actively monitored and logged. Uploading inappropriate content (NSFW, offensive, illegal) will result in:
- Immediate bot removal from your server
- Permanent ban from using adore
- Report to Discord Trust & Safety
- No appeals

---

#### Custom Avatar

**`,customize avatar [image URL]`** (aliases: `custom avatar`)

**What it does:** Sets a custom avatar for adore in your server only

**How to use:**
1. **With URL:**
   ```
   ,customize avatar https://example.com/avatar.png
   ```

2. **With attachment:**
   - Attach image to message
   - Type `,customize avatar` in message
   - Bot uses attached image

3. **Reset to global:**
   ```
   ,customize avatar
   ```
   (No URL or attachment)

**Supported formats:**
- PNG (recommended)
- JPG/JPEG
- GIF (animated avatars supported!)
- WebP

**Requirements:**
- Image must be accessible URL or attachment
- Max file size: 8MB
- Recommended size: 512x512 or 1024x1024
- Square images work best

**Cooldown:** 5 minutes between avatar changes

**Examples:**
```
,customize avatar https://i.imgur.com/example.png
,customize avatar (with image attached)
,customize avatar (reset to default)
```

**Use cases:**
- Match server theme
- Seasonal avatars (Halloween, Christmas)
- Event-specific avatars
- Brand consistency

---

#### Custom Banner

**`,customize banner [image URL]`** (aliases: `custom banner`)

**What it does:** Sets a custom banner for adore's profile in your server

**How to use:**
1. **With URL:**
   ```
   ,customize banner https://example.com/banner.png
   ```

2. **With attachment:**
   - Attach image to message
   - Type `,customize banner` in message

3. **Reset to global:**
   ```
   ,customize banner
   ```

**Supported formats:**
- PNG (recommended)
- JPG/JPEG
- GIF (animated banners!)
- WebP

**Requirements:**
- Recommended size: 600x240 (5:2 aspect ratio)
- Max file size: 8MB
- Wide images work best

**Cooldown:** 5 minutes between banner changes

**Use cases:**
- Server branding
- Event announcements
- Seasonal themes
- Promotional banners

---

#### Custom Bio

**`,customize bio [text]`** (aliases: `custom bio`)

**What it does:** Sets a custom "About Me" bio for adore in your server

**How to use:**
1. **Set bio:**
   ```
   ,customize bio Best bot for this server!
   ```

2. **Reset to global:**
   ```
   ,customize bio
   ```

**Requirements:**
- Maximum 190 characters
- No inappropriate content
- Can include emojis
- Can include line breaks (Shift+Enter)

**Cooldown:** 5 minutes between bio changes

**Examples:**
```
,customize bio Official bot of [Server Name]
,customize bio Moderation • Utility • Fun | ,help for commands
,customize bio 🎮 Gaming Server Bot | 24/7 Online
```

**Use cases:**
- Server information
- Command prefix reminder
- Bot purpose description
- Server branding

---

### Prefix Management

#### Server Prefix

**`,prefix`**
- View current server prefix
- Shows default if not customized
- Example output: `Server prefix: ,`

**`,prefix set [symbol]`** (Administrator)
- Change server prefix
- Max 3 characters
- No spaces allowed
- Examples:
  ```
  ,prefix set !
  ,prefix set ?
  ,prefix set v.
  ```

**`,prefix remove`** (Administrator, aliases: `prefix reset`, `prefix default`)
- Reset to default prefix (`,`)
- Example: `,prefix remove`

**Prefix rules:**
- Maximum 3 characters
- Cannot contain spaces
- Cannot be only numbers
- Cannot be Discord markdown characters alone (*, _, ~, etc.)
- Case-sensitive

**Best practices:**
- Choose unique prefix to avoid conflicts
- Avoid common prefixes (!, ?, .)
- Document prefix in server rules
- Consider prefix that matches server theme

---

#### Personal Prefix (Premium Feature)

**`,selfprefix`**
- View your current personal prefix
- Shows "none" if not set
- Example output: `Your self prefix: !`

**`,selfprefix set [prefix]`** (Premium)
- Set personal prefix that works alongside server prefix
- Max 3 characters
- No spaces allowed
- Examples:
  ```
  ,selfprefix set !
  ,selfprefix set v!
  ```

**`,selfprefix remove`** (Premium, aliases: `selfprefix clear`)
- Remove your personal prefix
- Example: `,selfprefix remove`

**How it works:**
- Personal prefix works in addition to server prefix
- Only you can use your personal prefix
- Other members still use server prefix
- Works across all servers with adore

**Use cases:**
- Prefer different prefix than server
- Faster command access
- Personal preference
- Muscle memory from other bots

---

## 📝 Embed System - COMPLETE GUIDE

adore's embed system is one of its most powerful features. Create rich, beautiful embeds with full variable support.

### What Are Embeds?

Embeds are rich message formats that display information in a structured, visually appealing way. They can include:
- Colored side bars
- Titles and descriptions
- Images and thumbnails
- Multiple fields
- Author and footer sections
- Timestamps
- Clickable buttons

### Basic Syntax

**Structure:**
```
{embed}$v{parameter: value}$v{parameter: value}
```

**Components:**
- `{embed}` - Starts embed code (required)
- `$v` - Separates parameters (required between each)
- `{parameter: value}` - Each embed element
- `:` - Separates parameter name from value
- `&&` - Separates sub-parameters (for author, footer, fields, buttons)

**Simple example:**
```
{embed}$v{title: Hello}$v{description: World}$v{color: #5865F2}
```

---

### Embed Parameters - DETAILED

#### Title

**Syntax:** `{title: Your Title Here}`

**What it does:** Sets the main heading of the embed

**Character limit:** 256 characters

**Examples:**
```
{title: Welcome to the Server!}
{title: 🎉 Giveaway Time!}
{title: Server Rules}
```

**Tips:**
- Keep concise and clear
- Use emojis for visual appeal
- Make it descriptive
- Can be combined with URL to make clickable

---

#### Description

**Syntax:** `{description: Your text here}`

**What it does:** Sets the main body text of the embed

**Character limit:** 4096 characters

**Formatting:**
- `**bold**` - Bold text
- `*italic*` - Italic text
- `__underline__` - Underlined text
- `~~strikethrough~~` - Strikethrough text
- `\n` - New line (or Shift+Enter)
- `[text](url)` - Hyperlinks

**Examples:**
```
{description: Welcome to our server!}
{description: **Bold** and *italic* text}
{description: Line 1\nLine 2\nLine 3}
{description: Check out [our website](https://example.com)}
```

**Tips:**
- Use line breaks for readability
- Bold important information
- Keep paragraphs short
- Use emojis for visual breaks

---

#### Color

**Syntax:** `{color: #HEXCODE}`

**What it does:** Sets the colored bar on the left side of embed

**Format:** Hex color codes (6 characters)

**Examples:**
```
{color: #5865F2}  - Discord Blurple
{color: #57F287}  - Green
{color: #ED4245}  - Red
{color: #FEE75C}  - Yellow
{color: #EB459E}  - Pink
{color: #000000}  - Black
{color: #FFFFFF}  - White
```

**Color meanings:**
- Blue (#5865F2) - Information, general
- Green (#57F287) - Success, positive
- Red (#ED4245) - Error, warning, danger
- Yellow (#FEE75C) - Caution, attention
- Purple (#9B59B6) - Special, premium
- Orange (#E67E22) - Moderate warning

**Tips:**
- Match server theme colors
- Use consistent colors for message types
- Consider color psychology
- Test colors in dark and light mode

---

#### URL

**Syntax:** `{url: https://example.com}`

**What it does:** Makes the title clickable

**Requirements:**
- Must be valid URL
- Must start with http:// or https://
- Title must be set

**Examples:**
```
{title: Visit Our Website}$v{url: https://example.com}
{title: Join Support Server}$v{url: https://discord.gg/invite}
```

**Use cases:**
- Link to website
- Link to Discord invite
- Link to documentation
- Link to social media

---

#### Image

**Syntax:** `{image: https://image-url.com/image.png}`

**What it does:** Adds large image at bottom of embed

**Requirements:**
- Must be valid image URL
- Must start with http:// or https://
- Supported formats: PNG, JPG, GIF, WebP

**Examples:**
```
{image: https://i.imgur.com/example.png}
{image: {server.banner}}
{image: {user.avatar}}
```

**Tips:**
- Use high-quality images
- Recommended width: 400-600px
- Images auto-resize to fit
- GIFs work (animated)
- Can use variables for dynamic images

---

#### Thumbnail

**Syntax:** `{thumbnail: https://image-url.com/icon.png}`

**What it does:** Adds small image in top-right corner

**Requirements:**
- Must be valid image URL
- Must start with http:// or https://
- Supported formats: PNG, JPG, GIF, WebP

**Examples:**
```
{thumbnail: https://i.imgur.com/icon.png}
{thumbnail: {user.avatar}}
{thumbnail: {server.icon}}
```

**Tips:**
- Best for icons/logos
- Recommended size: 80x80 to 200x200
- Square images work best
- Use for branding
- Can combine with large image

---

#### Timestamp

**Syntax:** `{timestamp}`

**What it does:** Adds current date/time at bottom of embed

**No parameters needed** - automatically uses current time

**Display:** Shows in user's local timezone

**Example:**
```
{timestamp}
```

**Use cases:**
- Show when message was sent
- Log timestamps
- Event times
- Automatic dating

---

#### Author Section

**Syntax:** `{author: name && iconURL && url}`

**Parameters:**
1. **name** (required) - Author name
2. **iconURL** (optional) - Small icon next to name
3. **url** (optional) - Makes name clickable

**Examples:**
```
{author: {user.name}}
{author: {user.name} && {user.avatar}}
{author: {server.name} && {server.icon}}
{author: adore Bot && https://bot-icon.png && https://website.com}
```

**Character limits:**
- Name: 256 characters
- URL: Must be valid URL

**Use cases:**
- Show who triggered action
- Server branding
- User identification
- Attribution

---

#### Footer Section

**Syntax:** `{footer: text && iconURL}`

**Parameters:**
1. **text** (required) - Footer text
2. **iconURL** (optional) - Small icon next to text

**Examples:**
```
{footer: Requested by {user.name}}
{footer: {server.name} && {server.icon}}
{footer: Page 1 of 5}
{footer: adore Bot && https://icon.png}
```

**Character limits:**
- Text: 2048 characters
- URL: Must be valid URL

**Use cases:**
- Attribution
- Page numbers
- Additional info
- Branding

---

#### Fields

**Syntax:** `{field: name && value && inline}`

**Parameters:**
1. **name** (required) - Field title
2. **value** (required) - Field content
3. **inline** (optional) - Add to make field display side-by-side

**Character limits:**
- Name: 256 characters
- Value: 1024 characters
- Max fields: 25 per embed

**Examples:**
```
{field: Member Count && {server.membercount}}
{field: Members && {server.membercount} && inline}
{field: Boosts && {server.boost_count} && inline}
{field: Owner && {server.owner} && inline}
```

**Inline behavior:**
- Up to 3 fields per row
- Fields wrap to new row automatically
- Mix inline and non-inline fields
- Non-inline fields take full width

**Use cases:**
- Organized information
- Stats display
- User info
- Server info
- Lists

---

#### Buttons

**Syntax:** `{button: type && label && url/emoji && state}`

**Parameters:**
1. **type** (required) - Button style
2. **label** (required) - Button text
3. **url/emoji** (required) - URL for Link buttons, emoji for others
4. **state** (required) - enabled or disabled

**Button types:**
- `Link` - Opens URL (requires https:// URL)
- `Blurple` - Discord blue color
- `Green` - Green button
- `Red` - Red button
- `Grey` - Gray button

**Examples:**
```
{button: Link && Visit Website && https://example.com && enabled}
{button: Green && Accept && ✅ && enabled}
{button: Red && Decline && ❌ && enabled}
{button: Blurple && Click Me && 🎉 && enabled}
{button: Grey && Unavailable && ⏸️ && disabled}
```

**Multiple buttons:**
```
{button: Link && Rules && https://rules.com && enabled}$v{button: Link && Support && https://support.com && enabled}$v{button: Green && Join && 🎉 && enabled}
```

**Limits:**
- Max 5 buttons per row
- Max 5 rows (25 buttons total)
- Label: 80 characters max

**Use cases:**
- Links to resources
- Call-to-action
- Navigation
- Quick actions

---


#### Content (Text Outside Embed)

**Syntax:** `{content: Text here}`

**What it does:** Adds regular text message above the embed

**Examples:**
```
{content: @everyone New announcement!}$v{embed}$v{title: Important}
{content: {user.mention} Welcome!}$v{embed}$v{title: Welcome}
```

**Use cases:**
- Ping roles/users
- Additional context
- Separate message from embed
- Announcements

---

### Complete Embed Examples

#### Example 1: Simple Welcome
```
{embed}$v{title: Welcome!}$v{description: Thanks for joining {server.name}!}$v{color: #5865F2}$v{thumbnail: {user.avatar}}$v{timestamp}
```

#### Example 2: Advanced Welcome
```
{embed}$v{author: {server.name} && {server.icon}}$v{title: Welcome to the server!}$v{description: Hey {user.mention}! 👋\n\nThanks for joining **{server.name}**!\nYou are our **{server.humanmembercount}** member!}$v{thumbnail: {user.avatar}}$v{field: Account Created && {user.created_at} && inline}$v{field: Joined Server && {user.joined_at} && inline}$v{image: {server.banner}}$v{footer: Welcome! && {server.icon}}$v{timestamp}$v{color: #5865F2}$v{button: Link && Read Rules && https://example.com/rules && enabled}$v{button: Green && Get Started && 🚀 && enabled}
```

#### Example 3: Server Info
```
{embed}$v{title: {server.name} Information}$v{description: Everything about this server}$v{thumbnail: {server.icon}}$v{field: 👥 Members && {server.membercount} && inline}$v{field: 💎 Boosts && {server.boost_count} && inline}$v{field: 📊 Boost Tier && {server.boost_tier} && inline}$v{field: 👑 Owner && {server.owner} && inline}$v{field: 📅 Created && {server.created_at} && inline}$v{field: 🎭 Roles && {server.role_count} && inline}$v{image: {server.banner}}$v{color: #5865F2}$v{timestamp}
```

#### Example 4: Announcement
```
{content: @everyone}$v{embed}$v{title: 🎉 Important Announcement}$v{description: We're excited to announce a major server update!\n\n**What's New:**\n• New channels\n• Updated rules\n• New roles\n• Events coming soon}$v{color: #57F287}$v{thumbnail: {server.icon}}$v{footer: Posted by {user.name}}$v{timestamp}$v{button: Link && Learn More && https://example.com && enabled}
```

#### Example 5: Rules
```
{embed}$v{title: 📜 Server Rules}$v{description: Please read and follow all rules}$v{field: 1️⃣ Be Respectful && Treat everyone with respect}$v{field: 2️⃣ No Spam && Don't spam messages or mentions}$v{field: 3️⃣ No NSFW && Keep content appropriate}$v{field: 4️⃣ Follow Discord TOS && Respect Discord's Terms of Service}$v{field: 5️⃣ Listen to Staff && Follow moderator instructions}$v{color: #ED4245}$v{footer: Last updated}$v{timestamp}
```

---

# Command Variables and Flags Documentation

This document provides a comprehensive guide to all variables and command flags used in the Discord bot.

---

## Table of Contents
- [Message Variables](#message-variables)
- [Command Flags](#command-flags)
- [Autoresponder Options](#autoresponder-options)
- [Antinuke Flags](#antinuke-flags)

---

## Message Variables

Variables can be used in custom messages for welcome, leave, boost, and level-up messages. They are replaced with actual values when the message is sent.

### User Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `{user.id}` | User's Discord ID | `123456789012345678` |
| `{user.name}` | User's username | `vwsn` |
| `{user.display_name}` | User's display name in the server | `VWSN` |
| `{user.mention}` | Mentions the user | `@vwsn` |
| `{user.tag}` | User's full tag (username#discriminator) | `vwsn#1234` |

### Server Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `{server.name}` | Server's name | `My Discord Server` |
| `{server.membercount}` | Total member count | `1,234` |
| `{server.humanmembercount}` | Member count with ordinal suffix | `1,234th` |
| `{server.boostcount}` | Number of server boosts | `15` |
| `{server.boostlevel}` | Server boost level (0-3) | `2` |

### Level Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `{level.new_rank}` | User's new level (required in level messages) | `25` |

### Usage Examples

**Welcome Message:**
```
Welcome {user.mention} to {server.name}! You are member #{server.humanmembercount}!
```

**Boost Message:**
```
Thanks for boosting {user.mention}! We now have {server.boostcount} boosts!
```

**Level Up Message:**
```
Congrats {user.mention}! You've reached level {level.new_rank}!
```

**Leave Message:**
```
Goodbye {user.name}! We now have {server.membercount} members.
```

---

## Command Flags

Flags are optional parameters that modify command behavior. They are prefixed with `--`.

### Antinuke Flags

#### `--threshold <number>`

Sets the action limit before triggering antinuke protection.

- **Valid Range:** 1-10
- **Default:** Varies by module
- **Used In:** role, kick, ban, channel, webhook modules

**Examples:**
```
,antinuke role on --threshold 5
,antinuke kick on --threshold 3
,antinuke channel on --threshold 7
```

#### `--do <action>`

Specifies the punishment action when antinuke is triggered.

- **Valid Options:** `strip`, `kick`, `ban`
  - `strip` - Remove dangerous permissions from the user
  - `kick` - Kick the user from the server
  - `ban` - Ban the user from the server
- **Default:** `strip`
- **Used In:** All antinuke modules

**Examples:**
```
,antinuke role on --do ban
,antinuke webhook on --threshold 3 --do kick
,antinuke permissions on --do strip
,antinuke botadd on --do ban
```

**Combined Usage:**
```
,antinuke ban on --threshold 5 --do kick
,antinuke channel on --threshold 3 --do ban
```

---

## Autoresponder Options

Autoresponder options modify how the bot responds to triggers. They are added at the end of the response message.

### `--reply`

Makes the bot reply to the user's message instead of sending a standalone message.

**Example:**
```
,autoresponder add hello, Hi there! --reply
```

### `--strict`

Requires exact match of the trigger word (default behavior).

**Example:**
```
,autoresponder add hello, Hi there! --strict
```

### `--not_strict`

Allows partial matches of the trigger word anywhere in the message.

**Example:**
```
,autoresponder add hello, Hi there! --not_strict
```

### `--delete`

Deletes the user's original message after triggering the autoresponder.

**Example:**
```
,autoresponder add badword, Please don't use that word! --delete
```

### `--self_destruct <seconds>`

Automatically deletes the bot's response after the specified number of seconds.

- **Default:** 5 seconds (if no number specified)
- **Valid Range:** Any positive number

**Examples:**
```
,autoresponder add temp, This message will disappear! --self_destruct 10
,autoresponder add quick, Gone in 5 seconds! --self_destruct
```

### Combining Options

You can combine multiple options in a single autoresponder:

**Examples:**
```
,autoresponder add hello, Hi there! --reply --not_strict
,autoresponder add spam, Stop spamming! --delete --self_destruct 5
,autoresponder add test, Testing! --reply --strict --self_destruct 10
```

---

## Complete Command Examples

### Antinuke Commands

**Enable role protection with custom settings:**
```
,antinuke role on --threshold 5 --do kick
```

**Enable ban protection with strict punishment:**
```
,antinuke ban on --threshold 3 --do ban
```

**Enable webhook protection:**
```
,antinuke webhook on --threshold 2 --do ban
```

**Enable bot addition protection:**
```
,antinuke botadd on --do ban
```

**Enable permission monitoring:**
```
,antinuke permissions on --do kick
```

### Autoresponder Commands

**Basic autoresponder:**
```
,autoresponder add hello, Hi there!
```

**Reply to user:**
```
,autoresponder add help, Check out our help channel! --reply
```

**Partial match with reply:**
```
,autoresponder add thanks, You're welcome! --not_strict --reply
```

**Delete trigger message:**
```
,autoresponder add badword, Please watch your language! --delete
```

**Self-destructing message:**
```
,autoresponder add secret, This is a secret message! --self_destruct 10
```

**Complex autoresponder:**
```
,autoresponder add rules, Please read #rules! --reply --self_destruct 15
```

### Message Commands with Variables

**Welcome message:**
```
,welcome add #general Welcome {user.mention} to {server.name}! You're our {server.humanmembercount} member!
```

**Boost message:**
```
,boost add #boosts Thank you {user.mention} for boosting! We now have {server.boostcount} boosts and are level {server.boostlevel}!
```

**Leave message:**
```
,leave add #general Goodbye {user.name}! We now have {server.membercount} members.
```

**Level up message:**
```
,levels message Congrats {user.mention}! You've reached level {level.new_rank} in {server.name}!
```

---

## Notes

- All flags are **optional** unless specified otherwise
- Flags can be combined in any order
- Variable names are **case-sensitive** and must be wrapped in curly braces `{}`
- The `{level.new_rank}` variable is **required** in custom level up messages
- Threshold values must be between 1 and 10 for antinuke modules
- Autoresponder triggers are limited to 12 characters maximum
- Maximum of 5 welcome/boost/leave messages per server
- Maximum of 50 autoresponders per server

---

## Quick Reference

### Most Common Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--threshold <1-10>` | Set action limit | `--threshold 5` |
| `--do <strip\|kick\|ban>` | Set punishment | `--do ban` |
| `--reply` | Reply to message | `--reply` |
| `--delete` | Delete trigger | `--delete` |
| `--self_destruct <seconds>` | Auto-delete response | `--self_destruct 10` |
| `--strict` | Exact match only | `--strict` |
| `--not_strict` | Partial match | `--not_strict` |

### Most Common Variables

| Variable | Use Case |
|----------|----------|
| `{user.mention}` | Mention the user |
| `{user.name}` | Show username |
| `{server.name}` | Show server name |
| `{server.membercount}` | Show member count |
| `{level.new_rank}` | Show new level (level messages only) |


nage Roles permission
3. Ensure bot role is above mute roles
4. Verify channel permissions are set correctly
5. Don't rename the Jailed role

### "Embed variables not working"
**Solution:**
1. Check spelling: `{user.mention}` not `{user.ping}`
2. Some variables may be empty (e.g., `{server.banner}` if no banner)
3. Use proper syntax: `$v` between parameters
4. Ensure URLs are valid for images
5. Test with `,createembed` command

### "Custom avatar/banner not showing"
**Solution:**
1. Only server owner can customize
2. Wait 5 minutes between changes (cooldown)
3. Ensure image URL is valid and accessible
4. Check image format (PNG, JPG, GIF, WebP)
5. Max file size: 8MB
6. Try with attachment instead of URL

### "Welcome messages not sending"
**Solution:**
1. Check bot has Send Messages permission in channel
2. Verify bot has Embed Links permission
3. Test embed syntax with `,createembed`
4. Check channel isn't deleted
5. Verify welcome message is added: `,welcome list`

### "Reaction roles not working"
**Solution:**
1. Bot needs Add Reactions permission
2. Bot needs Manage Roles permission
3. Bot role must be higher than assigned role
4. Use message link, not message ID
5. Ensure emoji is accessible (not from another server)

### "Antinuke punishing legitimate actions"
**Solution:**
1. Whitelist trusted users: `,antinuke whitelist @user`
2. Increase thresholds: `--threshold X`
3. Use less severe punishment: `--do strip` instead of `--do ban`
4. Remove whitelist after mass actions complete
5. Adjust thresholds based on server activity

---

## 🎵 Music & Integration System

adore includes Last.fm and Spotify integration for music tracking and playback control.

### Last.fm Integration

**`,fm [user]`** (aliases: `np`)
- **Permission Required:** None
- **What it does:** Shows current or last played track from Last.fm
- **Examples:**
  - `,fm` - Show your current track
  - `,fm @user` - Show another user's current track
- **Features:**
  - Shows track name, artist, album
  - Shows album artwork
  - Shows play count and loved status
  - Links to Last.fm profile
- **Setup:** Link your Last.fm account first (see bot setup)
- **Use case:** Share what you're listening to

---

### Spotify Integration

**`,spotify`** (aliases: `sp`)
- **Permission Required:** None
- **What it does:** Main Spotify command hub
- **Example:** `,spotify`
- **Shows:** Current playback status and available subcommands

**`,spotify link`**
- **What it does:** Link your Spotify account to control playback
- **Example:** `,spotify link`
- **How it works:**
  1. Click the authorization link
  2. Log in to Spotify
  3. Authorize the bot
  4. Account is linked
- **Required:** Spotify Premium account
- **Use case:** Control Spotify from Discord

**`,spotify unlink`**
- **What it does:** Unlink your Spotify account
- **Example:** `,spotify unlink`
- **Use case:** Remove bot access to your Spotify

---

#### Playback Control

**`,spotify play [track link|search query|@user]`**
- **What it does:** Play a track, search for music, or play what another user is listening to
- **Examples:**
  - `,spotify play https://open.spotify.com/track/...` - Play specific track
  - `,spotify play never gonna give you up` - Search and play
  - `,spotify play @user` - Play what they're listening to
- **Features:**
  - Direct Spotify link support
  - Smart search with results
  - Copy other users' music
- **Requires:** Linked Spotify Premium account

**`,spotify pause`**
- **What it does:** Pause current playback
- **Example:** `,spotify pause`

**`,spotify skip`**
- **What it does:** Skip to next track
- **Example:** `,spotify skip`

**`,spotify previous`**
- **What it does:** Go back to previous track
- **Example:** `,spotify previous`

**`,spotify volume [0-100]`**
- **What it does:** Set playback volume
- **Example:** `,spotify volume 50`
- **Range:** 0-100

**`,spotify repeat [mode]`**
- **What it does:** Set repeat mode
- **Modes:** `track`, `context`, `off`
- **Examples:**
  - `,spotify repeat track` - Repeat current track
  - `,spotify repeat context` - Repeat playlist/album
  - `,spotify repeat off` - No repeat

**`,spotify shuffle [state]`**
- **What it does:** Toggle shuffle mode
- **States:** `on`, `off`
- **Example:** `,spotify shuffle on`

**`,spotify queue [track link|search query]`**
- **What it does:** Add track to your queue
- **Examples:**
  - `,spotify queue https://open.spotify.com/track/...`
  - `,spotify queue bohemian rhapsody`

---

#### Discovery & Stats

**`,spotify search [search query|@user]`**
- **What it does:** Search for tracks and get Spotify links
- **Examples:**
  - `,spotify search never gonna give you up`
  - `,spotify search @user` - Search what they're listening to
- **Use case:** Find Spotify links without playing

**`,spotify recents`**
- **What it does:** View your recently played tracks
- **Example:** `,spotify recents`
- **Shows:** Last 10 tracks with timestamps

**`,spotify toptracks [short|medium|long]`**
- **What it does:** View your top tracks
- **Time ranges:**
  - `short` - Last 4 weeks
  - `medium` - Last 6 months
  - `long` - All time
- **Example:** `,spotify toptracks long`
- **Shows:** Your most played tracks

**`,spotify topartists [short|medium|long]`**
- **What it does:** View your top artists
- **Time ranges:**
  - `short` - Last 4 weeks
  - `medium` - Last 6 months
  - `long` - All time
- **Example:** `,spotify topartists medium`
- **Shows:** Your most listened artists

---

### Music System Tips

1. **Spotify Premium Required** - Free accounts cannot use playback control
2. **Link Once** - Account stays linked until you unlink
3. **Privacy** - Only you can control your playback
4. **Share Music** - Use `,spotify play @user` to discover new music
5. **Queue Management** - Add multiple tracks to queue for continuous play

---

## 🛡️ Anti-Bully System (No Self React)

The NSR (No Self React) system prevents members from reacting to their own messages, reducing attention-seeking behavior.

### What is NSR?

**Purpose:** Prevents users from adding reactions to their own messages
**Use case:** Reduce self-promotion, attention-seeking, or reaction farming
**How it works:** Bot automatically removes reactions users add to their own messages

---

### NSR Commands

**`,nsr`** (aliases: `noselfreact`)
- **Permission Required:** Manage Guild
- **What it does:** View NSR system status
- **Example:** `,nsr`
- **Shows:**
  - System status (enabled/disabled)
  - Bypassed users
  - Configuration

**`,nsr on`**
- **Permission Required:** Manage Guild
- **What it does:** Enable no self-react system
- **Example:** `,nsr on`
- **Effect:** Users cannot react to their own messages
- **Note:** Bypassed users are exempt

**`,nsr off`**
- **Permission Required:** Manage Guild
- **What it does:** Disable no self-react system
- **Example:** `,nsr off`
- **Effect:** Users can react to their own messages again

**`,nsr bypass [user]`**
- **Permission Required:** Manage Guild
- **What it does:** Toggle bypass for a specific user
- **Example:** `,nsr bypass @user`
- **Effect:** User can react to their own messages even when NSR is enabled
- **Use case:** Allow trusted users or bots to self-react

---

### NSR Best Practices

1. **Announce the rule** - Tell members about NSR before enabling
2. **Bypass bots** - Some bots need to self-react for functionality
3. **Bypass staff** - Consider bypassing moderators for announcements
4. **Monitor reactions** - Check if system is working as intended
5. **Explain purpose** - Help members understand why NSR exists

**Common bypass candidates:**
- Bots that use reactions for menus
- Moderators making announcements
- Event organizers
- Server owner

---

## 🤖 Core Bot Commands

Essential commands for bot information and configuration.

---

### Bot Information

**`,help [command]`** (aliases: `h`, `command`)
- **Permission Required:** None
- **What it does:** View extended help for commands
- **Examples:**
  - `,help` - Show all command categories
  - `,help ban` - Show detailed help for ban command
  - `,help spotify` - Show Spotify command help
- **Features:**
  - Shows command syntax
  - Shows aliases
  - Shows required permissions
  - Shows examples
- **Use case:** Learn how to use commands

**`,botinfo`** (aliases: `bi`, `info`, `about`)
- **Permission Required:** None
- **What it does:** Get basic information about the bot
- **Example:** `,botinfo`
- **Shows:**
  - Bot name and description
  - Total servers
  - Total users
  - Uptime
  - Invite link
- **Use case:** Learn about adore

**`,invite`** (aliases: `addme`)
- **Permission Required:** None
- **What it does:** Get bot invite link
- **Example:** `,invite`
- **Features:**
  - Direct invite link
  - Support server link
  - Required permissions included
- **Use case:** Add bot to other servers

**`,latency`** (aliases: `ping`, `ms`)
- **Permission Required:** None
- **What it does:** Show bot's latency and response times
- **Example:** `,latency`
- **Shows:**
  - Bot latency (ms)
  - API latency (ms)
  - Websocket latency (ms)
- **Use case:** Check if bot is responsive

---

### Prefix Management

**`,prefix`** (aliases: `setprefix`)
- **Permission Required:** Administrator
- **What it does:** Manage server prefix
- **Example:** `,prefix`
- **Shows:** Current server prefix

**`,prefix view`**
- **Permission Required:** Administrator
- **What it does:** View current server prefix
- **Example:** `,prefix view`
- **Shows:** Current prefix and how to change it

**`,prefix set [prefix]`**
- **Permission Required:** Administrator
- **What it does:** Set a new server prefix
- **Examples:**
  - `,prefix set !` - Change prefix to !
  - `,prefix set ?` - Change prefix to ?
  - `,prefix set a.` - Change prefix to a.
- **Rules:**
  - Maximum 3 characters
  - No spaces allowed
  - Cannot be only numbers
  - Case-sensitive
- **Use case:** Avoid conflicts with other bots

**`,prefix remove`** (aliases: `prefix reset`)
- **Permission Required:** Administrator
- **What it does:** Reset prefix to default (`,`)
- **Example:** `,prefix remove`
- **Use case:** Return to default prefix

---

## 🔧 Developer Commands

**⚠️ RESTRICTED ACCESS** - These commands are only available to bot developers and owners.

### Blacklist System

**`,blacklist`** (aliases: `bl`, `globalban`)
- **Permission Required:** Developer
- **What it does:** Universal blacklist system for users and servers
- **Example:** `,blacklist`
- **Use case:** Prevent abuse across all servers

**`,blacklist users [user.id] [reason]`**
- **Permission Required:** Developer
- **What it does:** Add/remove users from global blacklist or list all blacklisted users
- **Examples:**
  - `,blacklist users 123456789 Abuse` - Blacklist user
  - `,blacklist users 123456789` - Remove from blacklist
  - `,blacklist users` - List all blacklisted users
- **Effect:** User cannot use bot in any server

**`,blacklist servers [server.id] [reason]`**
- **Permission Required:** Developer
- **What it does:** Add/remove servers from global blacklist or list all blacklisted servers
- **Examples:**
  - `,blacklist servers 987654321 TOS violation` - Blacklist server
  - `,blacklist servers 987654321` - Remove from blacklist
  - `,blacklist servers` - List all blacklisted servers
- **Effect:** Bot leaves server and cannot be re-added

---

### Economy Management

**`,economy`** (aliases: `eco`)
- **Permission Required:** Developer
- **What it does:** Economy management utilities
- **Example:** `,economy`

**`,economy addbal [@user] [amount]`**
- **Permission Required:** Developer
- **What it does:** Add balance to a user's wallet
- **Example:** `,economy addbal @user 10000`
- **Use case:** Compensate for bugs or reward testers

**`,economy cleanbal [@user] [amount]`**
- **Permission Required:** Developer
- **What it does:** Remove balance from a user's wallet
- **Example:** `,economy cleanbal @user 5000`
- **Use case:** Remove exploited coins

---

### Data Management

**`,fetch`**
- **Permission Required:** Developer
- **What it does:** Fetch server information and invites
- **Example:** `,fetch`

**`,fetch invite [server id]`**
- **Permission Required:** Developer
- **What it does:** Fetch an invite link for a server by ID
- **Example:** `,fetch invite 123456789`
- **Use case:** Access servers for support or investigation

**`,fetch confession [server id] [confession id]`**
- **Permission Required:** Developer
- **What it does:** Reveal who submitted a confession
- **Example:** `,fetch confession 123456789 42`
- **Use case:** Investigate abuse or TOS violations
- **Privacy note:** Only used for serious violations

**`,clear`**
- **Permission Required:** Developer
- **What it does:** Clear name history for users or servers
- **Example:** `,clear`

**`,clear names [@user]`**
- **Permission Required:** Developer
- **What it does:** Clear a user's name history
- **Example:** `,clear names @user`
- **Use case:** Privacy requests or data cleanup

**`,clear servernames [server id]`**
- **Permission Required:** Developer
- **What it does:** Clear server's name history
- **Example:** `,clear servernames 123456789`
- **Use case:** Privacy requests or data cleanup

---

### System Management

**`,restart`** (aliases: `reboot`)
- **Permission Required:** Developer
- **What it does:** Restart the bot process
- **Example:** `,restart`
- **Use case:** Apply updates or fix issues
- **Note:** Bot will be offline briefly

---

### Developer Notes

- These commands are logged and monitored
- Abuse of developer commands results in access removal
- Use responsibly and only when necessary
- Always provide clear reasons for blacklists
- Respect user privacy with data commands

---

## 💰 Economy & Gambling System

adore includes a full economy system with gambling, earning, and trading features.

### Getting Started

**Check your balance:**
```
,bal
,balance
```
Shows your wallet and bank balance.

**Daily rewards:**
```
,daily
```
Claim free coins every 24 hours.

**Vote rewards:**
```
,vote
```
Vote for adore and get coins every 12 hours.

---

### Earning Coins

**`,crime`** - Commit crimes for coins (risk/reward)
**`,slut`** - Work for coins
**`,mine`** - Mine for resources and coins
**`,pick`** - Pick items for coins
**`,pray`** - Pray for blessings and coins

---

### Gambling

**`,coinflip [amount] [heads|tails]`** (aliases: `cf`)
- Flip a coin, double or lose your bet
- Example: `,coinflip 100 heads`

**`,slot [amount]`**
- Slot machine gambling
- Example: `,slot 50`

**`,ttt @user [amount]`** (Tic Tac Toe)
- Play tic tac toe with wagers
- Example: `,ttt @friend 100`

---

### Banking

**`,deposit [amount|all]`** (aliases: `dep`)
- Move coins from wallet to bank (safe storage)
- Example: `,deposit 1000` or `,deposit all`

**`,withdraw [amount|all]`** (aliases: `with`)
- Move coins from bank to wallet
- Example: `,withdraw 500` or `,withdraw all`

**Why use bank?**
- Coins in bank can't be robbed
- Increase bank limit with banknotes
- Keep your wealth safe

---

### Store & Items

**`,store`** (aliases: `shop`)
- View all items available for purchase
- Categories: items, tools, consumables

**`,banknotes`** (aliases: `notes`)
- View banknotes that increase your bank storage limit
- Higher tier banknotes = more storage
- Example: Buy a banknote to store more coins safely

**`,buy [item number]`**
- Purchase items from store
- Example: `,buy 01` (buys item #01)

**`,sell [item] [amount]`**
- Sell items from your inventory
- Example: `,sell pickaxe 1`

**`,inventory`** (aliases: `inv`, `bag`)
- View your owned items
- Shows quantities and values

**`,use [item]`**
- Use consumable items
- Example: `,use potion`

---

### Social Features

**`,transfer @user [amount]`** (aliases: `give`, `pay`)
- Send coins to another user
- Example: `,transfer @friend 500`

**`,rob @user`**
- Attempt to rob coins from someone's wallet
- Risk: You can lose coins if you fail
- Can't rob bank, only wallet
- Cooldown applies

**`,curse @user`**
- Curse another user (fun feature)
- Example: `,curse @enemy`

---

### Leaderboards

**`,leaderboard`** (aliases: `lb`, `top`)
- View richest users
- Shows wallet + bank totals
- See where you rank

---

### Economy Tips

1. **Keep coins in bank** - Can't be robbed
2. **Buy banknotes** - Increase bank storage limit
3. **Do daily/vote** - Free coins every day
4. **Gamble responsibly** - Don't bet everything
5. **Rob carefully** - You can lose coins if you fail
6. **Use items wisely** - Some items give bonuses

---

## 🔧 Utility Commands

### Bot Information

**`,botinfo`** (aliases: `bi`, `info`, `about`)
- Get basic information about the bot
- Shows server count and user count
- Includes invite button to add bot to other servers
- No permissions required
- Example: `,botinfo`

**What it shows:**
- Bot name and description
- Total servers using the bot
- Total users across all servers
- Invite link button

---

### Command Aliases

Create custom shortcuts for frequently used commands or quick role assignment commands.

**`,alias add [shortcut] [command]`**
- Create a custom command alias
- Use `{0}` as a placeholder for arguments
- Perfect for role assignments and command shortcuts
- Permission: Manage Guild
- Max 50 aliases per server

**Examples:**

**Command shortcuts:**
```
,alias add ui userinfo
,alias add si serverinfo
,alias add av avatar
```
Usage: `,ui @user` → executes `,userinfo @user`

**Role assignment shortcuts:**
```
,alias add member role {0} @Member
,alias add verify role {0} @Verified
,alias add vip role {0} @VIP
```
Usage: `,member @user` → executes `,role @user @Member`

**Pre-filled commands:**
```
,alias add quickmute mute {0} 1h Temporary mute
,alias add warn1 warn {0} First warning - follow the rules
```
Usage: `,quickmute @user` → executes `,mute @user 1h Temporary mute`

**How {0} placeholder works:**
- `{0}` gets replaced with whatever you type after the alias
- Example: If alias is `member role {0} @Member`
- When you type `,member @john`
- It executes `,role @john @Member`
- The `{0}` is replaced with `@john`

**`,alias remove [shortcut]`**
- Remove a command alias
- Example: `,alias remove ui`
- Permission: Manage Guild

**`,alias list`**
- View all aliases in the server
- Shows shortcut → command mapping
- Shows who created each alias
- Permission: Manage Guild

**`,alias removeall`** (aliases: `clear`, `reset`)
- Remove all aliases from the server
- Requires confirmation
- Permission: Manage Guild

**Alias Rules:**
- Maximum 20 characters for shortcut name
- No spaces in shortcut name
- Cannot conflict with existing commands
- Target command must exist
- Server-specific (each server has its own aliases)
- Maximum 50 aliases per server

**Common Use Cases:**

1. **Role Management:**
   ```
   ,alias add staff role {0} @Staff
   ,alias add mod role {0} @Moderator
   ,alias add helper role {0} @Helper
   ```

2. **Quick Moderation:**
   ```
   ,alias add timeout mute {0} 10m Timeout
   ,alias add spam ban {0} 7d Spamming
   ```

3. **Information Commands:**
   ```
   ,alias add whois userinfo
   ,alias add server serverinfo
   ,alias add pfp avatar
   ```

---

### Server Settings

Manage various server-wide settings and configurations.

**`,settings config`**
- View all server configuration settings
- Shows enabled modules and their status
- Displays channel and role configurations
- Shows prefix and other settings
- Permission: Manage Server
- Example: `,settings config`

**What it shows:**
- Server prefix
- Enabled modules (Antinuke, Starboard, Level System, etc.)
- NSFW Bypass status
- Welcome/Goodbye/Boost message counts
- Auto roles, auto react, auto responder counts
- Jail role and channel
- Starboard channel
- Base role for booster roles
- Level up channel
- Ticket system configuration

**`,settings baserole [@role]`**
- Set or view the base role for booster role positioning
- All booster roles will be positioned below this role
- Permission: Manage Server
- Examples:
  - `,settings baserole` - View current base role
  - `,settings baserole @Booster` - Set base role

**`,settings bypass nsfw`**
- Toggle NSFW bypass for the server
- When enabled, NSFW commands can be used in any channel
- When disabled, NSFW commands only work in NSFW-marked channels
- Permission: Manage Server
- Example: `,settings bypass nsfw`

**NSFW Bypass Feature:**
- **What it does:** Allows NSFW roleplay commands (fuck, cum, anal, etc.) to work in non-NSFW channels
- **Why use it:** Some servers want to allow these commands without marking channels as NSFW
- **Security:** Only server administrators with "Manage Server" permission can toggle this
- **Default:** Disabled (NSFW commands require NSFW channels by default)
- **Affected commands:** All NSFW roleplay commands in the bot

**Use cases for NSFW bypass:**
- Adult-only servers where all channels are appropriate
- Servers that want roleplay commands without NSFW channel markers
- Private servers with trusted members
- Testing NSFW commands in development servers

**Important notes:**
- This is a server-wide setting
- Affects all NSFW roleplay commands
- Can be toggled on/off at any time
- Changes take effect immediately
- Shown in `,settings config` display

---

## 💎 Premium Features

- Personal prefix (`,selfprefix`)
- Booster role system
- Priority support
- Early access to new features
- Custom bot status (coming soon)

---

## 📊 Key Facts About adore

1. **adore is NOT an AI bot** - It's a traditional Discord bot with an AI assistant feature (`,ask` command)
2. **Security-first design** - Antinuke system prevents server destruction
3. **Fully customizable** - Custom avatar, banner, bio per server
4. **50+ variables** - Rich embed system with dynamic content
5. **Comprehensive logging** - Track everything in your server
6. **Active development** - Regular updates and new features
7. **Free to use** - Core features available to everyone
8. **Premium optional** - Extra features for supporters

---

## 📝 Confession System

The confession system allows members to submit anonymous confessions that are posted to a designated channel. Perfect for community engagement and allowing members to share thoughts anonymously.

### Features

- **Completely Anonymous** - No tracking of who submitted what
- **Unique IDs** - Each confession gets an auto-incrementing ID
- **Reply System** - Members can reply to confessions anonymously
- **Ignore List** - Prevent specific users from submitting
- **Interactive Buttons** - Easy submission via modal forms

### Setup

**Step 1: Set Confession Channel**
```
,confession channel #confessions
```
This enables the system and sets where confessions will be posted.

**Step 2: Users Submit Confessions**
Users can submit confessions by:
- Running `,confess` to get the submission button
- Clicking "Submit a Confession" on any confession message
- Clicking "Reply" to reply to a specific confession

### Commands

**`,confession`** or **`,confess`**
- Shows an embed with "Submit a Confession" button
- Anyone can use this command
- Example: `,confess`

**`,confession channel [#channel]`** (Manage Server)
- Set or view the confession channel
- Examples:
  - `,confession channel #confessions` - Set channel
  - `,confession channel` - View current channel
- Setting a channel automatically enables the system

**`,confession ignore [@user]`** (Manage Server)
- Toggle a user's ability to submit confessions
- Examples:
  - `,confession ignore @user` - Toggle ignore status
  - `,confession ignore` - View ignored users
- Ignored users cannot submit confessions or replies

**`,confession config`** (Manage Server)
- View complete confession system configuration
- Shows:
  - System status (enabled/disabled)
  - Confession channel
  - List of ignored users
  - Next confession ID
- Example: `,confession config`

### How It Works

**Submitting a Confession:**
1. User clicks "Submit a Confession" button
2. Modal form opens asking for confession content
3. User types confession (10-2000 characters)
4. Confession is posted anonymously with unique ID

**Replying to a Confession:**
1. User clicks "Reply" button on any confession
2. Modal form opens with confession ID pre-filled
3. User types reply (10-2000 characters)
4. Reply is posted as new confession with "Reply to #X" header

### Confession Format

Each confession appears as an embed with:
- **Title:** Anonymous Confession (#ID)
- **Description:** The confession content
- **Footer:** Confession ID: #ID
- **Buttons:**
  - 📝 Submit a Confession - Opens submission modal
  - 💬 Reply - Opens reply modal with ID pre-filled

### Managing Confessions

**Ignore Problematic Users:**
```
,confession ignore @user
```
Prevents the user from submitting confessions or replies.

**View Configuration:**
```
,confession config
```
See all settings including ignored users and next confession ID.

**Disable System:**
Simply delete the confession channel or stop using the commands. The system is passive and only activates when users interact with buttons.

### Best Practices

1. **Set Clear Rules** - Establish guidelines for appropriate confessions
2. **Monitor Regularly** - Check confessions for rule violations
3. **Use Ignore List** - Quickly prevent abuse from specific users
4. **Moderate Content** - Delete inappropriate confessions manually
5. **Encourage Positivity** - Set the tone for constructive confessions

### Use Cases

- **Community Engagement** - Let members share thoughts freely
- **Feedback Collection** - Anonymous suggestions and concerns
- **Support Groups** - Safe space for sharing experiences
- **Fun & Entertainment** - Light-hearted anonymous posts
- **Venting Channel** - Let members express frustrations safely

---

## 🎯 Quick Start Guide

**For New Servers:**
1. Run `,setup` - Creates moderation infrastructure (jail role, channels, logs)
2. Run `,setupmute` - Creates mute roles (optional, for role-based mutes)
3. Configure antinuke: `,antinuke ban on --threshold 3 --do ban`
4. Set up logging: `,logs add #logs all`
5. Add welcome message: `,welcome add #general {embed}$v{title: Welcome!}$v{description: Welcome {user.mention}!}$v{color: #5865F2}`
6. Customize bot: `,customize avatar [url]`
7. Set prefix (optional): `,prefix set !`

**For Moderation:**
1. Use `,ban`, `,kick`, `,mute` for punishments
2. Use `,warn` for warnings, `,unwarn` to remove
3. Use `,jail` for timeouts
4. Use `,purge` variants for message cleanup
5. Check history: `,history @user`
6. View mod activity: `,modhistory @mod`
7. Remove cases: `,history remove @user [caseid]`

**For Security:**
1. Enable all antinuke modules
2. Set conservative thresholds (2-3)
3. Whitelist only when necessary
4. Monitor #jail-log channel
5. Regular permission audits
6. Enable NSR if needed: `,nsr on`

**For Music & Fun:**
1. Link Spotify: `,spotify link` (Premium required)
2. Link Last.fm for music tracking
3. Use `,fm` to share what you're listening to
4. Control Spotify from Discord with `,spotify play`

---

## 🔧 Common Issues & Troubleshooting

### "Mute not working"
**Solution:**
1. Run `,setupmute` to create mute roles
2. Ensure bot has Manage Roles permission
3. Ensure bot role is above mute roles in hierarchy
4. Verify channel permissions are set correctly
5. Don't rename the mute roles after creation
6. For Discord timeout: Use `,timeout` or `,mute` with duration

### "Purge not deleting messages"
**Solution:**
1. Bot needs Manage Messages permission
2. Cannot delete messages older than 14 days (Discord limitation)
3. Check if you're using correct syntax: `,purge [amount]`
4. Try specific variants: `,purge bots 50` or `,purge humans 50`
5. Use `,purge between [id1] [id2]` for specific range

### "History commands not showing cases"
**Solution:**
1. Ensure moderation actions were logged (`,setup` creates log channel)
2. Check if #jail-log channel exists
3. Use `,history @user` not `,history user`
4. Cases only appear after `,setup` was run
5. Use `,modhistory @mod` to see moderator actions

### "Spotify commands not working"
**Solution:**
1. Link your account first: `,spotify link`
2. Spotify Premium required for playback control
3. Check if authorization expired - relink if needed
4. Ensure you're using correct syntax
5. Some commands require active playback

### "NSR not removing reactions"
**Solution:**
1. Enable NSR first: `,nsr on`
2. Bot needs Manage Messages permission
3. Check if user is bypassed: `,nsr bypass @user` to toggle
4. Bot must be able to see the channel
5. Reactions on old messages may not be caught

### "Antinuke punishing legitimate actions"
**Solution:**
1. Whitelist trusted users: `,antinuke whitelist @user`
2. Increase thresholds: `,antinuke ban on --threshold 5`
3. Use less severe punishment: `--do strip` instead of `--do ban`
4. Remove whitelist after mass actions complete
5. Adjust thresholds based on server activity

### "Setup command not working"
**Solution:**
1. Ensure you have Administrator permission
2. Bot needs Manage Channels and Manage Roles permissions
3. Check if channels already exist (may conflict)
4. Try deleting old #jail and #jail-log channels first
5. Ensure bot role is high enough in hierarchy

### "Embed variables not working"
**Solution:**
1. Check spelling: `{user.mention}` not `{user.ping}`
2. Some variables may be empty (e.g., `{server.banner}` if no banner)
3. Use proper syntax: `$v` between parameters
4. Ensure URLs are valid for images
5. Test with `,createembed` command

### "Custom avatar/banner not showing"
**Solution:**
1. Only server owner can customize
2. Wait 5 minutes between changes (cooldown)
3. Ensure image URL is valid and accessible
4. Check image format (PNG, JPG, GIF, WebP)
5. Max file size: 8MB
6. Try with attachment instead of URL

### "Welcome messages not sending"
**Solution:**
1. Check bot has Send Messages permission in channel
2. Verify bot has Embed Links permission
3. Test embed syntax with `,createembed`
4. Check channel isn't deleted
5. Verify welcome message is added: `,welcome list`

### "Prefix not changing"
**Solution:**
1. Ensure you have Administrator permission
2. Use correct syntax: `,prefix set !`
3. Prefix cannot be more than 3 characters
4. Cannot use spaces in prefix
5. Try `,prefix remove` then set new prefix

### "Confession system not working"
**Solution:**
1. Set confession channel first: `,confession channel #confessions`
2. Bot needs Send Messages and Embed Links permissions
3. Check if user is ignored: `,confession ignore @user`
4. Ensure channel still exists
5. Check `,confession config` for status

### "Music integration not linking"
**Solution:**
1. For Spotify: Ensure you have Premium account
2. Click the authorization link provided
3. Complete OAuth flow in browser
4. Check if authorization expired
5. Try unlinking and relinking: `,spotify unlink` then `,spotify link`

---

## 📞 Support

- **Support Server:** https://dsc.gg/s-invite
- **Quick Help:** Use `,ask [question]` command
- **Command Help:** Use `,help [command]` for detailed info
- **Documentation:** Read this guide thoroughly
- **Bot Invite:** Use `,invite` command

---

## 📊 Documentation Summary

This documentation now covers:
- ✅ Complete moderation system (ban, kick, mute, jail, warn, purge)
- ✅ All mute variants (role-based, timeout, channel-specific)
- ✅ Comprehensive history and case management
- ✅ Full antinuke system with all modules
- ✅ Music integration (Spotify & Last.fm)
- ✅ Anti-bully/NSR system
- ✅ Core bot commands (help, invite, latency, prefix)
- ✅ Developer commands (blacklist, economy, fetch)
- ✅ Economy & gambling system
- ✅ Confession system
- ✅ Embed system with variables
- ✅ Customization options
- ✅ Troubleshooting guide

---

**Remember:** adore is always lowercase, never "adore", "adore", or "adore"!


