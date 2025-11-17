/**
 * Data Corruption Checker
 * 
 * Checks for data corruption and saves results to logs/corruption-check.txt
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const guildSchema = new mongoose.Schema({
  GuildID: String,
  Prefix: String,
  Webhooks: Array,
  VoiceManager: Object,
  LevelSystem: Object,
  Antinuke: Object,
  TicketSystem: Object,
}, { strict: false });

async function checkDataCorruption() {
  const logLines = [];
  const log = (message) => {
    console.log(message);
    logLines.push(message);
  };

  // Create a separate connection instance to avoid conflicts
  const connection = mongoose.createConnection();

  try {
    log(`🔍 Corruption Check - ${new Date().toISOString()}\n`);
    log('='.repeat(80));
    
    await connection.openUri(process.env.GUILD_DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Use the connection-specific model
    const Guild = connection.model('Guild', guildSchema, 'guilds');
    
    const allGuilds = await Guild.find({}).lean();
    const corruptedGuilds = [];
    
    // Check for missing fields
    for (const guild of allGuilds) {
      const issues = [];
      if (!guild.VoiceManager) issues.push('VoiceManager');
      if (!guild.LevelSystem) issues.push('LevelSystem');
      if (!guild.Antinuke) issues.push('Antinuke');
      if (!guild.TicketSystem) issues.push('TicketSystem');
      if (!guild.Prefix) issues.push('Prefix');
      
      if (issues.length > 0) {
        corruptedGuilds.push({ guildId: guild.GuildID, issues });
      }
    }
    
    if (corruptedGuilds.length > 0) {
      log(`\n⚠️  Found ${corruptedGuilds.length} guilds with missing data:`);
      for (const guild of corruptedGuilds) {
        log(`   ${guild.guildId}: Missing ${guild.issues.join(', ')}`);
      }
    } else {
      log('\n✅ No guilds with missing nested objects');
    }
    
    // Check for webhook corruption
    const webhookAsGuild = await Guild.find({
      $or: [
        { webhookId: { $exists: true } },
        { webhookToken: { $exists: true } },
        { $and: [{ name: { $exists: true } }, { Prefix: { $exists: false } }] }
      ]
    }).lean();
    
    if (webhookAsGuild.length > 0) {
      log(`\n🚨 CRITICAL: Found ${webhookAsGuild.length} guild documents that are webhook data!`);
    } else {
      log('\n✅ No webhook data masquerading as guild data');
    }
    
    // Summary
    log('\n' + '='.repeat(80));
    log('📊 SUMMARY');
    log('='.repeat(80));
    log(`Total guilds: ${allGuilds.length}`);
    log(`Corrupted guilds: ${corruptedGuilds.length}`);
    log(`Webhook corruption: ${webhookAsGuild.length}`);
    
    if (corruptedGuilds.length === 0 && webhookAsGuild.length === 0) {
      log('\n✅ Database healthy - No corruption detected');
    } else {
      log('\n⚠️  Corruption detected - Run: node scripts/repairguilds.js');
    }
    
    // Save to file
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'corruption-check.txt');
    fs.writeFileSync(logFile, logLines.join('\n'));
    log(`\n📝 Log saved to: logs/corruption-check.txt`);
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`);
  } finally {
    await connection.close();
    log('🔌 Disconnected\n');
  }
}

checkDataCorruption();
