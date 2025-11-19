const { initializeDatabase, Guild, User } = require('../database');

async function cleanupLastFMData() {
  try {
    console.log('Connecting to database...');
    await initializeDatabase(process.env.MONGO_URI);
    
    console.log('Cleaning up LastFM data...');
    
    // Remove LastFMCrowns from all guilds
    const guildResult = await Guild.updateMany(
      {},
      {
        $unset: { LastFMCrowns: "" }
      }
    );
    console.log(`✅ Cleaned ${guildResult.modifiedCount} guilds (removed LastFMCrowns)`);
    
    // Remove LastFMLibrary from all users
    const userResult = await User.updateMany(
      {},
      {
        $unset: { LastFMLibrary: "" }
      }
    );
    console.log(`✅ Cleaned ${userResult.modifiedCount} users (removed LastFMLibrary)`);
    
    console.log('Done! LastFM data cleanup complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning up LastFM data:', error);
    process.exit(1);
  }
}

cleanupLastFMData();
