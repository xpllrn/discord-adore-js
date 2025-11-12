#!/usr/bin/env node

/**
 * Command JSON Generator Script
 * 
 * This script:
 * 1. Scans all command files
 * 2. Extracts command information (name, category, aliases, description, usage, permission)
 * 3. For group commands, includes all subcommands
 * 4. Generates a JSON file with all command data
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const commandsDir = path.join(__dirname, '..', 'commands');
const outputFile = path.join(__dirname, '..', 'commands.json');

/**
 * Recursively find all .js files in a directory
 */
function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Get category from file path
 */
function getCategoryFromPath(filePath) {
  const relativePath = path.relative(commandsDir, filePath);
  const parts = relativePath.split(path.sep);
  
  // Category is the first directory name
  if (parts.length > 1) {
    return parts[0];
  }
  
  return 'uncategorized';
}

/**
 * Parse subcommands from command file
 */
function parseSubcommands(commandFilePath, commandName) {
  try {
    const fileContent = fs.readFileSync(commandFilePath, 'utf8');
    const subcommands = [];
    
    // Regex to find subcommand blocks with subcommandInfo
    const subcommandBlockRegex = /(?:case\s+['"](\w+)['"]\s*:|if\s*\(\s*(?:args\[0\]|subcommand)\s*===\s*['"](\w+)['"])\s*\{[\s\S]*?const\s+subcommandInfo\s*=\s*\{([\s\S]*?)\};/g;
    
    let match;
    while ((match = subcommandBlockRegex.exec(fileContent)) !== null) {
      const subcommandName = match[1] || match[2];
      const subcommandInfoContent = match[3];
      
      const subcommandData = parseSubcommandInfo(subcommandInfoContent, subcommandName, commandName);
      
      // Extract aliases from the case statement
      const caseBlock = match[0];
      const aliases = extractAliasesFromCase(caseBlock, subcommandName);
      if (aliases.length > 0) {
        subcommandData.aliases = [...new Set([...subcommandData.aliases, ...aliases])];
      }
      
      subcommands.push(subcommandData);
    }
    
    return subcommands;
  } catch (error) {
    console.error(`Error parsing subcommands from ${commandFilePath}:`, error.message);
    return [];
  }
}

/**
 * Extract aliases from case block
 */
function extractAliasesFromCase(caseBlock, mainName) {
  const aliases = [];
  const caseRegex = /case\s+['"](\w+)['"]\s*:/g;
  let match;
  
  while ((match = caseRegex.exec(caseBlock)) !== null) {
    const name = match[1];
    if (name !== mainName) {
      aliases.push(name);
    }
  }
  
  return aliases;
}

/**
 * Parse subcommandInfo object
 */
function parseSubcommandInfo(objectContent, subcommandName, commandName) {
  const subcommandData = {
    name: subcommandName,
    fullCommand: `${commandName} ${subcommandName}`,
    description: '',
    aliases: [],
    usage: ''
  };
  
  // Extract description
  const descMatch = objectContent.match(/description:\s*[`'"]([^`'"]*)[`'"]/);
  if (descMatch) {
    subcommandData.description = descMatch[1];
  }
  
  // Extract usage
  const usageMatch = objectContent.match(/usage:\s*[`'"]([^`'"]*)[`'"]/);
  if (usageMatch) {
    subcommandData.usage = usageMatch[1];
  }
  
  // Extract example
  const exampleMatch = objectContent.match(/example:\s*[`'"]([^`'"]*)[`'"]/);
  if (exampleMatch) {
    if (subcommandData.usage) {
      subcommandData.usage += '\n' + exampleMatch[1];
    } else {
      subcommandData.usage = exampleMatch[1];
    }
  }
  
  // Extract aliases array
  const aliasesMatch = objectContent.match(/aliases:\s*\[(.*?)\]/s);
  if (aliasesMatch) {
    const aliasesStr = aliasesMatch[1];
    const aliases = aliasesStr.match(/['"](\w+)['"]/g);
    if (aliases) {
      subcommandData.aliases = aliases.map(a => a.replace(/['"]/g, ''));
    }
  }
  
  return subcommandData;
}

/**
 * Parse command data from file content
 */
function parseCommandFromFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const category = getCategoryFromPath(filePath);
    
    // Extract module.exports block - match until the run function
    // Try multiple patterns to catch different formats
    let exportsContent = null;
    
    // Pattern 1: run: async
    let match = fileContent.match(/module\.exports\s*=\s*\{([\s\S]*?)run:\s*async/);
    if (match) {
      exportsContent = match[1];
    } else {
      // Pattern 2: run: (
      match = fileContent.match(/module\.exports\s*=\s*\{([\s\S]*?)run:\s*\(/);
      if (match) {
        exportsContent = match[1];
      } else {
        // Pattern 3: run: createRoleplayCommand or other function calls
        match = fileContent.match(/module\.exports\s*=\s*\{([\s\S]*?)run:\s*\w+/);
        if (match) {
          exportsContent = match[1];
        } else {
          return null;
        }
      }
    }
    
    // Extract command properties
    const nameMatch = exportsContent.match(/name:\s*["']([^"']+)["']/);
    if (!nameMatch) {
      return null;
    }
    
    const name = nameMatch[1];
    
    // Extract aliases
    const aliasesMatch = exportsContent.match(/aliases:\s*\[(.*?)\]/s);
    let aliases = [];
    if (aliasesMatch) {
      const aliasesStr = aliasesMatch[1];
      const aliasMatches = aliasesStr.match(/["']([^"']+)["']/g);
      if (aliasMatches) {
        aliases = aliasMatches.map(a => a.replace(/["']/g, ''));
      }
    }
    
    // Extract description
    const descMatch = exportsContent.match(/description:\s*[`"']([^`"']*)[`"']/);
    const description = descMatch ? descMatch[1] : 'No description available';
    
    // Extract permission
    const permMatch = exportsContent.match(/permission:\s*["']([^"']+)["']/);
    const permission = permMatch ? permMatch[1] : null;
    
    // Check if group command
    const isGroupCommand = /isGroupCommand:\s*true/.test(exportsContent);
    
    const commandData = {
      name: name,
      category: category,
      aliases: aliases,
      description: description,
      permission: permission
    };
    
    // Handle group commands with subcommands
    if (isGroupCommand) {
      const subcommands = parseSubcommands(filePath, name);
      
      if (subcommands.length > 0) {
        commandData.subcommands = subcommands.map(sub => ({
          name: sub.name,
          aliases: sub.aliases,
          description: sub.description,
          usage: sub.usage
        }));
        
        // For group commands, usage is generic
        commandData.usage = `{guildprefix}${name} (subcommand) <args>`;
      } else {
        // Fallback if no subcommands found
        const syntaxMatch = exportsContent.match(/syntax:\s*["']([^"']+)["']/);
        const exampleMatch = exportsContent.match(/example:\s*["']([^"']+)["']/);
        
        if (syntaxMatch) {
          commandData.usage = `{guildprefix}${syntaxMatch[1]}`;
          if (exampleMatch) {
            commandData.usage += `\n{guildprefix}${exampleMatch[1]}`;
          }
        } else {
          commandData.usage = `{guildprefix}${name}`;
        }
      }
    } else {
      // Single commands
      const syntaxMatch = exportsContent.match(/syntax:\s*["']([^"']+)["']/);
      const exampleMatch = exportsContent.match(/example:\s*["']([^"']+)["']/);
      
      const usageParts = [];
      
      if (syntaxMatch) {
        usageParts.push(`{guildprefix}${syntaxMatch[1]}`);
      }
      
      if (exampleMatch) {
        usageParts.push(`{guildprefix}${exampleMatch[1]}`);
      }
      
      commandData.usage = usageParts.length > 0 
        ? usageParts.join('\n')
        : `{guildprefix}${name}`;
    }
    
    return commandData;
  } catch (error) {
    console.error(`Error parsing command from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Main execution
 */
function main() {
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║     Command JSON Generator                            ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.blue}📂 Scanning commands directory...${colors.reset}\n`);

  const commandFiles = findJsFiles(commandsDir);
  console.log(`${colors.green}✓ Found ${commandFiles.length} command files${colors.reset}\n`);

  console.log(`${colors.blue}🔧 Processing commands...${colors.reset}\n`);

  const commands = [];
  const skippedFiles = [];
  let processed = 0;
  let skipped = 0;

  commandFiles.forEach(filePath => {
    const commandData = parseCommandFromFile(filePath);
    
    if (commandData) {
      commands.push(commandData);
      processed++;
    } else {
      skipped++;
      skippedFiles.push(path.relative(commandsDir, filePath));
    }
  });

  // Filter out dev commands
  const filteredCommands = commands.filter(cmd => cmd.category !== 'dev' && cmd.permission !== 'dev');

  // Sort commands by category, then by name
  filteredCommands.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  // Generate JSON
  const output = {
    generated: new Date().toISOString(),
    totalCommands: filteredCommands.length,
    categories: [...new Set(filteredCommands.map(c => c.category))].sort(),
    commands: filteredCommands
  };

  // Write to file
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');

  // Print results
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`${colors.bright}Results:${colors.reset}\n`);

  console.log(`${colors.green}✓ Processed: ${processed} commands${colors.reset}`);
  console.log(`${colors.yellow}⚠ Skipped: ${skipped} files${colors.reset}`);
  console.log(`${colors.blue}📁 Categories: ${output.categories.length}${colors.reset}`);
  
  if (skippedFiles.length > 0 && skippedFiles.length <= 20) {
    console.log(`\n${colors.yellow}Skipped files:${colors.reset}`);
    skippedFiles.forEach(file => {
      console.log(`  ${colors.yellow}•${colors.reset} ${file}`);
    });
  } else if (skippedFiles.length > 20) {
    console.log(`\n${colors.yellow}Skipped files (showing first 20):${colors.reset}`);
    skippedFiles.slice(0, 20).forEach(file => {
      console.log(`  ${colors.yellow}•${colors.reset} ${file}`);
    });
    console.log(`  ${colors.yellow}... and ${skippedFiles.length - 20} more${colors.reset}`);
  }
  
  console.log(`\n${colors.bright}Categories:${colors.reset}`);
  output.categories.forEach(cat => {
    const count = commands.filter(c => c.category === cat).length;
    console.log(`  ${colors.cyan}•${colors.reset} ${cat}: ${count} command(s)`);
  });

  console.log(`\n${colors.green}✓ Generated: ${outputFile}${colors.reset}`);
  console.log(`${colors.green}✓ File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB${colors.reset}\n`);

  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
}

// Run the script
main();
