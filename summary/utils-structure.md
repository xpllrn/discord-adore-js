# Utils Folder Structure

## Current Organization

```
utils/
├── helpers.js              # Combined command helpers
│   ├── Roleplay functions
│   ├── NSFW roleplay functions
│   └── Spotify helper functions
│
├── embeds/                 # Embed builders
│   ├── embedbuilder.js
│   ├── helpEmbedBuilder.js
│   └── helpPagination.js
│
├── commandProcessor.js     # Command execution
├── permissions.js          # Permission checks
├── logger.js              # Auto-context logger
└── webhookLogger.js       # Webhook logging utility
```

## helpers.js Exports

**Roleplay**:
- `createRoleplayCommand(action, gifType)`
- `fetchWaifuGif(gifType)`
- `getOrdinal(number)`

**NSFW Roleplay**:
- `createNSFWRoleplayCommand(action, gifType)`
- `fetchNSFWGif(gifType)`
- `isNSFWChannel(channel)`

**Spotify**:
- `checkSpotifyAccess(userService, userId, message)`
- `checkActiveDevices(spotifyService, userId, message)`
- `handleSpotifyError(error, message)`

## Import Examples

```javascript
// Roleplay
const { createRoleplayCommand } = require('../../utils/helpers');

// Embeds
const embeds = require('../../utils/embeds/embedbuilder');

// Logger
const logger = require('../../utils/logger');
```
