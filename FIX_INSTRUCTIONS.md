# Fix Instructions

## Issue 1: Jail Command Database Validation Error

**Error:** `ValidationError: Guild validation failed: MessageStats.X.date: Path 'date' is required., StarboardMessages.X.originalMessageId: Path 'originalMessageId' is required.`

**Cause:** Your database has corrupted/incomplete data in MessageStats and StarboardMessages arrays.

**Fix:** Run the migration script to clean up invalid data:

```bash
cd adore_bot
node database/migrations/cleanInvalidData.js
```

This will:
- Remove MessageStats entries without required `userId` or `date` fields
- Remove StarboardMessages entries without required fields
- Clean up all guilds in your database

**Alternative:** If you don't need the old data, you can manually clear these arrays in MongoDB:

```javascript
db.guilds.updateMany(
  {},
  {
    $set: {
      MessageStats: [],
      StarboardMessages: []
    }
  }
)
```

## Issue 2: Level System XP Display

**Problem:** Leaderboard was showing confusing XP values.

**Fixed:** 
- Removed the `totalExperience` concept entirely
- Leaderboard now shows current level XP (same as individual cards)
- Sorting is by level first, then by current XP
- This is simpler and more intuitive

**Example:**
- Level 7 with 985 XP ranks higher than Level 7 with 372 XP
- Level 8 with 10 XP ranks higher than Level 7 with 999 XP

**No action needed** - the fix is already applied in the code.

## Testing

1. **Test jail command after migration:**
   ```
   ,jail @user
   ```
   Should work without validation errors.

2. **Test level system:**
   ```
   ,level @user
   ,levels leaderboard
   ```
   XP should now match between individual cards and leaderboard.

## Notes

- The migration script is safe to run multiple times
- It only removes entries with missing required fields
- Valid data is preserved
- The level system fix is backward compatible
