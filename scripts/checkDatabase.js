/**
 * Database Health Check Script
 * Checks for data corruption and verifies database integrity
 */

const { initializeDatabase, getModels } = require('../database');
const config = require('../config/setup');

async function checkDatabase() {
  console.log('🔍 Starting database health check...\n');

  try {
    // Initialize database
    console.log('📡 Connecting to database...');
    const connected = await initializeDatabase({
      user: config.database.userConnection,
      guild: config.database.guildConnection
    });

    if (!connected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    console.log('✅ Database connected\n');

    const models = getModels();
    if (!models) {
      console.error('❌ Models not initialized');
      process.exit(1);
    }

    const { User, Guild, System } = models;

    // Check Guild data
    console.log('📊 Checking Guild data...');
    const guildCount = await Guild.countDocuments();
    console.log(`   Total guilds: ${guildCount}`);

    if (guildCount > 0) {
      // Sample 5 random guilds
      const sampleGuilds = await Guild.find().limit(5);
      console.log('\n   Sample guilds:');
      
      for (const guild of sampleGuilds) {
        const hasPrefix = guild.Prefix ? '✓' : '✗';
        const hasSettings = Object.keys(guild.toObject()).length;
        console.log(`   ${hasPrefix} Guild ${guild.GuildID} - ${hasSettings} fields`);
        
        // Check for common data
        if (guild.Prefix) console.log(`      Prefix: ${guild.Prefix}`);
        if (guild.Giveaways?.length) console.log(`      Giveaways: ${guild.Giveaways.length}`);
        if (guild.AutoRoles?.length) console.log(`      AutoRoles: ${guild.AutoRoles.length}`);
        if (guild.Aliases?.length) console.log(`      Aliases: ${guild.Aliases.length}`);
      }
    }

    // Check User data
    console.log('\n📊 Checking User data...');
    const userCount = await User.countDocuments();
    console.log(`   Total users: ${userCount}`);

    if (userCount > 0) {
      // Sample 5 random users
      const sampleUsers = await User.find().limit(5);
      console.log('\n   Sample users:');
      
      for (const user of sampleUsers) {
        const hasData = Object.keys(user.toObject()).length;
        console.log(`   ✓ User ${user.UserID} - ${hasData} fields`);
        
        // Check for common data
        if (user.Balance !== undefined) console.log(`      Balance: $${user.Balance}`);
        if (user.LastFMUsername) console.log(`      Last.fm: ${user.LastFMUsername}`);
        if (user.Reminders?.length) console.log(`      Reminders: ${user.Reminders.length}`);
      }
    }

    // Check System data
    console.log('\n📊 Checking System data...');
    const systemData = await System.findOne({ _id: 'system' });
    if (systemData) {
      console.log('   ✓ System data exists');
      console.log(`      Blacklisted users: ${systemData.Blacklist?.users?.length || 0}`);
      console.log(`      Blacklisted servers: ${systemData.Blacklist?.servers?.length || 0}`);
    } else {
      console.log('   ⚠️  System data not found (will be created on first use)');
    }

    // Check for corrupted documents
    console.log('\n🔍 Checking for corrupted documents...');
    
    // Check guilds with missing GuildID
    const corruptedGuilds = await Guild.countDocuments({ 
      $or: [
        { GuildID: null },
        { GuildID: '' },
        { GuildID: { $exists: false } }
      ]
    });
    
    if (corruptedGuilds > 0) {
      console.log(`   ⚠️  Found ${corruptedGuilds} guilds with missing GuildID`);
    } else {
      console.log('   ✓ No corrupted guild documents found');
    }

    // Check users with missing UserID
    const corruptedUsers = await User.countDocuments({ 
      $or: [
        { UserID: null },
        { UserID: '' },
        { UserID: { $exists: false } }
      ]
    });
    
    if (corruptedUsers > 0) {
      console.log(`   ⚠️  Found ${corruptedUsers} users with missing UserID`);
    } else {
      console.log('   ✓ No corrupted user documents found');
    }

    // Check for duplicate GuildIDs
    console.log('\n🔍 Checking for duplicates...');
    const duplicateGuilds = await Guild.aggregate([
      { $group: { _id: '$GuildID', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    if (duplicateGuilds.length > 0) {
      console.log(`   ⚠️  Found ${duplicateGuilds.length} duplicate guild entries`);
      duplicateGuilds.forEach(dup => {
        console.log(`      Guild ${dup._id}: ${dup.count} copies`);
      });
    } else {
      console.log('   ✓ No duplicate guilds found');
    }

    // Check for duplicate UserIDs
    const duplicateUsers = await User.aggregate([
      { $group: { _id: '$UserID', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    if (duplicateUsers.length > 0) {
      console.log(`   ⚠️  Found ${duplicateUsers.length} duplicate user entries`);
      duplicateUsers.forEach(dup => {
        console.log(`      User ${dup._id}: ${dup.count} copies`);
      });
    } else {
      console.log('   ✓ No duplicate users found');
    }

    console.log('\n✅ Database health check complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during health check:', error);
    process.exit(1);
  }
}

// Run the check
checkDatabase();
