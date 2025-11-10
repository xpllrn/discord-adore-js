/**
 * One-time script to clean up corrupted MessageStats and LastFMCrowns data
 * Run this once to permanently remove corrupted entries from the database
 */

const mongoose = require('mongoose');
const config = require('../config/setup');

async function cleanupCorruptedData() {
    try {
        console.log('🔧 Starting database cleanup...');
        
        // Connect to MongoDB
        await mongoose.connect(config.mongodb.uri);
        console.log('✅ Connected to MongoDB');

        // Get the Guild model
        const Guild = mongoose.model('Guild');
        
        // Find all guilds
        const guilds = await Guild.find({});
        console.log(`📊 Found ${guilds.length} guilds to check`);

        let totalMessageStatsRemoved = 0;
        let totalLastFMCrownsRemoved = 0;
        let guildsUpdated = 0;

        for (const guild of guilds) {
            let needsUpdate = false;
            
            // Clean MessageStats
            if (guild.MessageStats && guild.MessageStats.length > 0) {
                const originalLength = guild.MessageStats.length;
                guild.MessageStats = guild.MessageStats.filter(stat => 
                    stat.date && stat.userId
                );
                const removed = originalLength - guild.MessageStats.length;
                if (removed > 0) {
                    totalMessageStatsRemoved += removed;
                    needsUpdate = true;
                    console.log(`  Guild ${guild.GuildID}: Removed ${removed} corrupted MessageStats`);
                }
            }

            // Clean LastFMCrowns
            if (guild.LastFMCrowns && guild.LastFMCrowns.length > 0) {
                const originalLength = guild.LastFMCrowns.length;
                guild.LastFMCrowns = guild.LastFMCrowns.filter(crown => 
                    crown.artist && crown.userId && crown.plays
                );
                const removed = originalLength - guild.LastFMCrowns.length;
                if (removed > 0) {
                    totalLastFMCrownsRemoved += removed;
                    needsUpdate = true;
                    console.log(`  Guild ${guild.GuildID}: Removed ${removed} corrupted LastFMCrowns`);
                }
            }

            // Save if needed
            if (needsUpdate) {
                await guild.save();
                guildsUpdated++;
            }
        }

        console.log('\n✅ Cleanup complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Guilds updated: ${guildsUpdated}`);
        console.log(`   - MessageStats removed: ${totalMessageStatsRemoved}`);
        console.log(`   - LastFMCrowns removed: ${totalLastFMCrownsRemoved}`);

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanupCorruptedData();
