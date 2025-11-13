# Role Restore Feature

## Overview
The role restore feature automatically saves member roles when they leave the server (kick, ban, or voluntary leave) and allows moderators to restore those roles if the member rejoins within 2 hours.

## How It Works

### Automatic Role Saving
When a member leaves the server:
- All their roles are automatically saved (except @everyone and boost role)
- Data is stored for 2 hours
- After 2 hours, the data is automatically cleaned up

### Restoring Roles
Use the command: `,role restore @user`

The bot will:
1. Check if saved role data exists for the user (within 2 hours)
2. Validate that roles still exist and can be managed
3. Restore all valid roles to the user
4. Remove the saved data after successful restore

## Features

✅ **Automatic Saving**: No setup required, works automatically
✅ **Smart Filtering**: Ignores boost role (can't be manually assigned)
✅ **2-Hour Window**: Prevents database bloat with auto-cleanup
✅ **Permission Checks**: Validates role hierarchy before restoring
✅ **Detailed Feedback**: Shows how many roles were restored and how long ago they were saved

## Usage Examples

```
,role restore @john
,role restore 123456789012345678
,role restore john#1234
```

## Permissions Required
- User: `Manage Roles`
- Bot: `Manage Roles`

## Notes
- Boost roles are automatically excluded (Discord doesn't allow manual assignment)
- Roles that were deleted or are now above the bot's highest role will be skipped
- The 2-hour timer starts when the member leaves, not when they rejoin
