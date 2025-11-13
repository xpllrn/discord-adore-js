/**
 * Check specific guild data
 */

const { initializeDatabase, getModels } = require('../database');
const config = require('../config/setup');

const GUILD_ID = '1431034951909904435';

async function checkGuild() {
  console.log(`🔍 Checking guild ${GUILD_ID}...\n`);

  try {
    // Initialize database
    const connected = await initializeDatabase({
      user: config.database.userConnection,
      guild: config.database.guildConnection
    });

    if (!connected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    const models = getModels();
    const { Guild } = models;

    // Find the guild
    const guild = await Guild.findOne({ GuildID: GUILD_ID });

    if (!guild) {
      console.log('❌ Guild not found in database!\n');
      console.log('This means the bot has never been configured in this server,');
      console.log('or the data was manually deleted from the database.\n');
      process.exit(1);
    }

    console.log('✅ Guild found in database!\n');
    
    // Convert to plain object for easier inspection
    const guildData = guild.toObject();
    
    // Show all data
    console.log('📊 Guild Data Summary:');
    console.log('═══════════════════════════════════════\n');
    
    // Basic info
    console.log('🔧 Basic Settings:');
    console.log(`   Prefix: ${guildData.Prefix || 'Not set'}`);
    console.log(`   Total fields: ${Object.keys(guildData).length}`);
    console.log('');
    
    // AutoRoles
    console.log('🎭 AutoRoles:');
    if (guildData.AutoRoles && guildData.AutoRoles.length > 0) {
      console.log(`   ✓ ${guildData.AutoRoles.length} autorole(s) configured`);
      guildData.AutoRoles.forEach((ar, i) => {
        console.log(`   ${i + 1}. Role: ${ar.roleId}`);
      });
    } else {
      console.log('   ✗ No autoroles configured');
    }
    console.log('');
    
    // Welcome
    console.log('👋 Welcome System:');
    if (guildData.Welcome) {
      console.log(`   Enabled: ${guildData.Welcome.enabled ? '✓' : '✗'}`);
      if (guildData.Welcome.channelId) {
        console.log(`   Channel: ${guildData.Welcome.channelId}`);
      }
      if (guildData.Welcome.message) {
        console.log(`   Message: ${guildData.Welcome.message.substring(0, 50)}...`);
      }
      if (guildData.Welcome.embed) {
        console.log(`   Embed: Configured`);
      }
    } else {
      console.log('   ✗ Not configured');
    }
    console.log('');
    
    // Leave
    console.log('👋 Leave System:');
    if (guildData.Leave) {
      console.log(`   Enabled: ${guildData.Leave.enabled ? '✓' : '✗'}`);
      if (guildData.Leave.channelId) {
        console.log(`   Channel: ${guildData.Leave.channelId}`);
      }
    } else {
      console.log('   ✗ Not configured');
    }
    console.log('');
    
    // Boost
    console.log('🚀 Boost System:');
    if (guildData.Boost) {
      console.log(`   Enabled: ${guildData.Boost.enabled ? '✓' : '✗'}`);
      if (guildData.Boost.channelId) {
        console.log(`   Channel: ${guildData.Boost.channelId}`);
      }
    } else {
      console.log('   ✗ Not configured');
    }
    console.log('');
    
    // Giveaways
    console.log('🎉 Giveaways:');
    if (guildData.Giveaways && guildData.Giveaways.length > 0) {
      console.log(`   ✓ ${guildData.Giveaways.length} giveaway(s)`);
      guildData.Giveaways.forEach((g, i) => {
        console.log(`   ${i + 1}. ${g.title} - ${g.ended ? 'Ended' : 'Active'}`);
      });
    } else {
      console.log('   ✗ No giveaways');
    }
    console.log('');
    
    // Aliases
    console.log('⚡ Aliases:');
    if (guildData.Aliases && guildData.Aliases.length > 0) {
      console.log(`   ✓ ${guildData.Aliases.length} alias(es)`);
      guildData.Aliases.forEach((a, i) => {
        console.log(`   ${i + 1}. ${a.shortcut} → ${a.command}`);
      });
    } else {
      console.log('   ✗ No aliases');
    }
    console.log('');
    
    // Antinuke
    console.log('🛡️  Antinuke:');
    if (guildData.Antinuke) {
      console.log(`   Enabled: ${guildData.Antinuke.enabled ? '✓' : '✗'}`);
      if (guildData.Antinuke.whitelist && guildData.Antinuke.whitelist.length > 0) {
        console.log(`   Whitelist: ${guildData.Antinuke.whitelist.length} user(s)`);
      }
    } else {
      console.log('   ✗ Not configured');
    }
    console.log('');
    
    // Logs
    console.log('📝 Logging:');
    if (guildData.Logs) {
      console.log(`   Enabled: ${guildData.Logs.enabled ? '✓' : '✗'}`);
      if (guildData.Logs.channelId) {
        console.log(`   Channel: ${guildData.Logs.channelId}`);
      }
    } else {
      console.log('   ✗ Not configured');
    }
    console.log('');
    
    // Starboard
    console.log('⭐ Starboard:');
    if (guildData.Starboard) {
      console.log(`   Enabled: ${guildData.Starboard.enabled ? '✓' : '✗'}`);
      if (guildData.Starboard.channelId) {
        console.log(`   Channel: ${guildData.Starboard.channelId}`);
        console.log(`   Threshold: ${guildData.Starboard.threshold || 3} stars`);
      }
    } else {
      console.log('   ✗ Not configured');
    }
    console.log('');
    
    // VoiceMaster
    console.log('🎤 VoiceMaster:');
    if (guildData.VoiceMaster) {
      console.log(`   Enabled: ${guildData.VoiceMaster.enabled ? '✓' : '✗'}`);
      if (guildData.VoiceMaster.categoryId) {
        console.log(`   Category: ${guildData.VoiceMaster.categoryId}`);
      }
      if (guildData.VoiceMaster.joinToCreateId) {
        console.log(`   Join to Create: ${guildData.VoiceMaster.joinToCreateId}`);
      }
    } else {
      console.log('   ✗ Not configured');
    }
    console.log('');
    
    // Show raw data for debugging
    console.log('═══════════════════════════════════════');
    console.log('📄 Full Raw Data (JSON):');
    console.log('═══════════════════════════════════════\n');
    console.log(JSON.stringify(guildData, null, 2));
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkGuild();
