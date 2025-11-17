# Critical Bug Fix: Guild Settings Reset Issue

**Date:** November 16, 2025  
**Guild ID Affected:** 1439525673667657810
**Severity:** CRITICAL - Complete Data Loss

## Problem

Server settings were being completely wiped and reset to defaults, sometimes replaced with just webhook data. This happened even after bot restarts and deployments.

## Root Cause

**THREE CRITICAL BUGS** causing catastrophic data corruption:

### Issue 1: Shallow Merge in `ensureGuildData()`
**File:** `database/services/data/GuildService.js`  
**Location:** Lines 217-260

The `ensureGuildData()` method was performing a shallow merge on nested objects:

```javascript
// ❌ BROKEN CODE (REMOVED)
guildData[key] = { ...defaultValue, ...guildData[key] }
```

This caused nested objects to be partially overwritten with defaults whenever `ensureGuildData()` was called.

### Issue 2: Cache Clearing on Reconnect
**File:** `database/services/core/connection.js`  
**Location:** Lines 195-215

On database reconnection, all service caches were being cleared, forcing fresh reads that triggered the merge logic.

### Issue 3: Webhook Rename Overwriting Guild Data ⚠️ MOST CRITICAL!
**File:** `commands/server/webhook.js`  
**Location:** Line 447

The webhook rename function was doing:

```javascript
// ❌ CATASTROPHIC BUG - THIS WAS THE MAIN CULPRIT!
await guildService.set(webhook.webhookId, webhook);
```

This was:
1. Using `webhook.webhookId` as the guild ID (completely wrong!)
2. Passing just the webhook object instead of full guild data
3. **COMPLETELY OVERWRITING the entire guild document with just webhook data**

Every time someone renamed a webhook, ALL guild settings were wiped:
```javascript
{
  GuildID: "webhook_id_here",  // WRONG KEY!
  name: "webhook name",
  webhookId: "...",
  webhookToken: "...",
  // ALL OTHER SETTINGS GONE! ❌
}
```

## Solution

### Fix 1: Conservative Field Addition
Changed `ensureGuildData()` to ONLY add completely missing fields (undefined), never touch existing fields:

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
Removed cache clearing on database reconnection. Write-through caching keeps DB and cache in sync.

### Fix 3: Proper Webhook Update
Fixed webhook rename to properly update within full guild data:

```javascript
// ✅ FIXED CODE
const guildData = await guildService.ensureGuildData(message.guild.id);
const webhookIndex = guildData.Webhooks.findIndex(w => w.webhookId === webhook.webhookId);
if (webhookIndex !== -1) {
  guildData.Webhooks[webhookIndex].name = newName;
  await guildService.set(message.guild.id, guildData);
}
```

## Why Settings Reset After First Deployment

The first deployment fixed Issues #1 and #2, but Issue #3 (webhook bug) was still active. When someone renamed a webhook after deployment, it triggered the catastrophic overwrite, wiping all settings again.

## Testing Recommendations

1. **DO NOT rename any webhooks** until this fix is deployed
2. Monitor guild `1439525673667657810` for 24-48 hours
3. Verify settings persist after:
   - Bot restarts
   - Database reconnections
   - Webhook operations (especially rename)
   - Multiple `ensureGuildData()` calls
4. Check nested objects specifically:
   - VoiceManager settings
   - LevelSystem configuration
   - Antinuke settings
   - TicketSystem settings
   - Webhooks array

## Prevention

Added extensive comments in all three files documenting:
- The issue that occurred
- Why it happened
- What was tried
- The final solution
- Why this approach works

## Files Modified

1. `database/services/data/GuildService.js` - Fixed merge logic in ensureGuildData()
2. `database/services/core/connection.js` - Removed cache clearing on reconnect
3. `commands/server/webhook.js` - **CRITICAL FIX**: Fixed webhook rename overwriting entire guild data

## Related Issues

If settings still reset after this fix, check:
1. Any other commands that might call `guildService.set()` with wrong parameters
2. Direct database operations bypassing the service layer
3. Code that calls `getDefaultGuildData()` and overwrites existing data
4. Any `Object.assign()` calls that might overwrite nested objects

## How to Verify the Fix

```bash
# Check if webhook.js has the fix
grep -A 10 "CRITICAL BUG FIX" commands/server/webhook.js

# Check if GuildService.js has the fix
grep -A 5 "CRITICAL BUG FIX HISTORY" database/services/data/GuildService.js

# Check if connection.js has the fix
grep -A 5 "cache preserved" database/services/core/connection.js
```
