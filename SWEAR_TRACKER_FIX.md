# Swear Tracker Fix - Data Persistence Issue

## Problem Identified

The swear tracking system was resetting after bot restarts due to a **schema mismatch** between the database model and the service layer.

### Root Cause

**Database Schema** (guild.js) expected:
```javascript
SwearTracker: [{
  userId: String,
  swears: [{ word: String, count: Number, lastUsed: Date }],
  totalSwears: Number,
  todaySwears: Number,
  lastSwearDate: Date
}]
```

**Service Layer** (GuildService.js) was incorrectly pushing:
```javascript
{
  userId: String,
  swear: String,      // ❌ Wrong field name
  timestamp: Date     // ❌ Wrong structure
}
```

This caused:
- Data to be cached correctly in memory
- Data to be saved incorrectly to the database
- On restart, cache cleared and bot read malformed data from database
- Result: Swear counts appeared to reset

## What Was Fixed

### 1. Service Layer Methods Updated

- **`addSwear()`**: Now properly structures data with nested swears array and maintains totals
- **`getUserSwearData()`**: Reads from the correct schema structure
- **`getSwearLeaderboard()`**: Works with the new user entry format
- **`getSwears()`**: Returns single user entry instead of array
- **`clearUserSwears()`**: Properly removes user entries

### 2. Key Improvements

- Proper aggregation of swear counts per word
- Accurate tracking of `totalSwears` and `todaySwears`
- Correct date handling for daily reset logic
- Data now persists correctly across restarts

## How to Apply the Fix

### Step 1: Update Code (Already Done)

The service layer has been updated with the correct schema structure.

### Step 2: Test Database Connection (Optional but Recommended)

First, verify your database connection works:

```bash
cd adore_bot
node database/utils/test-connection.js
```

This will show you:
- If your .env file is loaded correctly
- If database connection is successful
- How many guilds have swear tracking data

### Step 3: Run Migration Script

To fix existing data in your database:

```bash
# Make sure you're in the adore_bot directory
cd adore_bot

# Run the migration
node database/utils/migrate-swear-data.js
```

The script will automatically:
- Load your database connection from `.env`
- Connect to your MongoDB database
- Migrate all existing swear data to the new format
- Show progress for each guild

This will:
- Find all guilds with swear tracking data
- Convert old flat structure to new nested structure
- Preserve all existing swear counts
- Calculate correct totals

### Step 4: Restart Bot

After migration completes, restart your bot:

```bash
# Stop the bot (Ctrl+C or your process manager)
# Then start it again
node index.js
```

### Step 5: Verify

Test the swear command to verify data persists:

```
,swear              # Check your swear count
,swear list         # View your swear list
,swear leaderboard  # View server leaderboard
```

## Migration Safety

The migration script:
- ✅ Checks if data is already in new format (skips if so)
- ✅ Only processes guilds with swear data
- ✅ Preserves all existing counts and timestamps
- ✅ Logs progress for each guild
- ✅ Handles errors gracefully per guild

## Technical Details

### New Data Flow

1. **Message Event** detects swear → calls `guildService.addSwear()`
2. **addSwear()** finds/creates user entry with proper structure
3. **Data saved** to database with correct schema
4. **Cache updated** with same structure
5. **On restart** → reads from database → cache populated correctly

### Schema Compliance

The service layer now fully complies with the Mongoose schema defined in `database/models/guild.js`, ensuring data integrity and persistence.

## Testing Checklist

After applying the fix:

- [ ] Run migration script successfully
- [ ] Restart bot
- [ ] Send a message with a swear word
- [ ] Check swear count with `,swear`
- [ ] Restart bot again
- [ ] Verify swear count persists (not reset)
- [ ] Check leaderboard with `,swear leaderboard`
- [ ] Verify all historical data is intact

## Questions?

If you encounter any issues:
1. Check migration script output for errors
2. Verify database connection is working
3. Check bot logs for any service layer errors
4. Ensure you're using the latest code version
