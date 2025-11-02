# Database Migration Guide

This guide explains how to migrate your Adore bot data from the current database to the new MongoDB Atlas setup.

## Overview

The migration process will:
- Create two separate databases in MongoDB Atlas: `global` and `local`
- Move user data, system data, store items, sprints, and Spotify sessions to the `global` database
- Move guild data, webhooks, and welcome buttons to the `local` database
- Update your configuration to use the new databases

## Prerequisites

1. **New MongoDB Atlas Database**: Make sure you have added the `New_DB` connection string to your `.env` file:
   ```
   New_DB=mongodb+srv://USER:PASSWORD@HOST/DATABASE
   ```

2. **Current Database**: Ensure your current database is accessible and contains the data you want to migrate.

## Migration Steps

### Step 1: Run the Migration Command

```bash
,dbmove confirm
```

This command will:
- Connect to your new MongoDB Atlas cluster
- Create `global` and `local` databases
- Copy all data from your current databases
- Verify the migration was successful

**Note**: This process may take several minutes depending on your data size.

### Step 2: Update Configuration

After successful migration, update your database configuration:

```bash
,dbconfig update
```

This command will:
- Update `GLOBAL_CONNECTION` to point to the new global database
- Update `LOCAL_CONNECTION` to point to the new local database
- Create a backup of your current `.env` file

### Step 3: Restart the Bot

After updating the configuration, restart your bot to apply the new database connections.

## Database Structure

### Global Database (`global`)
Contains user-specific and system-wide data:
- **Users**: User profiles, gambling data, Last.fm data, UNO stats, etc.
- **System**: Blacklists, instance configurations
- **StoreItems**: Shop items and configurations
- **Sprints**: Reading sprint data
- **SpotifyAuthSessions**: Spotify authentication sessions

### Local Database (`local`)
Contains guild-specific data:
- **Guilds**: Server configurations, moderation cases, welcome/leave messages, etc.
- **Webhooks**: Custom webhook configurations
- **WelcomeButtons**: Welcome button interaction data

## Verification

After migration, you can verify the data was transferred correctly by:

1. Checking user data: `,profile` or `,balance`
2. Checking guild data: `,prefix` or server-specific settings
3. Monitoring the console for any database connection errors

## Rollback

If you need to rollback:

1. Your original `.env` file is backed up as `.env.backup.[timestamp]`
2. Restore the backup: `cp .env.backup.[timestamp] .env`
3. Restart the bot

## Troubleshooting

### Common Issues

1. **Connection Timeout**: If migration times out, check your MongoDB Atlas network access settings
2. **Authentication Failed**: Verify your MongoDB Atlas credentials in the `New_DB` connection string
3. **Partial Migration**: The migration process is designed to be idempotent - you can run it multiple times safely

### Getting Help

If you encounter issues:
1. Check the console logs for detailed error messages
2. Ensure your MongoDB Atlas cluster is accessible
3. Verify your connection string format is correct

## Connection String Format

Your MongoDB Atlas connection string should follow this format:
```
mongodb+srv://username:password@cluster.mongodb.net/database
```

The migration will automatically create the `global` and `local` databases by modifying this base URL.