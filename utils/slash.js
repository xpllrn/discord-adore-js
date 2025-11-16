/**
 * Slash Command Deployment Utility
 * 
 * This script registers slash commands with Discord's API.
 * Run this whenever you add/modify/remove slash commands.
 * 
 * Usage:
 *   node utils/slash.js              - Deploy globally (takes up to 1 hour)
 *   node utils/slash.js --guild      - Deploy to dev server (instant)
 *   node utils/slash.js --clear      - Clear all commands
 */

// Initialize module aliases first (required for slash commands that use @services, etc.)
require('module-alias/register');

const { REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
const path = require('path');
const config = require('../config/setup');

const args = process.argv.slice(2);
const isGuildDeploy = args.includes('--guild');
const isClear = args.includes('--clear');

const commands = [];
const commandSlashPath = path.join(__dirname, '../commandSlash');

// Load all slash command files
if (!isClear) {
  try {
    const commandFiles = readdirSync(commandSlashPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandSlashPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded slash command: ${command.data.name}`);
      } else {
        console.log(`⚠️  Skipped ${file}: missing 'data' or 'execute' property`);
      }
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
    if (isClear) {
      console.log('\n🗑️  Clearing all application (/) commands...');
      
      if (isGuildDeploy) {
        await rest.put(
          Routes.applicationGuildCommands(config.bot.clientId, config.bot.devServerId),
          { body: [] }
        );
        console.log('✅ Successfully cleared guild commands.\n');
      } else {
        await rest.put(
          Routes.applicationCommands(config.bot.clientId),
          { body: [] }
        );
        console.log('✅ Successfully cleared global commands.\n');
      }
      return;
    }

    console.log(`\n🚀 Started refreshing ${commands.length} application (/) commands.`);
    
    let data;
    if (isGuildDeploy) {
      if (!config.bot.devServerId) {
        console.error('❌ SERVER_ID is not set in environment variables');
        process.exit(1);
      }
      
      console.log(`📍 Deploying to guild: ${config.bot.devServerId} (instant)`);
      
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
    
    if (!isGuildDeploy) {
      console.log('⏰ Note: Global commands may take up to 1 hour to appear in all servers.');
      console.log('💡 Tip: Use --guild flag for instant deployment to dev server during testing.\n');
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
