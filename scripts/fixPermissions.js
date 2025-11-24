const fs = require('fs');
const path = require('path');

// Files to update manually
const manualFixes = {
  'commands/fun/random/blacktea.js': {
    old: "permission: 'user'",
    new: "// No permission required - any user can play",
    comment: "Remove 'user' permission - it's not a real permission"
  },
  'commands/fun/random/quote.js': {
    old: "permission: \"send_messages\"",
    new: "// No special permission required",
    comment: "Remove 'send_messages' - users need this to use commands anyway"
  },
  'commands/dev/admin/blacklist.js': {
    old: "permission: 'dev'",
    new: "permission: 'developer'",
    comment: "Rename dev to developer"
  },
  'commands/dev/admin/clear.js': {
    old: "permission: 'dev'",
    new: "permission: 'developer'",
    comment: "Rename dev to developer"
  },
  'commands/dev/admin/eco.js': {
    old: "permission: 'dev'",
    new: "permission: 'developer'",
    comment: "Rename dev to developer"
  },
  'commands/dev/admin/fetch.js': {
    old: "permission: 'dev'",
    new: "permission: 'developer'",
    comment: "Rename dev to developer"
  },
  'commands/dev/admin/restart.js': {
    old: "permission: 'dev'",
    new: "permission: 'developer'",
    comment: "Rename dev to developer"
  },
  'commands/server/roles/boostrole.js': {
    old: "permission: 'server_booster'",
    new: "permission: 'Server Booster'",
    comment: "Keep readable format for custom permission"
  },
  'commands/server/settings/customize.js': {
    old: "permission: 'server_owner'",
    new: "permission: 'Server Owner'",
    comment: "Keep readable format for custom permission"
  }
};

function applyFixes() {
  console.log('🔧 Applying permission fixes...\n');
  
  let fixedCount = 0;
  
  for (const [filePath, fix] of Object.entries(manualFixes)) {
    const fullPath = path.join(process.cwd(), filePath);
    
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (content.includes(fix.old)) {
        content = content.replace(fix.old, fix.new);
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ ${filePath}`);
        console.log(`   ${fix.comment}\n`);
        fixedCount++;
      } else {
        console.log(`⚠️  ${filePath}`);
        console.log(`   Pattern not found: ${fix.old}\n`);
      }
    } catch (error) {
      console.log(`❌ ${filePath}`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  console.log(`\n📊 Fixed ${fixedCount}/${Object.keys(manualFixes).length} files\n`);
  
  console.log('📋 PERMISSION CATEGORIES:\n');
  console.log('✅ Discord Permissions (with underscores):');
  console.log('   - administrator');
  console.log('   - ban_members');
  console.log('   - kick_members');
  console.log('   - manage_guild');
  console.log('   - manage_channels');
  console.log('   - manage_roles');
  console.log('   - manage_messages');
  console.log('   - manage_expressions');
  console.log('   - manage_nicknames');
  console.log('   - moderate_members');
  console.log('   - etc...\n');
  
  console.log('🔧 Custom Permissions (readable format):');
  console.log('   - developer (for bot developers)');
  console.log('   - Server Booster (for server boosters)');
  console.log('   - Server Owner (for server owner only)\n');
  
  console.log('⚠️  SPECIAL CASE:');
  console.log('   - manage_guild_and_manage_roles in autorole.js');
  console.log('   - This should be handled with TWO separate permission checks');
  console.log('   - Not a single permission string\n');
}

applyFixes();
