# Critical Bug Fix: Guild Settings Reset Issue

**Date:** November 16, 2025  
**Guild ID Affected:** 1439525673667657810  
**Severity:** CRITICAL - Data Loss  

## Problem

Server settings (VoiceManager, LevelSystem, Antinuke, etc.) were being reset to default values every few hours, causing significant data loss and configuration issues.

## Root Cause

Two interconnected issues in the database service layer:

### Issue 1: Shallow Merge in `ensureGuildData()`
**File:** `database/services/data/GuildService.js`  
**Location:** Lines 217-260

The `ensureGuildData()` method was performing a shallow merge on nested objects:

```javascript
// ❌ BROKEN CODE (REMOVED)
guildData[key] = { ...defaultValue, ...guildData[key] }
```

This caused nested objects to be partially overwritten with defaults whenever `ensureGuildData()` was called (which happens very frequently across the codebase).

### Issue 2: Cache Clearing on Reconnect
**File:** `database/services/core/connection.js`  
**Location:** Lines 195-215

On database reconnection, all service caches were being cleared. This forced fresh reads from the database, which then triggered the merge logic in `ensureGuildData()`, causing data loss.

## Solution

### Fix 1: Conservative Field Addition
Changed `ensureGuildData()` to ONLY add completely missing fields (undefined), and NEVER touch existing fields:

```javascript
// ✅ FIXED CODE
for (const [key, defaultValue] of Object.entries(defaults)) {
  if (guildData[key] === undefined) {
    guildData[key] = defaultValue;
  }
  // If field exists, trust it's correct and don't modify it
}
```

### Fix 2: Preserve Cache on Reconnect
Removed cache clearing on database reconnection. The write-through caching strategy ensures DB and cache stay in sync, and TTL handles natural expiration.

## Testing Recommendations

1. Monitor guild `1439525673667657810` for the next 24-48 hours
2. Verify settings persist after:
   - Bot restarts
   - Database reconnections
   - Multiple `ensureGuildData()` calls
3. Check nested objects specifically:
   - VoiceManager settings
   - LevelSystem configuration
   - Antinuke settings
   - TicketSystem settings

## Prevention

Added extensive comments in both files documenting:
- The issue that occurred
- Why it happened
- What was tried
- The final solution
- Why this approach works

This ensures future developers (including AI assistants) can see the fix history and avoid reintroducing the bug.

## Files Modified

1. `database/services/data/GuildService.js` - Fixed merge logic
2. `database/services/core/connection.js` - Removed cache clearing on reconnect

## Related Issues

If settings still reset after this fix, check:
1. Direct database operations bypassing the service layer
2. Code that calls `getDefaultGuildData()` and overwrites existing data
3. Any `Object.assign()` calls that might overwrite nested objects
4. Manual cache invalidation calls that might be too aggressive
