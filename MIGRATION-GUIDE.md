# Command Reorganization Migration Guide

## 🚀 Quick Start

### Step 1: Review the Structure
Check `FINAL-STRUCTURE.txt` to see the new organization.

### Step 2: Run the Migration Script
```bash
node migrate-commands.js
```

That's it! The script will:
- ✅ Create an automatic backup
- ✅ Move all 188 files to new locations
- ✅ Update all relative imports automatically
- ✅ Clean up empty folders
- ✅ Generate a detailed report

## 📋 What the Script Does

### 1. Creates Backup
- Backs up entire `commands/` folder
- Backs up `commandSlash/` if it exists
- Saves to `backup-commands-TIMESTAMP/`

### 2. Moves Files
Reorganizes all commands according to the new structure:
- `commands/gamble/*` → `commands/fun/economy/*`
- `commands/server/profiles/*` → `commands/profiles/user/*`
- `commands/utility/emoji.js` → `commands/profiles/expressions/emoji.js`
- And 180+ more files...

### 3. Updates Imports
Automatically fixes all relative imports:
```javascript
// Before (in commands/server/profiles/avatar.js)
require('../../../core/embeds')

// After (in commands/profiles/user/avatar.js)
require('../../../core/embeds')  // Automatically recalculated!
```

### 4. Cleans Up
- Removes empty folders
- Keeps your workspace tidy

## 📊 Expected Output

```
================================================================================
COMMAND REORGANIZATION MIGRATION
================================================================================

⚠️  This will reorganize your command structure!
A backup will be created automatically.

📦 Creating backup...
✅ Backup created: backup-commands-2025-11-20T12-30-45-123Z

🚀 Starting migration...
📝 Migrating 180 files

✓ commands/gamble/bal.js → commands/fun/economy/balance/bal.js
✓ commands/gamble/daily.js → commands/fun/economy/earning/daily.js
✓ commands/server/profiles/avatar.js → commands/profiles/user/avatar.js
...

🧹 Cleaning up empty directories...
🗑️  Removed empty directory: commands/gamble
🗑️  Removed empty directory: commands/essentials

================================================================================
MIGRATION REPORT
================================================================================

✅ Files moved: 180
❌ Files failed: 0
🔄 Imports updated: 450

================================================================================

✨ Migration complete!
📦 Backup saved to: backup-commands-2025-11-20T12-30-45-123Z

💡 Next steps:
  1. Test your bot to ensure all commands work
  2. Check the help command categories
  3. If everything works, you can delete the backup folder
  4. If issues occur, restore from backup
```

## 🧪 Testing After Migration

### 1. Start Your Bot
```bash
node index.js
```

Check the startup logs for:
- ✅ All commands loaded successfully
- ✅ No "failed to load" errors
- ✅ Command count matches expected (137+)

### 2. Test Commands
Test a few commands from each category:

**Core:**
```
!help
!ping
```

**Moderation:**
```
!ban @user
!mute @user 10m
```

**Economy:**
```
!bal
!daily
!rob @user
```

**Profiles:**
```
!avatar
!emoji :smile:
```

**Fun:**
```
!8ball Will this work?
!advice
```

### 3. Check Help Command
```
!help
```
Make sure categories display correctly. You may need to update `commands/core/help.js` to reflect the new structure.

## 🔄 Rolling Back

If something goes wrong:

### Option 1: Restore from Backup
```bash
# Delete current commands folder
rm -rf commands/

# Restore from backup
cp -r backup-commands-TIMESTAMP/commands ./
```

### Option 2: Git Reset (if using Git)
```bash
git checkout -- commands/
```

## ⚙️ Post-Migration Tasks

### 1. Update Help Command
The help command may need category updates. Edit `commands/core/help.js`:

```javascript
// Update category mappings
const categories = {
  'core': 'Core Commands',
  'moderation': 'Moderation',
  'fun': 'Fun & Economy',  // Updated!
  'profiles': 'Profiles & Media',  // Updated!
  // ... etc
};
```

### 2. Update Documentation
Update any README or docs that reference command locations.

### 3. Merge Slash Commands (Optional)
If you want to merge `commandSlash/confess.js` with `commands/server/features/confession.js`, see the detailed guide in `command-reorganization-import-plan.txt`.

## 🐛 Troubleshooting

### "Module not found" errors
- Check if imports were updated correctly
- Look for any custom require paths
- Verify module aliases in `package.json`

### Commands not loading
- Check console for specific errors
- Verify file permissions
- Ensure no syntax errors were introduced

### Help command broken
- Update category detection logic
- Check folder name mappings
- Test with `!help` command

## 📝 Notes

- The script uses **relative path calculation** to update imports
- Module aliases (like `@services`) are preserved
- Files starting with `_` are skipped (like `_index.js`)
- Empty folders are automatically removed
- The migration is **idempotent** - safe to run multiple times

## 🎯 Final Structure

After migration, your structure will look like:

```
commands/
├── core/
├── moderation/
├── fun/
│   ├── economy/
│   ├── games/
│   ├── random/
│   └── search/
├── profiles/
│   ├── user/
│   ├── server/
│   └── expressions/
├── information/
├── server/
├── music/
├── social/
├── roleplay/
│   ├── sfw/
│   └── nsfw/
├── utility/
├── premium/
└── dev/
```

## ✅ Checklist

- [ ] Reviewed `FINAL-STRUCTURE.txt`
- [ ] Committed current code to Git (recommended)
- [ ] Ran `node migrate-commands.js`
- [ ] Checked migration report for errors
- [ ] Started bot successfully
- [ ] Tested commands from each category
- [ ] Updated help command if needed
- [ ] Updated documentation
- [ ] Deleted backup folder (after confirming everything works)

## 🆘 Need Help?

If you encounter issues:
1. Check the migration report for specific errors
2. Review the backup folder
3. Check console logs when starting the bot
4. Verify import paths in affected files

Good luck! 🚀
