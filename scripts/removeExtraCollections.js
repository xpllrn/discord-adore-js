/**
 * Remove Extra Collections Script
 * Removes collections that were accidentally created by non-existent services
 */

const mongoose = require('mongoose');
require('dotenv').config();

const COLLECTIONS_TO_REMOVE = [
  'welcomebuttons',
  'webhooks', 
  'spotifysessions',
  'storeitems'
];

async function removeExtraCollections() {
  try {
    console.log('Connecting to database...');
    
    // Connect to the database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to database');
    
    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('\nExisting collections:', collectionNames);
    
    // Remove extra collections
    for (const collectionName of COLLECTIONS_TO_REMOVE) {
      if (collectionNames.includes(collectionName)) {
        console.log(`\nDropping collection: ${collectionName}`);
        await mongoose.connection.db.dropCollection(collectionName);
        console.log(`✓ Dropped ${collectionName}`);
      } else {
        console.log(`\n✓ Collection ${collectionName} does not exist (already clean)`);
      }
    }
    
    // Show final collections
    const finalCollections = await mongoose.connection.db.listCollections().toArray();
    const finalCollectionNames = finalCollections.map(c => c.name);
    
    console.log('\n=== Final collections ===');
    finalCollectionNames.forEach(name => {
      console.log(`  - ${name}`);
    });
    
    console.log('\n✓ Cleanup complete!');
    
  } catch (error) {
    console.error('Error removing collections:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

removeExtraCollections();
