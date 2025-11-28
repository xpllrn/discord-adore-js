# Hardban System - Quick Usage Guide

## What is a Hardban?

A hardban is a **permanent ban** that:
- Can only be removed by antinuke admins or the server owner
- Automatically re-bans the user if they try to rejoin (even if removed from Discord's ban list)
- Is stored in the bot's database, not just Discord's ban list

## Commands

### Hardban a User
```
,hardban @user raiding the server
,hardban 123456789012345678 spamming
```

**Who can use:** Antinuke admins and server owner only

**What it does:**
1. Adds user to the hardban list
2. Bans them from Discord
3. Logs the action
4. Creates a moderation case

### View Hardbanned Users
```
,hardban list
```

**Who can use:** Antinuke admins and server owner only

**What it shows:**
- All hardbanned users
- Reason for each hardban
- Who banned them
- When they were banned

### Unban a User

#### Regular Unban (Non-Hardbanned User)
```
,unban @user appeal accepted
```

**Who can use:** Anyone with "Ban Members" permission

#### Unhardban (Hardbanned User)
```
,unban @user appeal accepted
```

**Who can use:** Antinuke admins and server owner only

**What happens:**
- Bot automatically detects if user is hardbanned
- If hardbanned, requires antinuke admin or owner permission
- If not hardbanned, regular moderators can unban
- Removes from hardban list if applicable
- Unbans from Discord

## Example Scenarios

### Scenario 1: Raider Joins Server
```
1. Raider joins server
2. Bot checks hardban list
3. Raider is hardbanned
4. Bot immediately bans them again
5. Logs the enforcement
```

### Scenario 2: Moderator Tries to Unban Hardbanned User
```
1. Moderator runs: ,unban @raider
2. Bot checks if raider is hardbanned
3. Raider is hardbanned
4. Bot denies: "This user is hardbanned! Only antinuke admins can unban."
```

### Scenario 3: Owner Unbans Hardbanned User
```
1. Owner runs: ,unban @raider appeal accepted
2. Bot checks if raider is hardbanned
3. Raider is hardbanned
4. Bot checks if owner has permission (yes)
5. Bot removes from hardban list
6. Bot unbans from Discord
7. Success message: "User has been unhardbanned"
```

### Scenario 4: Someone Removes Hardban from Discord Ban List
```
1. Someone manually removes user from Discord's ban list
2. User tries to rejoin
3. Bot checks hardban list on join
4. User is still in hardban list
5. Bot immediately bans them again
6. Logs the enforcement
```

## Permission Hierarchy

### Can Hardban:
- ✅ Server Owner
- ✅ Antinuke Admins
- ❌ Regular Moderators (even with Ban Members permission)

### Can Unban Regular Bans:
- ✅ Server Owner
- ✅ Antinuke Admins
- ✅ Anyone with "Ban Members" permission

### Can Unban Hardbans:
- ✅ Server Owner
- ✅ Antinuke Admins
- ❌ Regular Moderators (even with Ban Members permission)

## Tips

1. **Use hardbans for serious offenses** like raiding, doxxing, or repeated rule violations
2. **Regular bans are fine for most cases** - hardbans are for when you want extra protection
3. **Hardbans persist even if someone removes them from Discord** - the bot will re-ban on join
4. **Check the hardban list regularly** with `,hardban list` to review active hardbans
5. **Document reasons clearly** - they appear in the hardban list and moderation logs

## Troubleshooting

**Q: I hardbanned someone but they're not in Discord's ban list**
- A: They might have been manually unbanned. They'll be re-banned if they try to join.

**Q: A moderator can't unban someone**
- A: Check if the user is hardbanned with `,hardban list`. Only antinuke admins can unban hardbanned users.

**Q: How do I make someone an antinuke admin?**
- A: Use your antinuke system commands to add them as an admin.

**Q: Can I see hardban history?**
- A: Yes, hardbans create moderation cases that appear in moderation history.
