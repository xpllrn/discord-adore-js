/**
 * Script to completely reset all LastFM and Sprint data
 * WARNING: This will permanently delete all LastFM libraries, crowns, and sprint data
 */

const mongoose = require('mongoose');
const config = require('../config/setup');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askConfirmation(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

async function resetData() {
    try {
        console.log('⚠️  WARNING: This will permanently delete:');
        console.log('   - All LastFM usernames');
        console.log('   - All LastFM libraries');
        console.log('   - All LastFM crowns');
        console.log('   - All Sprint data');
        console.log('   - All corrupted MessageStats and LastFMCrowns entries');
        console.log('');

        const confirmed = await askConfirmation('Are you sure you want to continue? Type "yes" to confirm: ');
        
        if (!confirmed) {
            console.log('❌ Operation cancelled');
            rl.close();
            process.exit(0);
        }

        console.log('\n🔧 Starting data reset...');
        
        // Connect to MongoDB
        await mongoose.connect(config.mongodb.uri);
        console.log('✅ Connected to MongoDB');

        // Get models
        const Guild = mongoose.model('Guild');
        const User = mongoose.model('User');
        
        // Reset Guild data
        console.log('\n📊 Resetting Guild data...');
        const guilds = await Guild.find({});
        console.log(`   Found ${guilds.length} guilds`);

        let guildsUpdated = 0;
        let totalLastFMCrownsRemoved = 0;
        let totalMessageStatsRemoved = 0;
        let totalSprintsRemoved = 0;

        for (const guild of guilds) {
            let needsUpdate = false;

            // Remove all LastFM Crowns
            if (guild.LastFMCrowns && guild.LastFMCrowns.length > 0) {
                totalLastFMCrownsRemoved += guild.LastFMCrowns.length;
                guild.LastFMCrowns = [];
                needsUpdate = true;
            }

            // Clean MessageStats (remove corrupted ones)
            if (guild.MessageStats && guild.MessageStats.length > 0) {
                const originalLength = guild.MessageStats.length;
                guild.MessageStats = guild.MessageStats.filter(stat => 
                    stat.date && stat.userId
                );
                const removed = originalLength - guild.MessageStats.length;
                if (removed > 0) {
                    totalMessageStatsRemoved += removed;
                    needsUpdate = true;
                }
            }

            // Remove all Sprints
            if (guild.Sprints && guild.Sprints.length > 0) {
                totalSprintsRemoved += guild.Sprints.length;
                guild.Sprints = [];
                needsUpdate = true;
            }

            if (needsUpdate) {
                await guild.save();
                guildsUpdated++;
                console.log(`   ✓ Updated guild ${guild.GuildID}`);
            }
        }

        // Reset User data
        console.log('\n👤 Resetting User data...');
        const users = await User.find({});
        console.log(`   Found ${users.length} users`);

        let usersUpdated = 0;
        let totalLibrariesRemoved = 0;
        let totalSprintHistoryRemoved = 0;

        for (const user of users) {
            let needsUpdate = false;

            // Remove LastFM username
            if (user.LastFMUsername) {
                user.LastFMUsername = null;
                needsUpdate = true;
            }

            // Remove LastFM library
            if (user.LastFMLibrary) {
                user.LastFMLibrary = null;
                totalLibrariesRemoved++;
                needsUpdate = true;
            }

            // Remove Sprint history
            if (user.SprintHistory && user.SprintHistory.length > 0) {
                totalSprintHistoryRemoved += user.SprintHistory.length;
                user.SprintHistory = [];
                needsUpdate = true;
            }

            if (needsUpdate) {
                await user.save();
                usersUpdated++;
            }
        }

        console.log('\n✅ Reset complete!');
        console.log('\n📊 Summary:');
        console.log('   Guild Data:');
        console.log(`     - Guilds updated: ${guildsUpdated}`);
        console.log(`     - LastFM Crowns removed: ${totalLastFMCrownsRemoved}`);
        console.log(`     - Corrupted MessageStats removed: ${totalMessageStatsRemoved}`);
        console.log(`     - Sprints removed: ${totalSprintsRemoved}`);
        console.log('   User Data:');
        console.log(`     - Users updated: ${usersUpdated}`);
        console.log(`     - LastFM Libraries removed: ${totalLibrariesRemoved}`);
        console.log(`     - Sprint History entries removed: ${totalSprintHistoryRemoved}`);

        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
        rl.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during reset:', error);
        rl.close();
        process.exit(1);
    }
}

// Run the reset
resetData();
