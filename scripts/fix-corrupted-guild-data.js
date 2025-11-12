/**
 * Script to fix corrupted guild data
 * Fixes:
 * 1. ForceNick entries with null setBy
 * 2. MessageStats entries with missing date field
 */

require('module-alias/register');

async function fixCorruptedData() {
  console.log('🔧 Starting database cleanup...\n');

  try {
    // Connect directly with mongoose
    const mongoose = require('mongoose');
    const config = require('../config/setup');
    const guildSchema = require('../database/models/guild');

    console.log('📦 Connecting to database...');
    
    // Get connection string from config
    let connectionString;
    if (typeof config.database === 'string') {
      connectionString = config.database;
    } else if (config.database?.guildConnection) {
      connectionString = config.database.guildConnection;
    } else if (config.database?.guild) {
      connectionString = config.database.guild;
    } else if (config.database?.local) {
      connectionString = config.database.local;
    } else {
      console.error('❌ No database connection string found in config');
      console.log('Config database:', config.database);
      process.exit(1);
    }

    await mongoose.connect(connectionString);
    console.log('✅ Connected to database\n');

    const Guild = mongoose.model('Guild', guildSchema.schema);

    // Get all guilds
    const guilds = await Guild.find({});
    console.log(`📊 Found ${guilds.length} guilds to check\n`);

    let fixedGuilds = 0;
    let fixedForceNick = 0;
    let fixedMessageStats = 0;

    for (const guild of guilds) {
      let modified = false;

      // Fix ForceNick entries with null setBy
      if (guild.ForceNick && guild.ForceNick.length > 0) {
        for (const forceNick of guild.ForceNick) {
          if (forceNick.setBy === null || forceNick.setBy === undefined) {
            forceNick.setBy = 'Unknown';
            modified = true;
            fixedForceNick++;
          }
        }
      }

      // Fix MessageStats entries with missing date
      if (guild.MessageStats && guild.MessageStats.length > 0) {
        // Remove entries without date or userId
        const validStats = guild.MessageStats.filter(stat => {
          if (!stat.date || !stat.userId) {
            fixedMessageStats++;
            return false;
          }
          return true;
        });

        if (validStats.length !== guild.MessageStats.length) {
          guild.MessageStats = validStats;
          modified = true;
        }
      }

      // Save if modified
      if (modified) {
        try {
          await guild.save({ validateBeforeSave: false });
          fixedGuilds++;
          console.log(`✅ Fixed guild: ${guild.GuildID}`);
        } catch (error) {
          console.error(`❌ Failed to fix guild ${guild.GuildID}:`, error.message);
        }
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`   Guilds processed: ${guilds.length}`);
    console.log(`   Guilds fixed: ${fixedGuilds}`);
    console.log(`   ForceNick entries fixed: ${fixedForceNick}`);
    console.log(`   MessageStats entries removed: ${fixedMessageStats}`);
    console.log('\n✅ Database cleanup complete!');

    // Close connection
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Run the script
fixCorruptedData();
