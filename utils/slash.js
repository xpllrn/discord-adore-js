/**
 * Slash Command Deployment Utility
 * 
 * This script registers slash commands with Discord's API.
 * Run this whenever you add/modify/remove slash commands.
 * 
 * Usage:
 *   node utils/slash.js              - Clear and deploy to dev server (instant, default)
 *   node utils/slash.js --global     - Deploy globally (takes up to 1 hour)
 *   node utils/slash.js --clear      - Clear dev server commands only
 */

// Initialize module aliases first (required for slash commands that use @services, etc.)
require('module-alias/register');

const { REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
const path = require('path');
const config = require('../config/setup');

const args = process.argv.slice(2);
const isGlobalDeploy = args.includes('--global');
const isClearOnly = args.includes('--clear');
const isGuildDeploy = !isGlobalDeploy; // Default to guild deploy

const commands = [];
const commandsPath = path.join(__dirname, '../commands');

// Recursively load all slash command files from commands folder
function loadSlashCommands(dirPath, relativePath = '') {
  const { statSync } = require('fs');
  const items = readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      loadSlashCommands(fullPath, path.join(relativePath, item));
    } else if (item.endsWith('.js') && !item.startsWith('_')) {
      try {
        const command = require(fullPath);
        
        if ('data' in command && 'execute' in command) {
          const commandPath = relativePath ? `${relativePath}/${item}` : item;
          
          // Support both single command and array of commands
          if (Array.isArray(command.data)) {
            command.data.forEach(slashData => {
              commands.push(slashData.toJSON());
              console.log(`✅ Loaded slash command: ${slashData.name} (${commandPath})`);
            });
          } else {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded slash command: ${command.data.name} (${commandPath})`);
          }
        }
      } catch (error) {
        console.error(`⚠️  Error loading ${relativePath}/${item}:`, error.message);
      }
    }
  }
}

// Load all slash command files
if (!isClearOnly) {
  try {
    loadSlashCommands(commandsPath);
    
    if (commands.length === 0) {
      console.log('⚠️  No slash commands found in commands folder.');
      console.log('💡 Make sure your commands export both "data" and "execute" properties.');
    }
  } catch (error) {
    console.error('Error loading slash commands:', error);
    process.exit(1);
  }
}

// Validate required config
if (!config.bot.token) {
  console.error('❌ BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

if (!config.bot.clientId) {
  console.error('❌ CLIENT_ID is not set in environment variables');
  process.exit(1);
}

// Construct REST module
const rest = new REST().setToken(config.bot.token);

// Deploy commands
(async () => {
  try {
    // Validate dev server ID for guild operations
    if (isGuildDeploy && !config.bot.devServerId) {
      console.error('❌ SERVER_ID is not set in environment variables');
      process.exit(1);
    }

    // If --clear flag is used, only clear and exit
    if (isClearOnly) {
      console.log('\n🗑️  Clearing dev server commands...');
      await rest.put(
        Routes.applicationGuildCommands(config.bot.clientId, config.bot.devServerId),
        { body: [] }
      );
      console.log('✅ Successfully cleared dev server commands.\n');
      return;
    }

    // Step 1: Clear old commands from dev server
    console.log('\n🗑️  Clearing old dev server commands...');
    await rest.put(
      Routes.applicationGuildCommands(config.bot.clientId, config.bot.devServerId),
      { body: [] }
    );
    console.log('✅ Cleared old commands.\n');

    // Step 2: Deploy new commands
    console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);
    
    let data;
    if (isGuildDeploy) {
      console.log(`📍 Deploying to dev server: ${config.bot.devServerId} (instant)`);
      
      // Deploy to specific guild (instant)
      data = await rest.put(
        Routes.applicationGuildCommands(config.bot.clientId, config.bot.devServerId),
        { body: commands }
      );
    } else {
      console.log('🌍 Deploying globally (may take up to 1 hour)');
      
      // Deploy globally (takes up to 1 hour)
      data = await rest.put(
        Routes.applicationCommands(config.bot.clientId),
        { body: commands }
      );
    }

    console.log(`✅ Successfully deployed ${data.length} application (/) commands.\n`);
    
    // List deployed commands
    console.log('Deployed commands:');
    data.forEach(cmd => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });
    
    console.log('\n✨ Slash commands are now live!\n');
    
    if (isGlobalDeploy) {
      console.log('⏰ Note: Global commands may take up to 1 hour to appear in all servers.');
      console.log('💡 Tip: Run without --global flag for instant deployment to dev server.\n');
    }
  } catch (error) {
    console.error('❌ Error deploying slash commands:', error);
    
    if (error.code === 50001) {
      console.error('\n💡 Missing Access: Make sure the bot is in the server and has applications.commands scope.\n');
    } else if (error.code === 10004) {
      console.error('\n💡 Unknown Guild: Check that SERVER_ID in .env is correct.\n');
    }
    
    process.exit(1);
  }
})();
