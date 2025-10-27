const fs = require('fs');
const path = require('path');

/**
 * Detects if a command has subcommands by checking isGroupCommand flag
 * @param {Object} command - Command object
 * @returns {Boolean} - True if command.isGroupCommand is true
 */
function hasSubcommands(command) {
  return command.isGroupCommand === true;
}

/**
 * Parses command file to extract all subcommandInfo objects
 * @param {String} commandFilePath - Path to the command file
 * @param {String} commandName - Name of the parent command
 * @param {String} guildPrefix - Guild's command prefix
 * @returns {Array} - Array of subcommand objects
 */
function parseSubcommands(commandFilePath, commandName, guildPrefix) {
  try {
    // Read the command file source code
    const fileContent = fs.readFileSync(commandFilePath, 'utf8');
    
    const subcommands = [];
    
    // Regex to find subcommand blocks with subcommandInfo
    // Matches: if (args[0] === 'add') { ... const subcommandInfo = { ... }
    const subcommandBlockRegex = /if\s*\(\s*args\[0\]\s*===\s*['"](\w+)['"]\s*(?:\|\|\s*args\[0\]\s*===\s*['"](\w+)['"])*\s*\)\s*\{[\s\S]*?const\s+subcommandInfo\s*=\s*\{([\s\S]*?)\};/g;
    
    let match;
    while ((match = subcommandBlockRegex.exec(fileContent)) !== null) {
      const subcommandName = match[1];
      const subcommandInfoContent = match[3];
      
      // Parse the subcommandInfo object
      const subcommandData = parseSubcommandInfo(subcommandInfoContent, subcommandName, commandName, guildPrefix);
      
      // Extract aliases from the conditional (e.g., args[0] === 'remove' || args[0] === 'rm')
      const aliasesFromConditional = extractAliasesFromConditional(match[0]);
      
      // Merge aliases from conditional with aliases from subcommandInfo
      if (aliasesFromConditional.length > 0) {
        subcommandData.aliases = [...new Set([...subcommandData.aliases, ...aliasesFromConditional])];
      }
      
      subcommands.push(subcommandData);
    }
    
    // If no subcommandInfo found, try fallback parsing from usage field
    if (subcommands.length === 0) {
      return parseLegacyUsageField(fileContent, commandName, guildPrefix);
    }
    
    return subcommands;
  } catch (error) {
    console.error(`Error parsing subcommands from ${commandFilePath}:`, error.message);
    return [];
  }
}

/**
 * Extracts subcommand name from conditional block
 * @param {String} codeBlock - Code containing the conditional (e.g., "args[0] === 'add'")
 * @returns {String} - Subcommand name
 */
function extractSubcommandName(codeBlock) {
  const match = codeBlock.match(/args\[0\]\s*===\s*['"](\w+)['"]/);
  return match ? match[1] : null;
}

/**
 * Extracts aliases from conditional block (e.g., args[0] === 'remove' || args[0] === 'rm')
 * @param {String} conditional - Conditional statement
 * @returns {Array} - Array of alias strings
 */
function extractAliasesFromConditional(conditional) {
  const aliases = [];
  const aliasRegex = /args\[0\]\s*===\s*['"](\w+)['"]/g;
  let match;
  
  while ((match = aliasRegex.exec(conditional)) !== null) {
    aliases.push(match[1]);
  }
  
  // Remove the first one as it's the main subcommand name
  return aliases.slice(1);
}

/**
 * Parses subcommandInfo object literal from code
 * @param {String} objectContent - Content of subcommandInfo object
 * @param {String} subcommandName - Name of the subcommand
 * @param {String} commandName - Name of the parent command
 * @param {String} guildPrefix - Guild's command prefix
 * @returns {Object} - Parsed subcommand metadata
 */
function parseSubcommandInfo(objectContent, subcommandName, commandName, guildPrefix) {
  const subcommandData = {
    name: subcommandName,
    fullCommand: `${commandName} ${subcommandName}`,
    description: '',
    aliases: [],
    parameters: [],
    syntax: '',
    example: ''
  };
  
  // Extract description
  const descMatch = objectContent.match(/description:\s*[`'"]([^`'"]*)[`'"]/);
  if (descMatch) {
    subcommandData.description = descMatch[1];
  }
  
  // Extract usage/syntax
  const usageMatch = objectContent.match(/usage:\s*[`'"]([^`'"]*)[`'"]/);
  if (usageMatch) {
    let usage = usageMatch[1].replace(/\{guildprefix\}/g, guildPrefix);
    subcommandData.syntax = usage;
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
  
  // Extract parameters array
  const paramsMatch = objectContent.match(/parameters:\s*\[(.*?)\]/s);
  if (paramsMatch) {
    const paramsStr = paramsMatch[1];
    const params = paramsStr.match(/['"]([^'"]+)['"]/g);
    if (params) {
      subcommandData.parameters = params.map(p => p.replace(/['"]/g, ''));
    }
  }
  
  // Extract example
  const exampleMatch = objectContent.match(/example:\s*[`'"]([^`'"]*)[`'"]/);
  if (exampleMatch) {
    subcommandData.example = exampleMatch[1].replace(/\{guildprefix\}/g, guildPrefix);
  }
  
  return subcommandData;
}

/**
 * Fallback parser for legacy commands using top-level usage field
 * @param {String} fileContent - Content of the command file
 * @param {String} commandName - Name of the parent command
 * @param {String} guildPrefix - Guild's command prefix
 * @returns {Array} - Array of subcommand objects
 */
function parseLegacyUsageField(fileContent, commandName, guildPrefix) {
  try {
    // Extract usage field from module.exports
    const usageMatch = fileContent.match(/usage:\s*`([^`]*)`/s);
    if (!usageMatch) {
      return [];
    }
    
    const usage = usageMatch[1];
    const lines = usage.split('\n').filter(line => line.trim());
    
    const subcommands = [];
    const seenSubcommands = new Set();
    
    for (const line of lines) {
      // Check if line starts with {guildprefix}commandname
      const pattern = new RegExp(`\\{guildprefix\\}${commandName}\\s+(\\w+)`);
      const match = line.match(pattern);
      
      if (match) {
        const subcommandName = match[1];
        
        // Skip duplicates
        if (seenSubcommands.has(subcommandName)) {
          continue;
        }
        seenSubcommands.add(subcommandName);
        
        // Extract parameters from the line (anything in [brackets])
        const paramMatches = line.match(/\[([^\]]+)\]/g);
        const parameters = paramMatches ? paramMatches.map(p => p.replace(/[\[\]]/g, '')) : [];
        
        const syntax = line.replace(/\{guildprefix\}/g, guildPrefix);
        
        subcommands.push({
          name: subcommandName,
          fullCommand: `${commandName} ${subcommandName}`,
          description: `Execute ${subcommandName} subcommand`,
          aliases: [],
          parameters: parameters,
          syntax: syntax,
          example: syntax
        });
      }
    }
    
    return subcommands;
  } catch (error) {
    console.error('Error parsing legacy usage field:', error.message);
    return [];
  }
}

/**
 * Gets the file path for a command
 * @param {String} commandName - Name of the command
 * @param {String} commandsDir - Base commands directory path
 * @returns {String|null} - Full path to command file or null if not found
 */
function getCommandFilePath(commandName, commandsDir) {
  try {
    // Recursively search for the command file
    function searchDirectory(dir) {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          const result = searchDirectory(fullPath);
          if (result) return result;
        } else if (file === `${commandName}.js`) {
          return fullPath;
        }
      }
      
      return null;
    }
    
    return searchDirectory(commandsDir);
  } catch (error) {
    console.error(`Error finding command file for ${commandName}:`, error.message);
    return null;
  }
}

module.exports = {
  hasSubcommands,
  parseSubcommands,
  extractSubcommandName,
  parseSubcommandInfo,
  getCommandFilePath
};
