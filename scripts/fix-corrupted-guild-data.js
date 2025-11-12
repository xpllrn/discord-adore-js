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
    // Initialize database
    const { initializeDatabase, getModels } = require('../database');
    const config = require('../config/setup');

    console.log('📦 Connecting to database...');
    await initializeDatabase(config.database);

    const models = getModels();
    if (!models || !models.Guild) {
      console.error('❌ Failed to get database models');
      process.exit(1);
    }

    const Guild = models.Guild;

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

    process.exit(0);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the script
fixCorruptedData();
