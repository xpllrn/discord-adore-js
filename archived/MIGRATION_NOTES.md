# Lavalink Removal Migration Notes

## Changes Made

### Files Archived
1. `handlers/LavalinkManager.js` → `archived/handlers/LavalinkManager.js`
2. `commands/music/play.js` → `archived/music/play.js`

### Files Modified

#### `index.js`
- Removed `LavalinkManager` import
- Removed `client.lavalink` initialization

#### `config/setup.js`
- Removed Lavalink environment variables from `recommendedEnvVars`
- Removed `spotify` configuration object
- Removed `lavalink` configuration object

#### `.env`
- Removed `SPOTIFY_CLIENT_ID`
- Removed `SPOTIFY_CLIENT_SECRET`
- Removed `LAVALINK_HOST`
- Removed `LAVALINK_PORT`
- Removed `LAVALINK_PASSWORD`
- Removed `LAVALINK_SECURE`

#### `events/interaction/interactionCreate.js`
- Removed `handleMusicButton()` function
- Removed music button handler from main interaction handler

#### `package.json`
- Removed `kazagumo` dependency
- Removed `kazagumo-spotify` dependency

### Files Kept
- `commands/music/panel.js` - This is for voice channel management, not music playback

## To Restore Lavalink

If you need to restore the Lavalink functionality:

1. Copy files from `archived/` back to their original locations
2. Restore the removed code sections (see this file for reference)
3. Run `npm install kazagumo@3.3.0 kazagumo-spotify@2.1.1`
4. Add back the environment variables to `.env`
5. Restart the bot

## Next Steps

You may want to:
- Run `npm install` to update dependencies
- Delete `node_modules` and `package-lock.json`, then run `npm install` for a clean install
- Test the bot to ensure no music-related errors occur
