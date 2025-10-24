/**
 * Test Database Connection
 * Simple script to verify database connection works before running migration
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ Loaded .env file');
} else {
  console.log('⚠️  No .env file found at:', envPath);
}

const { initializeDatabase, getModels } = require('../index');

async function testConnection() {
  console.log('\n🔍 Testing database connection...\n');
  
  // Get connection strings from environment
  const connectionStrings = {
    global: process.env.GLOBAL_CONNECTION || process.env.MONGO_URI_GLOBAL || process.env.MONGO_URI,
    local: process.env.LOCAL_CONNECTION || process.env.MONGO_URI_LOCAL || process.env.MONGO_URI
  };
  
  console.log('Connection strings found:');
  console.log('- Global:', connectionStrings.global ? '✅ Set' : '❌ Not set');
  console.log('- Local:', connectionStrings.local ? '✅ Set' : '❌ Not set');
  
  if (!connectionStrings.global && !connectionStrings.local) {
    console.error('\n❌ Error: No MongoDB connection string found');
    console.error('Please set GLOBAL_CONNECTION or LOCAL_CONNECTION in your .env file');
    process.exit(1);
  }
  
  console.log('\n📡 Connecting to database...');
  const success = await initializeDatabase(connectionStrings);
  
  if (!success) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }
  
  console.log('✅ Database connected successfully\n');
  
  // Test model access
  const models = getModels();
  if (!models) {
    console.error('❌ Models not available');
    process.exit(1);
  }
  
  console.log('✅ Models loaded:');
  console.log('- User:', models.User ? '✅' : '❌');
  console.log('- Guild:', models.Guild ? '✅' : '❌');
  console.log('- System:', models.System ? '✅' : '❌');
  
  // Test guild count
  try {
    const guildCount = await models.Guild.countDocuments();
    console.log(`\n📊 Found ${guildCount} guilds in database`);
    
    // Test swear tracker data
    const guildsWithSwears = await models.Guild.countDocuments({
      SwearTracker: { $exists: true, $ne: [] }
    });
    console.log(`📊 Found ${guildsWithSwears} guilds with swear tracking data`);
    
    if (guildsWithSwears > 0) {
      console.log('\n✅ Ready to run migration!');
    } else {
      console.log('\n⚠️  No swear tracking data found - migration not needed');
    }
    
  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    process.exit(1);
  }
  
  console.log('\n✅ Connection test completed successfully');
  process.exit(0);
}

testConnection().catch(error => {
  console.error('\n❌ Connection test failed:', error);
  process.exit(1);
});
