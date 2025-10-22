# Archived Lavalink Music System

This folder contains the archived Lavalink music system that was removed from the main bot.

## Archived Files

- `handlers/LavalinkManager.js` - The main Lavalink manager class
- `music/play.js` - The play command that used Lavalink

## Removed Dependencies

The following npm packages were used by the Lavalink system:
- `kazagumo` (v3.3.0)
- `kazagumo-spotify` (v2.1.1)
- `shoukaku` (dependency of kazagumo)

## Removed Environment Variables

The following environment variables were used:
- `LAVALINK_HOST`
- `LAVALINK_PORT`
- `LAVALINK_PASSWORD`
- `LAVALINK_SECURE`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

## Notes

The panel.js command in the music folder was kept as it's actually for voice channel management, not music playback.
