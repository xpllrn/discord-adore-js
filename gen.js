const fs = require('fs');
const path = require('path');

// Register module aliases
require('module-alias/register');

const commandsDir = path.join(__dirname, 'commands');
const outputFile = path.join(__dirname, 'commands.json');

const categories = {};

// Recursive function to find all .js files in a directory
function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to extract subcommands from a command file
function extractSubcommands(filePath) {
  const subcommands = [];
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Pattern 1: if (args[0] === 'subcommand') with subcommandInfo
    const ifPattern = /if\s*\(args\[0\]\s*===\s*['"]([^'"]+)['"]\)[\s\S]*?const subcommandInfo = \{[\s\S]*?description:\s*['"]([^'"]+)['"][\s\S]*?syntax:\s*['"]([^'"]+)['"][\s\S]*?(?:aliases:\s*\[([^\]]*)\])?/g;
    
    let match;
    while ((match = ifPattern.exec(fileContent)) !== null) {
      const aliasesStr = match[4] || '';
      const aliases = aliasesStr
        .split(',')
        .map(a => a.trim().replace(/['"]/g, ''))
        .filter(a => a.length > 0);
      
      subcommands.push({
        name: match[1],
        description: match[2],
        syntax: match[3],
        aliases: aliases
      });
    }
    
    // Pattern 2: else if (args[0] === 'subcommand') with subcommandInfo
    const elseIfPattern = /else if\s*\(args\[0\]\s*===\s*['"]([^'"]+)['"]\)[\s\S]*?const subcommandInfo = \{[\s\S]*?description:\s*['"]([^'"]+)['"][\s\S]*?syntax:\s*['"]([^'"]+)['"][\s\S]*?(?:aliases:\s*\[([^\]]*)\])?/g;
    
    while ((match = elseIfPattern.exec(fileContent)) !== null) {
      const name = match[1];
      if (subcommands.some(sc => sc.name === name)) continue;
      
      const aliasesStr = match[4] || '';
      const aliases = aliasesStr
        .split(',')
        .map(a => a.trim().replace(/['"]/g, ''))
        .filter(a => a.length > 0);
      
      subcommands.push({
        name: name,
        description: match[2],
        syntax: match[3],
        aliases: aliases
      });
    }
    
    // Pattern 3: case 'subcommand' with subcommandInfo
    const casePattern = /case\s+['"]([^'"]+)['"][\s\S]*?const subcommandInfo = \{[\s\S]*?description:\s*['"]([^'"]+)['"][\s\S]*?syntax:\s*['"]([^'"]+)['"][\s\S]*?(?:aliases:\s*\[([^\]]*)\])?/g;
    
    while ((match = casePattern.exec(fileContent)) !== null) {
      const name = match[1];
      if (subcommands.some(sc => sc.name === name)) continue;
      
      const aliasesStr = match[4] || '';
      const aliases = aliasesStr
        .split(',')
        .map(a => a.trim().replace(/['"]/g, ''))
        .filter(a => a.length > 0);
      
      subcommands.push({
        name: name,
        description: match[2],
        syntax: match[3],
        aliases: aliases
      });
    }
    
    // Pattern 4: subcommandInfo with explicit name field
    const namedPattern = /const subcommandInfo = \{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?description:\s*['"]([^'"]+)['"][\s\S]*?syntax:\s*['"]([^'"]+)['"][\s\S]*?(?:aliases:\s*\[([^\]]*)\])?[\s\S]*?\}/g;
    
    while ((match = namedPattern.exec(fileContent)) !== null) {
      const name = match[1];
      if (subcommands.some(sc => sc.name === name)) continue;
      
      const aliasesStr = match[4] || '';
      const aliases = aliasesStr
        .split(',')
        .map(a => a.trim().replace(/['"]/g, ''))
        .filter(a => a.length > 0);
      
      subcommands.push({
        name: match[1],
        description: match[2],
        syntax: match[3],
        aliases: aliases
      });
    }
  } catch (error) {
    // Silently fail for files that can't be read
  }
  
  return subcommands;
}

// Get all category folders
const categoryFolders = fs.readdirSync(commandsDir).filter(file => {
  return fs.statSync(path.join(commandsDir, file)).isDirectory();
});

// Loop through each category
categoryFolders.forEach(category => {
  const categoryPath = path.join(commandsDir, category);
  const commandFiles = getAllJsFiles(categoryPath);
  
  categories[category] = [];
  
  // Loop through each command file in the category
  commandFiles.forEach(filePath => {
    try {
      const command = require(filePath);
      
      const commandName = command.name || path.basename(filePath, '.js');
      
      // Skip developer commands (hide from public command list)
      if (command.permission === 'developer' || command.permission === 'dev') {
        return;
      }
      
      // Extract command info
      const commandInfo = {
        name: commandName,
        description: command.description || 'No description provided',
        aliases: command.aliases || [],
        syntax: (command.syntax || commandName).replace(/\{guildprefix\}/g, '').replace(/\{guild\.prefix\}/g, ''),
        permission: command.permission || null
      };
      
      categories[category].push(commandInfo);
      
      // Extract subcommands and add them as separate commands
      const subcommands = extractSubcommands(filePath);
      subcommands.forEach(sub => {
        const subCommandInfo = {
          name: `${commandName} ${sub.name}`,
          description: sub.description,
          aliases: sub.aliases.map(a => `${commandName} ${a}`).filter(a => a.trim().length > commandName.length),
          syntax: sub.syntax.replace(/\{guildprefix\}/g, '').replace(/\{guild\.prefix\}/g, ''),
          permission: command.permission || null
        };
        categories[category].push(subCommandInfo);
      });
    } catch (error) {
      const relativePath = path.relative(commandsDir, filePath);
      console.error(`Error loading ${relativePath}:`, error.message);
    }
  });
});

// Write to JSON file
fs.writeFileSync(outputFile, JSON.stringify(categories, null, 2));
console.log(`✅ Commands JSON generated successfully at: ${outputFile}`);
console.log(`📊 Total categories: ${Object.keys(categories).length}`);
console.log(`📝 Total commands: ${Object.values(categories).flat().length}`);
