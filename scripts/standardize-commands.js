#!/usr/bin/env node

/**
 * Command Standardization Script
 * 
 * This script:
 * 1. Finds all command files with subcommandInfo objects
 * 2. Removes the unused 'parameters' field from subcommandInfo
 * 3. Ensures consistent formatting across all commands
 * 4. Reports on commands that need manual review
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
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const commandsDir = path.join(__dirname, '..', 'commands');
const results = {
  processed: [],
  modified: [],
  errors: [],
  needsReview: []
};

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
 * Check if file has subcommandInfo objects
 */
function hasSubcommandInfo(content) {
  return content.includes('subcommandInfo');
}

/**
 * Remove parameters field from subcommandInfo objects
 */
function removeParametersField(content) {
  // Match subcommandInfo objects and remove parameters field
  const regex = /const\s+subcommandInfo\s*=\s*\{([^}]*)\};/gs;
  
  let modified = false;
  const newContent = content.replace(regex, (match, innerContent) => {
    // Check if this subcommandInfo has a parameters field
    if (innerContent.includes('parameters:')) {
      modified = true;
      
      // Remove the parameters line (including trailing comma if present)
      const cleaned = innerContent.replace(/,?\s*parameters:\s*\[[^\]]*\],?\s*/g, '');
      
      // Clean up any double commas or trailing commas before closing brace
      const finalCleaned = cleaned
        .replace(/,\s*,/g, ',')
        .replace(/,(\s*)\}/g, '$1}')
        .trim();
      
      return `const subcommandInfo = {${finalCleaned}};`;
    }
    
    return match;
  });

  return { content: newContent, modified };
}

/**
 * Check if command has isGroupCommand flag
 */
function hasGroupCommandFlag(content) {
  return /isGroupCommand:\s*true/.test(content);
}

/**
 * Check if command has subcommands but missing isGroupCommand flag
 */
function needsGroupCommandFlag(content) {
  return hasSubcommandInfo(content) && !hasGroupCommandFlag(content);
}

/**
 * Process a single command file
 */
function processCommandFile(filePath) {
  const relativePath = path.relative(commandsDir, filePath);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if no subcommandInfo
    if (!hasSubcommandInfo(content)) {
      return;
    }

    results.processed.push(relativePath);

    // Check if needs isGroupCommand flag
    if (needsGroupCommandFlag(content)) {
      results.needsReview.push({
        file: relativePath,
        issue: 'Has subcommandInfo but missing isGroupCommand: true flag'
      });
    }

    // Remove parameters field
    const { content: newContent, modified } = removeParametersField(content);

    if (modified) {
      // Write back to file
      fs.writeFileSync(filePath, newContent, 'utf8');
      results.modified.push(relativePath);
    }

  } catch (error) {
    results.errors.push({
      file: relativePath,
      error: error.message
    });
  }
}

/**
 * Main execution
 */
function main() {
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║     Command Standardization Script                    ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.blue}📂 Scanning commands directory...${colors.reset}\n`);

  const commandFiles = findJsFiles(commandsDir);
  console.log(`${colors.green}✓ Found ${commandFiles.length} command files${colors.reset}\n`);

  console.log(`${colors.blue}🔧 Processing files...${colors.reset}\n`);

  commandFiles.forEach(processCommandFile);

  // Print results
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`${colors.bright}Results:${colors.reset}\n`);

  console.log(`${colors.green}✓ Processed: ${results.processed.length} files with subcommandInfo${colors.reset}`);
  console.log(`${colors.green}✓ Modified: ${results.modified.length} files (removed parameters field)${colors.reset}`);
  
  if (results.modified.length > 0) {
    console.log(`\n${colors.bright}Modified files:${colors.reset}`);
    results.modified.forEach(file => {
      console.log(`  ${colors.green}✓${colors.reset} ${file}`);
    });
  }

  if (results.needsReview.length > 0) {
    console.log(`\n${colors.yellow}⚠ Files needing review: ${results.needsReview.length}${colors.reset}`);
    results.needsReview.forEach(item => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${item.file}`);
      console.log(`    ${colors.yellow}→${colors.reset} ${item.issue}`);
    });
  }

  if (results.errors.length > 0) {
    console.log(`\n${colors.red}✗ Errors: ${results.errors.length}${colors.reset}`);
    results.errors.forEach(item => {
      console.log(`  ${colors.red}✗${colors.reset} ${item.file}`);
      console.log(`    ${colors.red}→${colors.reset} ${item.error}`);
    });
  }

  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

  if (results.modified.length > 0) {
    console.log(`${colors.green}✓ Standardization complete!${colors.reset}`);
    console.log(`${colors.green}  ${results.modified.length} file(s) have been updated.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✓ All files are already standardized!${colors.reset}\n`);
  }

  if (results.needsReview.length > 0) {
    console.log(`${colors.yellow}⚠ Please review ${results.needsReview.length} file(s) manually.${colors.reset}\n`);
  }
}

// Run the script
main();
