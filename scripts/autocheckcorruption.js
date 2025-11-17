/**
 * Auto Corruption Check
 * 
 * Runs automatically on bot startup to check for data corruption
 * Saves results to logs/corruption-check.txt
 */

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

async function autoCheckCorruption() {
  const logLines = [];
  const log = (message) => {
    logLines.push(message);
  };

  try {
    log(`[${new Date().toISOString()}] Auto Corruption Check Started`);
    
    const dbUrl = process.env.GUILD_DATABASE;
    if (!dbUrl) {
      log('⚠️  GUILD_DATABASE not configured, skipping check');
      return;
    }

    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Check if model already exists to avoid overwrite error
    const Guild = mongoose.models.Guild || mongoose.model('Guild', guildSchema, 'guilds');
    const allGuilds = await Guild.find({}).lean();
    const corruptedGuilds = [];
    
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
    
    const webhookAsGuild = await Guild.find({
      $or: [
        { webhookId: { $exists: true } },
        { webhookToken: { $exists: true } }
      ]
    }).lean();
    
    log(`Total guilds: ${allGuilds.length}`);
    log(`Corrupted: ${corruptedGuilds.length}`);
    log(`Webhook corruption: ${webhookAsGuild.length}`);
    
    if (corruptedGuilds.length > 0) {
      log('⚠️  CORRUPTION DETECTED:');
      for (const guild of corruptedGuilds) {
        log(`   ${guild.guildId}: ${guild.issues.join(', ')}`);
      }
      console.log(`⚠️  [Corruption Check] Found ${corruptedGuilds.length} corrupted guilds - Check logs/corruption-check.txt`);
    } else {
      log('✅ Database healthy');
      console.log('✅ [Corruption Check] Database healthy');
    }
    
    await mongoose.disconnect();
    log('Check completed\n');
    
    // Save to file
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'corruption-check.txt');
    const existingLogs = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    fs.writeFileSync(logFile, existingLogs + logLines.join('\n') + '\n');
    
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    console.error('❌ [Corruption Check] Failed:', error.message);
  }
}

module.exports = { autoCheckCorruption };
