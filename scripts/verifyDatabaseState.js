/**
 * Verify Database State Script
 * Checks the current state of collections after the fix
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function verifyDatabaseState() {
  try {
    console.log('Connecting to database...');
    
    const db = mongoose.createConnection(process.env.USER_DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await new Promise((resolve) => db.once('open', resolve));
    
    console.log('Connected to database\n');
    
    // Get all collections
    const collections = await db.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('=== CURRENT COLLECTIONS ===');
    collectionNames.forEach(name => {
      console.log(`  ✓ ${name}`);
    });
    
    console.log('\n=== EXPECTED COLLECTIONS ===');
    const expected = ['users', 'guilds', 'systems'];
    expected.forEach(name => {
      const exists = collectionNames.includes(name);
      console.log(`  ${exists ? '✓' : '✗'} ${name}`);
    });
    
    console.log('\n=== UNEXPECTED COLLECTIONS ===');
    const unexpected = collectionNames.filter(name => !expected.includes(name));
    if (unexpected.length === 0) {
      console.log('  ✓ None - Database is clean!');
    } else {
      unexpected.forEach(name => {
        console.log(`  ✗ ${name} (should not exist)`);
      });
    }
    
    // Get collection stats
    console.log('\n=== COLLECTION STATS ===');
    for (const name of expected) {
      if (collectionNames.includes(name)) {
        const stats = await db.db.collection(name).stats();
        console.log(`  ${name}:`);
        console.log(`    - Documents: ${stats.count}`);
        console.log(`    - Size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
    }
    
    await db.close();
    console.log('\n✓ Verification complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error verifying database:', error);
    process.exit(1);
  }
}

verifyDatabaseState();
