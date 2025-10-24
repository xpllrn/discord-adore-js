/**
 * Migration Script: Fix Swear Tracker Data Structure
 * 
 * This script migrates swear tracking data from the old flat structure
 * to the new nested structure that matches the schema.
 * 
 * Old structure: [{ userId, swear, timestamp }, ...]
 * New structure: [{ userId, swears: [{ word, count, lastUsed }], totalSwears, todaySwears, lastSwearDate }]
 * 
 * Run this once to fix existing data after the service layer update.
 */

const { getModels } = require('../index');

async function migrateSwearData() {
  console.log('Starting swear data migration...');
  
  try {
    const models = getModels();
    const Guild = models.Guild;

    if (!Guild) {
      throw new Error('Guild model not found');
    }

    // Find all guilds with swear tracker data
    const guilds = await Guild.find({ 
      SwearTracker: { $exists: true, $ne: [] } 
    });

    console.log(`Found ${guilds.length} guilds with swear data`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const guild of guilds) {
      try {
        const swearTracker = guild.SwearTracker || [];
        
        // Check if data is already in new format
        const isNewFormat = swearTracker.length > 0 && 
          swearTracker[0].swears !== undefined &&
          Array.isArray(swearTracker[0].swears);

        if (isNewFormat) {
          console.log(`Guild ${guild.GuildID}: Already in new format, skipping`);
          skippedCount++;
          continue;
        }

        // Check if data is in old format
        const isOldFormat = swearTracker.length > 0 && 
          swearTracker[0].swear !== undefined;

        if (!isOldFormat) {
          console.log(`Guild ${guild.GuildID}: Unknown format, skipping`);
          skippedCount++;
          continue;
        }

        // Migrate from old to new format
        const userMap = new Map();

        for (const entry of swearTracker) {
          if (!entry.userId || !entry.swear) continue;

          const userId = entry.userId;
          const word = entry.swear.toLowerCase();
          const timestamp = entry.timestamp || new Date();

          if (!userMap.has(userId)) {
            userMap.set(userId, {
              userId,
              swears: [],
              totalSwears: 0,
              todaySwears: 0,
              lastSwearDate: timestamp
            });
          }

          const userEntry = userMap.get(userId);

          // Find or create swear word entry
          let swearEntry = userEntry.swears.find(s => s.word === word);
          if (!swearEntry) {
            swearEntry = { word, count: 0, lastUsed: timestamp };
            userEntry.swears.push(swearEntry);
          }

          swearEntry.count++;
          swearEntry.lastUsed = timestamp > swearEntry.lastUsed ? timestamp : swearEntry.lastUsed;
          userEntry.totalSwears++;

          // Update last swear date
          if (timestamp > userEntry.lastSwearDate) {
            userEntry.lastSwearDate = timestamp;
          }
        }

        // Calculate todaySwears for each user
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const userEntry of userMap.values()) {
          const lastSwearDate = new Date(userEntry.lastSwearDate);
          lastSwearDate.setHours(0, 0, 0, 0);

          // Count swears from today
          let todayCount = 0;
          for (const entry of swearTracker) {
            if (entry.userId === userEntry.userId) {
              const entryDate = new Date(entry.timestamp || new Date());
              entryDate.setHours(0, 0, 0, 0);
              if (entryDate.getTime() === today.getTime()) {
                todayCount++;
              }
            }
          }

          userEntry.todaySwears = todayCount;
        }

        // Convert map to array
        const newSwearTracker = Array.from(userMap.values());

        // Update guild with new format
        guild.SwearTracker = newSwearTracker;
        await guild.save();

        console.log(`Guild ${guild.GuildID}: Migrated ${swearTracker.length} entries to ${newSwearTracker.length} user entries`);
        migratedCount++;

      } catch (error) {
        console.error(`Error migrating guild ${guild.GuildID}:`, error.message);
      }
    }

    console.log('\nMigration complete!');
    console.log(`Migrated: ${migratedCount} guilds`);
    console.log(`Skipped: ${skippedCount} guilds`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  const { initializeDatabase } = require('../index');
  const path = require('path');
  const fs = require('fs');
  
  // Load environment variables
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  
  // Get connection strings from environment
  const connectionStrings = {
    global: process.env.GLOBAL_CONNECTION || process.env.MONGO_URI_GLOBAL || process.env.MONGO_URI,
    local: process.env.LOCAL_CONNECTION || process.env.MONGO_URI_LOCAL || process.env.MONGO_URI
  };
  
  if (!connectionStrings.global && !connectionStrings.local) {
    console.error('Error: No MongoDB connection string found in environment variables');
    console.error('Please set MONGO_URI, GLOBAL_CONNECTION, or LOCAL_CONNECTION in your .env file');
    process.exit(1);
  }
  
  console.log('Connecting to database...');
  initializeDatabase(connectionStrings)
    .then(success => {
      if (!success) {
        throw new Error('Failed to connect to database');
      }
      console.log('Database connected successfully\n');
      return migrateSwearData();
    })
    .then(() => {
      console.log('\n✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateSwearData };
