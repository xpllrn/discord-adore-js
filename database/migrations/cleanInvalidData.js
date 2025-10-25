/**
 * Migration script to clean invalid MessageStats and StarboardMessages entries
 * Run this once to fix validation errors
 */

async function cleanInvalidData() {
  const { getModels } = require('../index');
  
  try {
    const models = getModels();
    if (!models || !models.Guild) {
      console.error('Database models not available');
      return;
    }

    const Guild = models.Guild;
    
    console.log('🔧 Starting data cleanup...');
    
    // Find all guilds
    const guilds = await Guild.find({});
    console.log(`Found ${guilds.length} guilds to check`);
    
    let updatedCount = 0;
    
    for (const guild of guilds) {
      let needsUpdate = false;
      
      // Clean MessageStats - remove entries without required fields
      if (guild.MessageStats && guild.MessageStats.length > 0) {
        const validMessageStats = guild.MessageStats.filter(stat => 
          stat.userId && stat.date
        );
        
        if (validMessageStats.length !== guild.MessageStats.length) {
          console.log(`Guild ${guild.GuildID}: Removing ${guild.MessageStats.length - validMessageStats.length} invalid MessageStats entries`);
          guild.MessageStats = validMessageStats;
          needsUpdate = true;
        }
      }
      
      // Clean StarboardMessages - remove entries without required fields
      if (guild.StarboardMessages && guild.StarboardMessages.length > 0) {
        const validStarboardMessages = guild.StarboardMessages.filter(msg => 
          msg.originalMessageId && msg.starboardMessageId && msg.channelId && msg.authorId
        );
        
        if (validStarboardMessages.length !== guild.StarboardMessages.length) {
          console.log(`Guild ${guild.GuildID}: Removing ${guild.StarboardMessages.length - validStarboardMessages.length} invalid StarboardMessages entries`);
          guild.StarboardMessages = validStarboardMessages;
          needsUpdate = true;
        }
      }
      
      // Save if needed
      if (needsUpdate) {
        await guild.save();
        updatedCount++;
      }
    }
    
    console.log(`✅ Data cleanup complete! Updated ${updatedCount} guilds`);
    
  } catch (error) {
    console.error('❌ Error during data cleanup:', error);
    throw error;
  }
}

module.exports = { cleanInvalidData };

// Allow running directly
if (require.main === module) {
  (async () => {
    // Initialize database first
    const { initializeDatabase, disconnectDatabase } = require('../index');
    
    try {
      await initializeDatabase();
      await cleanInvalidData();
      await disconnectDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}
