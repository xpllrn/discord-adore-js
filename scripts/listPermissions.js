const fs = require('fs');
const path = require('path');

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
    
    // Match permission: 'value' or permission: "value"
    const permissionMatch = content.match(/permission:\s*['"]([^'"]+)['"]/);
    
    if (permissionMatch) {
      return {
        file: filePath.replace(process.cwd() + '/', ''),
        permission: permissionMatch[1]
      };
    }
  } catch (error) {
    // Ignore errors
  }
  
  return null;
}

// Main function
function main() {
  console.log('🔍 Scanning all command files for permissions...\n');

  const commandsDir = path.join(process.cwd(), 'commands');
  const allFiles = getAllJsFiles(commandsDir);
  
  const permissionsMap = new Map();
  const commandsWithPermissions = [];

  // Extract permissions from all files
  allFiles.forEach(file => {
    const result = extractPermission(file);
    if (result) {
      commandsWithPermissions.push(result);
      
      if (!permissionsMap.has(result.permission)) {
        permissionsMap.set(result.permission, []);
      }
      permissionsMap.get(result.permission).push(result.file);
    }
  });

  // Sort permissions alphabetically
  const sortedPermissions = Array.from(permissionsMap.keys()).sort();

  console.log('📊 PERMISSION USAGE SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Commands with Permissions: ${commandsWithPermissions.length}`);
  console.log(`Unique Permissions Used: ${sortedPermissions.length}\n`);

  console.log('📋 ALL UNIQUE PERMISSIONS:');
  console.log('-'.repeat(80));
  sortedPermissions.forEach((perm, index) => {
    const count = permissionsMap.get(perm).length;
    console.log(`${index + 1}. "${perm}" - Used in ${count} command(s)`);
  });

  console.log('\n\n📁 DETAILED BREAKDOWN BY PERMISSION:');
  console.log('='.repeat(80));

  sortedPermissions.forEach(perm => {
    const files = permissionsMap.get(perm);
    console.log(`\n🔐 ${perm} (${files.length} commands):`);
    files.forEach(file => {
      console.log(`   - ${file}`);
    });
  });

  console.log('\n\n✅ Scan complete!');
}

// Run the script
main();
