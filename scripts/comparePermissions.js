const fs = require('fs');
const path = require('path');

// Permissions from the provided list
const providedPermissions = [
  'administrator',
  'ban_members',
  'kick_members',
  'manage_guild',
  'manage_channels',
  'manage_roles',
  'manage_messages',
  'view_audit_log',
  'manage_webhooks',
  'manage_expressions',
  'mute_members',
  'deafen_members',
  'move_members',
  'manage_nicknames',
  'mention_everyone',
  'view_guild_insights',
  'external_emojis',
  'change_nickname'
];

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

// Function to extract permission from a command file
function extractPermission(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const permissionMatch = content.match(/permission:\s*['"]([^'"]+)['"]/);
    
    if (permissionMatch) {
      return permissionMatch[1];
    }
  } catch (error) {
    // Ignore errors
  }
  
  return null;
}

// Normalize permission names for comparison
function normalizePermission(perm) {
  return perm.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/&/g, '')
    .trim();
}

// Main function
function main() {
  console.log('🔍 Comparing provided permissions with actual command usage...\n');

  const commandsDir = path.join(process.cwd(), 'commands');
  const allFiles = getAllJsFiles(commandsDir);
  
  const usedPermissions = new Set();

  // Extract all used permissions
  allFiles.forEach(file => {
    const perm = extractPermission(file);
    if (perm) {
      usedPermissions.add(perm);
    }
  });

  // Normalize used permissions
  const normalizedUsed = new Set(
    Array.from(usedPermissions).map(p => normalizePermission(p))
  );

  console.log('📋 PROVIDED PERMISSIONS LIST:');
  console.log('-'.repeat(80));
  providedPermissions.forEach((perm, index) => {
    console.log(`${index + 1}. ${perm}`);
  });

  console.log('\n\n📊 USED PERMISSIONS IN COMMANDS:');
  console.log('-'.repeat(80));
  Array.from(usedPermissions).sort().forEach((perm, index) => {
    console.log(`${index + 1}. "${perm}"`);
  });

  // Find permissions in provided list but NOT used in commands
  const notUsed = providedPermissions.filter(perm => {
    // Check if this permission (or similar variant) is used
    const normalized = normalizePermission(perm);
    
    // Check exact match
    if (normalizedUsed.has(normalized)) return false;
    
    // Check if any used permission contains this one
    for (let used of normalizedUsed) {
      if (used.includes(normalized) || normalized.includes(used)) {
        return false;
      }
    }
    
    return true;
  });

  // Find permissions used in commands but NOT in provided list
  const notInProvided = Array.from(usedPermissions).filter(perm => {
    const normalized = normalizePermission(perm);
    
    // Check if this permission exists in provided list
    for (let provided of providedPermissions) {
      if (normalized.includes(provided) || provided.includes(normalized.replace(/_/g, ''))) {
        return false;
      }
    }
    
    return true;
  });

  console.log('\n\n❌ PERMISSIONS IN PROVIDED LIST BUT NOT USED IN COMMANDS:');
  console.log('='.repeat(80));
  if (notUsed.length === 0) {
    console.log('✅ All provided permissions are being used!');
  } else {
    notUsed.forEach((perm, index) => {
      console.log(`${index + 1}. ${perm}`);
    });
  }

  console.log('\n\n⚠️  PERMISSIONS USED IN COMMANDS BUT NOT IN PROVIDED LIST:');
  console.log('='.repeat(80));
  if (notInProvided.length === 0) {
    console.log('✅ All used permissions are in the provided list!');
  } else {
    notInProvided.forEach((perm, index) => {
      console.log(`${index + 1}. "${perm}"`);
    });
  }

  console.log('\n\n📈 STATISTICS:');
  console.log('='.repeat(80));
  console.log(`Provided Permissions: ${providedPermissions.length}`);
  console.log(`Used Permissions: ${usedPermissions.size}`);
  console.log(`Not Used: ${notUsed.length}`);
  console.log(`Not in Provided List: ${notInProvided.length}`);

  console.log('\n✅ Comparison complete!');
}

// Run the script
main();
