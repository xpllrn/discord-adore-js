# Database Collections Cleanup Summary

## Issue
Extra MongoDB collections were being created that shouldn't exist:
- `welcomeButtons` / `welcomebuttons`
- `webhooks`
- `spotifyauthsessions` / `spotifysessions`
- `storeitems`
- `sprints`

## Root Cause
Code was trying to use non-existent services via `getService()`:
1. `getService('welcomeButton')` - Service never existed
2. `getService('webhook')` - Service never existed

These services were attempting to create their own mongoose models/collections when they should have been using the existing Guild model.

## What Was Fixed

### 1. Removed Non-Existent Service Calls
**File: `events/interaction/interactionCreate.js`**
- Removed calls to `getService('welcomeButton')`
- Replaced `getService('webhook')` with `getService('guild')`
- Updated all webhook method calls to use GuildService:
  - `webhookService.getGuildWebhooks()` → `guildService.getGuildWebhooks()`
  - `webhookService.createWebhook()` → `guildService.createWebhook()`
  - `webhookService.updateLastUsed()` → `guildService.updateWebhookLastUsed()`
  - `webhookService.deleteWebhook()` → `guildService.deleteWebhook()`

### 2. Removed Extra Collections
**Script: `scripts/removeExtraCollections.js`**
Successfully dropped the following collections from both databases:
- ✓ `welcomeButtons`
- ✓ `webhooks`
- ✓ `spotifyauthsessions`
- ✓ `storeitems`
- ✓ `sprints`

## Current Database State

### Valid Collections (3 total):
1. **users** - User-specific data (121 documents, 92.41 KB)
2. **guilds** - Server/guild-specific data (28 documents, 50.86 KB)
3. **systems** - Global bot configuration (1 document, 0.13 KB)

### Data Storage Locations:
- **Webhooks**: Stored in `guilds` collection under `Webhooks` array
- **Sprints**: Stored in `guilds` collection under `Sprints` array
- **Spotify Auth**: Stored in `users` collection under `SpotifyAuthSession` field
- **Store Items**: Not stored in DB - defined in `StoreService` as in-memory data

## Database Configuration Fix

### Issue Found:
Both `USER_DATABASE` and `GUILD_DATABASE` environment variables were pointing to the **same database** (`adore`), causing all collections to be duplicated.

### Solution Applied:
Updated `database/index.js` to detect when both connections point to the same database and use a single connection instead of creating duplicate models. This prevents the same collections from being created twice.

**Code Change:**
- Added database name comparison check
- If same database: Create all models on one connection
- If different databases: Separate User/System in user DB, Guild in guild DB

## Services Status

### Properly Configured Services:
- ✓ `guild` - GuildService (uses Guild model)
- ✓ `user` - UserService (uses User model)
- ✓ `system` - SystemService (uses System model)
- ✓ `prefix` - PrefixService (feature service, no collection)
- ✓ `spotify` - SpotifyService (uses User model for tokens)
- ✓ `store` - StoreService (in-memory items, no collection)

### Removed/Fixed:
- ✗ `welcomeButton` - Never existed, calls removed
- ✗ `webhook` - Never existed, replaced with GuildService

## Notes
- Welcome buttons still work via the embed builder, but no longer try to track interactions via a non-existent service
- All webhook operations now properly use GuildService which stores data in the Guild model
- No functionality was lost - everything now uses the correct data storage locations
