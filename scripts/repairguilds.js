/**
 * Repair Missing Fields
 * 
 * This script fixes guilds that are missing fields (like Antinuke)
 * by directly updating the database with default values.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function repairMissingFields() {
  try {
    console.log('🔧 Connecting to database...\n');
    
    await mongoose.connect(process.env.GUILD_DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const Guild = mongoose.model('Guild', new mongoose.Schema({}, { strict: false }), 'guilds');
    
    console.log('✅ Connected! Starting repair...\n');
    console.log('='.repeat(80));
    
    // Get all guilds
    const allGuilds = await Guild.find({}).lean();
    console.log(`Found ${allGuilds.length} guilds to check\n`);
    
    // Check which guilds need repair
    const guildsToRepair = [];
    
    for (const guild of allGuilds) {
      const issues = [];
      
      if (!guild.Antinuke) issues.push('Antinuke');
      if (!guild.VoiceManager) issues.push('VoiceManager');
      if (!guild.LevelSystem) issues.push('LevelSystem');
      if (!guild.TicketSystem) issues.push('TicketSystem');
      if (!guild.Prefix) issues.push('Prefix');
      
      if (issues.length > 0) {
        guildsToRepair.push({
          guildId: guild.GuildID,
          issues: issues
        });
      }
    }
    
    if (guildsToRepair.length === 0) {
      console.log('✅ No guilds need repair! All data is intact.\n');
      return;
    }
    
    console.log(`⚠️  Found ${guildsToRepair.length} guilds that need repair:\n`);
    for (const guild of guildsToRepair) {
      console.log(`   ${guild.guildId}: Missing ${guild.issues.join(', ')}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🔧 Starting repair process...\n');
    
    // Define default values for missing fields
    const getDefaultAntinuke = () => ({
      enabled: false,
      whitelist: [],
      admins: [],
      modules: {},
      logs: []
    });
    
    const getDefaultVoiceManager = () => ({
      enabled: false,
      categoryId: null,
      joinChannelId: null,
      mutedChannelId: null,
      tempChannels: [],
      inviteCooldowns: []
    });
    
    const getDefaultLevelSystem = () => ({
      enabled: false,
      messageMode: 'context',
      levelUpChannel: null,
      levelRoles: [],
      lastSyncTime: null,
      xpRate: 1,
      stackRoles: true
    });
    
    const getDefaultTicketSystem = () => ({
      enabled: false,
      categoryId: null,
      supportRoleId: null,
      setupChannelId: null,
      setupMessageId: null,
      activeTickets: [],
      ticketCounter: 0
    });
    
    let repaired = 0;
    let failed = 0;
    
    for (const guild of guildsToRepair) {
      try {
        console.log(`Repairing ${guild.guildId}...`);
        
        // Build update object with only missing fields
        const updateFields = {};
        
        if (guild.issues.includes('Antinuke')) {
          updateFields.Antinuke = getDefaultAntinuke();
        }
        if (guild.issues.includes('VoiceManager')) {
          updateFields.VoiceManager = getDefaultVoiceManager();
        }
        if (guild.issues.includes('LevelSystem')) {
          updateFields.LevelSystem = getDefaultLevelSystem();
        }
        if (guild.issues.includes('TicketSystem')) {
          updateFields.TicketSystem = getDefaultTicketSystem();
        }
        if (guild.issues.includes('Prefix')) {
          updateFields.Prefix = ',';
        }
        
        // Update the guild with missing fields
        await Guild.updateOne(
          { GuildID: guild.guildId },
          { $set: updateFields }
        );
        
        // Verify the repair worked
        const updated = await Guild.findOne({ GuildID: guild.guildId }).lean();
        const stillMissing = [];
        
        if (!updated.Antinuke) stillMissing.push('Antinuke');
        if (!updated.VoiceManager) stillMissing.push('VoiceManager');
        if (!updated.LevelSystem) stillMissing.push('LevelSystem');
        if (!updated.TicketSystem) stillMissing.push('TicketSystem');
        if (!updated.Prefix) stillMissing.push('Prefix');
        
        if (stillMissing.length === 0) {
          console.log(`   ✅ Repaired successfully (added: ${guild.issues.join(', ')})\n`);
          repaired++;
        } else {
          console.log(`   ⚠️  Still missing: ${stillMissing.join(', ')}\n`);
          failed++;
        }
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        failed++;
      }
    }
    
    console.log('='.repeat(80));
    console.log('📊 REPAIR SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total guilds checked: ${allGuilds.length}`);
    console.log(`Guilds needing repair: ${guildsToRepair.length}`);
    console.log(`Successfully repaired: ${repaired}`);
    console.log(`Failed to repair: ${failed}`);
    
    if (repaired === guildsToRepair.length) {
      console.log('\n✅ All guilds repaired successfully!');
      console.log('\n💡 The fix in GuildService.js will prevent this from happening again.');
      console.log('   Missing fields will now be automatically saved when ensureGuildData() is called.');
    } else if (failed > 0) {
      console.log('\n⚠️  Some guilds could not be repaired. Check the errors above.');
    }
    
  } catch (error) {
    console.error('❌ Error during repair:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the repair
repairMissingFields();
