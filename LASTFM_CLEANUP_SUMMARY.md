# LastFM Cleanup Summary

## What Was Removed

### Commands
- ❌ Removed `commands/lastfm/lastfm.js` (complex command with 2380 lines)
  - All subcommands: `lf set`, `lf update`, `lf refresh`, `lf index`
  - WhoKnows commands: `wa`, `wt`, `wal`, `wk`, `wka`, `wkt`
  - Global WhoKnows: `gwk`, `gwka`, `gwkt`
  - Top commands: `topartists`, `topalbums`, `toptracks`
  - Plays commands: `plays`, `playsalbum`, `playstrack`
  - Social commands: `compare`, `taste`, `mutual`, `match`
  - Crown commands: `crowns`, `crownsall`
  - Chart, streak, pace, recent commands

### Database Schema
- ❌ Removed `LastFMCrowns` array from Guild model
- ❌ Removed `LastFMLibrary` object from User model
- ❌ Removed all related database indexes

### Service Methods
- ❌ Removed `getLastFMLibrary()` from UserService
- ❌ Removed `setLastFMLibrary()` from UserService

## What Was Kept

### Commands
- ✅ Kept `commands/lastfm/fm.js` - Basic now playing command
  - Usage: `,fm` or `,fm @user`
  - Shows current/last played track from Last.fm
  - Displays play counts for track and artist

### Database Schema
- ✅ Kept `LastFMUsername` field in User model
- ✅ Kept `LastFMSettings` field in User model

### Service Methods
- ✅ Kept `getLastFMUsername()` in UserService
- ✅ Kept `setLastFMUsername()` in UserService

## Migration Steps

To clean up existing database entries, run:

```bash
node scripts/cleanup-lastfm-data.js
```

This will:
1. Remove `LastFMCrowns` from all guild documents
2. Remove `LastFMLibrary` from all user documents

## Impact

- Users can still use `,fm` to see their now playing
- Users will need to have their LastFM username set (stored in database)
- All complex features (crowns, whoknows, library indexing) are removed
- Database will be cleaner and lighter without the heavy library data
- No more validation errors from malformed LastFMCrowns entries
