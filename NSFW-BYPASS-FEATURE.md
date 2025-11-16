# NSFW Bypass Feature

## Overview
Added a new server setting that allows NSFW commands (like `fuck`, `cum`, `anal`, etc.) to be used in non-NSFW channels when enabled by server administrators.

## Changes Made

### 1. Database Schema (`database/models/guild.js`)
- Added `NSFWBypass` field to the guild schema
- Type: Boolean
- Default: false
- When enabled, allows NSFW commands in any channel

### 2. Helper Function (`utils/helpers.js`)
- Updated `isNSFWChannel(channel, guildData)` function
  - Now accepts optional `guildData` parameter
  - Returns true if channel is NSFW OR if guild has bypass enabled
  
- Updated `createNSFWRoleplayCommand(action, actionPastTense)` function
  - Now fetches guild data before checking NSFW status
  - Passes guild data to `isNSFWChannel` check

### 3. Settings Command (`commands/server/settings.js`)
- Added new subcommand: `settings nsfwbypass`
  - Toggles the NSFW bypass setting
  - Requires "Manage Server" permission
  - Shows success message with current status
  
- Updated `settings config` display
  - Shows NSFW Bypass status in the Modules section

### 4. Custom NSFW Commands (`commands/roleplay/nsfw/threesome.js`)
- Updated to fetch guild data and pass to `isNSFWChannel` check
- All other NSFW commands use `createNSFWRoleplayCommand` which was already updated

## Usage

### Enable NSFW Bypass
```
,settings nsfwbypass
```
Response: "NSFW bypass **enabled**. NSFW commands can now be used in any channel."

### Disable NSFW Bypass
```
,settings nsfwbypass
```
Response: "NSFW bypass **disabled**. NSFW commands can only be used in NSFW channels."

### View Current Status
```
,settings config
```
The config view will show the NSFW Bypass status in the Modules section.

## Affected Commands
All NSFW roleplay commands in `commands/roleplay/nsfw/`:
- anal
- blowjob
- cum
- fuck
- pussylick
- solo
- threesome
- yaoi
- yuri

## Security Notes
- Only users with "Manage Server" permission can toggle this setting
- The setting is per-server (guild-specific)
- When disabled, commands revert to requiring NSFW channels
- The bypass check happens before command execution
