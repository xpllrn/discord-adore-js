/**
 * Remove Extra Collections Script
 * Removes collections that were accidentally created by non-existent services
 */

const mongoose = require('mongoose');
require('dotenv').config();

const COLLECTIONS_TO_REMOVE = [
  'welcomebuttons',
  'welcomeButtons',
  'webhooks', 
  'spotifysessions',
  'spotifyauthsessions',
  'storeitems',
  'sprints'  // This should also be removed as it's not in the models
];

async function removeExtraCollections() {
  try {
    console.log('Connecting to databases...');
    
    // Connect to both databases
    const userDb = mongoose.createConnection(process.env.USER_DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const guildDb = mongoose.createConnection(process.env.GUILD_DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Wait for connections to be ready
    await Promise.all([
      new Promise((resolve) => userDb.once('open', resolve)),
      new Promise((resolve) => guildDb.once('open', resolve))
    ]);
    
    console.log('Connected to databases');
    
    // Check and clean USER database
    console.log('\n=== USER DATABASE ===');
    const userCollections = await userDb.db.listCollections().toArray();
    const userCollectionNames = userCollections.map(c => c.name);
    console.log('Existing collections:', userCollectionNames);
    
    for (const collectionName of COLLECTIONS_TO_REMOVE) {
      if (userCollectionNames.includes(collectionName)) {
        console.log(`Dropping collection: ${collectionName}`);
        await userDb.db.dropCollection(collectionName);
        console.log(`✓ Dropped ${collectionName}`);
      }
    }
    
    // Check and clean GUILD database
    console.log('\n=== GUILD DATABASE ===');
    const guildCollections = await guildDb.db.listCollections().toArray();
    const guildCollectionNames = guildCollections.map(c => c.name);
    console.log('Existing collections:', guildCollectionNames);
    
    for (const collectionName of COLLECTIONS_TO_REMOVE) {
      if (guildCollectionNames.includes(collectionName)) {
        console.log(`Dropping collection: ${collectionName}`);
        await guildDb.db.dropCollection(collectionName);
        console.log(`✓ Dropped ${collectionName}`);
      }
    }
    
    // Show final collections
    console.log('\n=== FINAL STATE ===');
    const finalUserCollections = await userDb.db.listCollections().toArray();
    console.log('User DB collections:', finalUserCollections.map(c => c.name));
    
    const finalGuildCollections = await guildDb.db.listCollections().toArray();
    console.log('Guild DB collections:', finalGuildCollections.map(c => c.name));
    
    console.log('\n✓ Cleanup complete!');
    
    await userDb.close();
    await guildDb.close();
    
  } catch (error) {
    console.error('Error removing collections:', error);
    process.exit(1);
  }
}

removeExtraCollections();
