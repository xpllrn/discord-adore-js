const mongoose = require('mongoose');

const NEW_DB = 'mongodb://USER:PASSWORD@HOST:PORT/DATABASE

async function testNewDBSpeed() {
  try {
    console.log('Testing NEW MongoDB speed...\n');
    
    // Test connection time
    const connectStart = Date.now();
    await mongoose.connect(NEW_DB);
    const connectTime = Date.now() - connectStart;
    console.log(`✓ Connection time: ${connectTime}ms`);
    
    // Test ping
    const pingStart = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingTime = Date.now() - pingStart;
    console.log(`✓ Ping time: ${pingTime}ms`);
    
    // Test simple query
    const Guild = mongoose.connection.collection('guilds');
    const queryStart = Date.now();
    await Guild.findOne({ GuildID: '1429869368887476446' }, { projection: { GuildID: 1, Prefix: 1 } });
    const queryTime = Date.now() - queryStart;
    console.log(`✓ Simple query (2 fields): ${queryTime}ms`);
    
    // Test full document query
    const fullStart = Date.now();
    const fullDoc = await Guild.findOne({ GuildID: '1429869368887476446' });
    const fullTime = Date.now() - fullStart;
    const docSize = JSON.stringify(fullDoc).length;
    console.log(`✓ Full document query: ${fullTime}ms (${(docSize / 1024).toFixed(0)}KB)`);
    
    console.log('\n--- Comparison to Old DB ---');
    console.log('Old DB ping: 352ms → New DB ping: ' + pingTime + 'ms (' + Math.round((1 - pingTime/352) * 100) + '% faster)');
    console.log('Old DB full query: 2436ms → New DB full query: ' + fullTime + 'ms (' + Math.round((1 - fullTime/2436) * 100) + '% faster)');
    
    if (pingTime < 50) {
      console.log('\n✅ EXCELLENT! Network latency is great (<50ms)');
    } else if (pingTime < 100) {
      console.log('\n✅ GOOD! Network latency is acceptable (<100ms)');
    } else {
      console.log('\n⚠️  Still high latency. Check if MongoDB is on same VPS as bot.');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testNewDBSpeed();
