require('dotenv').config();
const mongoose = require('mongoose');

const OLD_DB = process.env.GUILD_DATABASE;
const NEW_DB = 'mongodb://USER:PASSWORD@HOST:PORT/DATABASE

async function migrateDatabase() {
  try {
    console.log('🔄 Starting database migration...\n');
    
    // Connect to old database
    console.log('📡 Connecting to old database...');
    const oldConn = await mongoose.createConnection(OLD_DB).asPromise();
    console.log('✓ Connected to old database\n');
    
    // Connect to new database
    console.log('📡 Connecting to new database...');
    const newConn = await mongoose.createConnection(NEW_DB).asPromise();
    console.log('✓ Connected to new database\n');
    
    // Get collections from old database
    const collections = await oldConn.db.listCollections().toArray();
    console.log(`📦 Found ${collections.length} collections to migrate:\n`);
    
    for (const collInfo of collections) {
      const collName = collInfo.name;
      console.log(`  Migrating: ${collName}...`);
      
      const oldColl = oldConn.db.collection(collName);
      const newColl = newConn.db.collection(collName);
      
      // Get all documents
      const docs = await oldColl.find({}).toArray();
      
      if (docs.length > 0) {
        // Insert into new database
        await newColl.insertMany(docs, { ordered: false });
        console.log(`  ✓ Migrated ${docs.length} documents from ${collName}`);
      } else {
        console.log(`  ⊘ ${collName} is empty, skipping`);
      }
    }
    
    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Update .env file with new connection string');
    console.log('2. Restart the bot');
    console.log('3. Test that everything works');
    console.log('4. Delete old database once confirmed\n');
    
    await oldConn.close();
    await newConn.close();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrateDatabase();
