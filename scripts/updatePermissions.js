const fs = require('fs');
const path = require('path');

// Permission mapping from old format to new format
const permissionMapping = {
  'Administrator': 'administrator',
  'Ban Members': 'ban_members',
  'Kick Members': 'kick_members',
  'Manage Guild': 'manage_guild',
  'Manage Server': 'manage_guild',
  'Manage Channels': 'manage_channels',
  'Manage Roles': 'manage_roles',
  'Manage Messages': 'manage_messages',
  'View Audit Log': 'view_audit_log',
  'Manage Webhooks': 'manage_webhooks',
  'Manage Expressions': 'manage_expressions',
  'Manage Emojis': 'manage_expressions',
  'Manage Stickers': 'manage_expressions',
  'Moderate Members': 'moderate_members',
  'Mute Members': 'mute_members',
  'Deafen Members': 'deafen_members',
  'Move Members': 'move_members',
  'Manage Nicknames': 'manage_nicknames',
  'Mention Everyone': 'mention_everyone',
  'View Guild Insights': 'view_guild_insights',
  'External Emojis': 'external_emojis',
  'Change Nickname': 'change_nickname',
  'Send Messages': 'send_messages',
  'Manage Guild & Manage Roles': 'manage_guild_and_manage_roles',
  // Keep custom permissions as-is
  'Server Booster': 'server_booster',
  'Server Owner': 'server_owner',
  'dev': 'dev',
  'user': 'user'
};

// Function to recursively get all .js files in a directory
function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Function to update permission in a file
function updatePermissionInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Match permission: 'value' or permission: "value"
    const permissionRegex = /permission:\s*(['"])([^'"]+)\1/g;
    
    content = content.replace(permissionRegex, (match, quote, oldPerm) => {
      const newPerm = permissionMapping[oldPerm];
      if (newPerm && newPerm !== oldPerm) {
        updated = true;
        return `permission: ${quote}${newPerm}${quote}`;
      }
      return match;
    });

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
  
  return false;
}

// Main function
function main() {
  console.log('🔄 Updating all permission fields to use underscores...\n');

  const commandsDir = path.join(process.cwd(), 'commands');
  const allFiles = getAllJsFiles(commandsDir);
  
  let updatedCount = 0;
  const updatedFiles = [];

  allFiles.forEach(file => {
    if (updatePermissionInFile(file)) {
      updatedCount++;
      updatedFiles.push(file.replace(process.cwd() + '/', ''));
    }
  });

  console.log('📊 UPDATE SUMMARY:');
  console.log('='.repeat(80));
  console.log(`Total Files Scanned: ${allFiles.length}`);
  console.log(`Files Updated: ${updatedCount}\n`);

  if (updatedFiles.length > 0) {
    console.log('📝 UPDATED FILES:');
    console.log('-'.repeat(80));
    updatedFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
  }

  console.log('\n✅ Update complete!');
  console.log('\n📋 NEW PERMISSION FORMAT:');
  console.log('-'.repeat(80));
  const uniquePerms = [...new Set(Object.values(permissionMapping))].sort();
  uniquePerms.forEach((perm, index) => {
    console.log(`${index + 1}. ${perm}`);
  });
}

// Run the script
main();
