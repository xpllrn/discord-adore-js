# Project Architecture

## Service Layer Structure

```
database/services/
├── core/                    # Infrastructure
│   ├── BaseService.js       # Base class for all services
│   ├── SmartCache.js        # LRU cache with TTL
│   ├── connection.js        # MongoDB connection with retry & health monitoring
│   ├── CacheWarmer.js       # Preload frequently accessed data
│   ├── PerformanceMonitor.js# Performance tracking
│   └── errors.js            # Custom error classes
│
├── data/                    # Data services (1:1 with collections)
│   ├── GuildService.js      # Guild collection operations
│   ├── UserService.js       # User collection operations
│   └── SystemService.js     # System collection operations
│
└── features/                # Feature services (combine data services)
    ├── PrefixService.js     # Prefix management (Guild + User)
    └── SpotifyService.js    # Spotify integration (User + API)
```

## Cache System

**Write-Through Strategy**:
1. Write to database FIRST
2. Update cache AFTER successful write
3. Read from cache FIRST, fallback to database

**Configuration**:
- TTL: 45 minutes for users
- Max Size: 10,000 users
- LRU eviction when full

## Usage Pattern

```javascript
const { getService } = require('@services');

// Get services
const userService = getService('user');
const guildService = getService('guild');

// Read (cache-first)
const userData = await userService.get(userId);

// Write (write-through)
await userService.set(userId, updatedData);

// Delete
await userService.delete(userId);
```

## Connection System

**Features**:
- Automatic retry (3 attempts: 2s, 5s, 10s delays)
- Health monitoring (every 60 seconds)
- Connection statistics tracking
- Graceful shutdown handling

## Background Tasks

Located in `events/system/backgroundTasks.js`:
- Reminder checking (every minute)
- Giveaway checking (every minute)
- Sprint management (resume on startup, auto-end, reminders)
