// Initialize module aliases first (must be before any other requires)
require('module-alias/register');

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js')

// Protect against stdout/stderr write errors
process.stdout.on('error', (err) => {
  if (err.code === 'EIO' || err.code === 'EPIPE') {
    // Ignore broken pipe errors
    return;
  }
});

process.stderr.on('error', (err) => {
  if (err.code === 'EIO' || err.code === 'EPIPE') {
    // Ignore broken pipe errors
    return;
  }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent
  ],
  allowedMentions: { parse: ['users', 'roles'] },
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
})

// Set global client reference to avoid circular dependencies
global.discordClient = client;
const config = require('./config/setup');
const permissions = require('./utils/permissions');
const logger = require('./utils/logger');

client.commands = new Collection();
client.aliases = new Collection();
client.slashCommands = new Collection();

// Attach permissions utilities to client
client.permissions = permissions;

// Attach logger to client for easy access
client.logger = logger;

// Load commands and events
const { readdirSync, statSync } = require('fs');
const path = require('path');

function loadCommandsFromDirectory(dirPath, relativePath = '') {
  const items = readdirSync(dirPath);
  let commandCount = 0;
  let slashCommandCount = 0;
  let failedCommands = [];

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      const result = loadCommandsFromDirectory(fullPath, path.join(relativePath, item));
      commandCount += result.commandCount || 0;
      slashCommandCount += result.slashCommandCount || 0;
      if (result.failedCommands) {
        failedCommands = failedCommands.concat(result.failedCommands);
      }
    } else if (item.endsWith('.js') && !item.startsWith('_')) {
      try {
        const commandPath = path.resolve(fullPath);
        let command = require(commandPath);

        // Load PREFIX command
        if (command.name && command.run) {
          client.commands.set(command.name, command);
          commandCount++;
          
          if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => client.aliases.set(alias, command.name));
          }
        }

        // Load SLASH command (same file can have both!)
        // Support both single command and array of commands
        if (command.data && command.execute) {
          if (Array.isArray(command.data)) {
            // Multiple slash commands in one file
            command.data.forEach(slashData => {
              client.slashCommands.set(slashData.name, { data: slashData, execute: command.execute });
              slashCommandCount++;
            });
          } else {
            // Single slash command
            client.slashCommands.set(command.data.name, command);
            slashCommandCount++;
          }
        }

        // Warn if file has neither format
        if (!command.name && !command.data) {
          const errorMsg = `Command file ${relativePath}/${item} has no name or data property`;
          logger.console.warn(`⚠️  ${errorMsg}`);
          failedCommands.push(`${relativePath}/${item} - No command properties`);
        }

      } catch (error) {
        const errorMsg = `Failed to load command: ${relativePath}/${item} - ${error.message}`;
        logger.console.error(`❌ ${errorMsg}`);
        failedCommands.push(`${relativePath}/${item} - ${error.message}`);

        logger.webhook.error(error, `Command Loading: ${relativePath}/${item}`, {
          command: `Loading ${item}`,
          args: `File: ${fullPath}`,
          error: error.message
        });
      }
    }
  }

  return { commandCount, slashCommandCount, failedCommands };
}

const commandResult = loadCommandsFromDirectory('./commands/');
const commandCount = commandResult.commandCount || 0;
const slashCommandCount = commandResult.slashCommandCount || 0;
const failedCommands = commandResult.failedCommands || [];
client.commandCount = commandCount;
client.slashCommandCount = slashCommandCount;
client.failedCommands = failedCommands;

require('./handlers/events')(client);

// Load finder utilities and attach to client
const { findRole, findUser, findChannel, findGuild } = require('./handlers/finder');
client.findRole = findRole;
client.findUser = findUser;
client.findChannel = findChannel;
client.findGuild = findGuild;

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.console.log('\n🛑 Shutting down bot...');

  // Close Discord client
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.console.log('\n🛑 Received SIGTERM, shutting down gracefully...');

  // Close Discord client
  client.destroy();
  process.exit(0);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  // Handle write EIO errors gracefully (broken pipe/stream errors)
  if (error.code === 'EIO' && error.syscall === 'write') {
    // Silently ignore write errors to prevent crash loops
    // These occur when stdout/stderr is closed or piped to a closed process
    return;
  }

  logger.both.error(error, 'Uncaught Exception', {
    command: 'Process Error',
    args: 'Main Process'
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.both.error(reason?.toString() || 'Unknown reason', 'Unhandled Promise Rejection', {
    command: 'Process Error',
    args: 'Main Process'
  });
});

// Discord.js error events
client.on('error', (error) => {
  logger.both.error(error, 'Discord.js Client Error', {
    command: 'Discord.js Client',
    args: `Status: ${client.readyAt ? 'Ready' : 'Not Ready'} | Guilds: ${client.guilds.cache.size}`
  });
});

client.on('warn', (warning) => {
  logger.both.warn(warning, 'Discord.js Client Warning', {
    command: 'Discord.js Client',
    args: `Status: ${client.readyAt ? 'Ready' : 'Not Ready'}`
  });
});

client.login(config.bot.token)

// Auto-start selfbot when main bot is ready
client.once('ready', async () => {
  try {
    const SelfBot = require('./deman/index.js');
    const selfbotInstance = new SelfBot();
    await selfbotInstance.start();
    
    // Store globally for the selfbot command to access
    global.selfbotInstance = selfbotInstance;
    
    logger.console.log('✅ Selfbot auto-started');
  } catch (error) {
    logger.console.error('❌ Failed to auto-start selfbot:', error.message);
  }

  // Start GitHub webhook server
  try {
    const GitHubWebhook = require('./webhooks/github');
    const githubWebhook = new GitHubWebhook(client);
    await githubWebhook.start();
    global.githubWebhook = githubWebhook;
  } catch (error) {
    logger.console.error('❌ Failed to start GitHub webhook:', error.message);
  }
});

// Export client for modules that need it (avoid circular dependencies by using global reference)
module.exports = client;