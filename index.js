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
const WebhookErrorLogger = require('./events/dev/errorLogger');

client.commands = new Collection();
client.aliases = new Collection();

// Attach permissions utilities to client
client.permissions = permissions;

// Initialize error logger
let errorLogger;

// Load commands and events
const { readdirSync, statSync } = require('fs');
const path = require('path');

function loadCommandsFromDirectory(dirPath, relativePath = '') {
  const items = readdirSync(dirPath);
  let commandCount = 0;
  let failedCommands = [];

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      const result = loadCommandsFromDirectory(fullPath, path.join(relativePath, item));
      commandCount += result.commandCount || result;
      if (result.failedCommands) {
        failedCommands = failedCommands.concat(result.failedCommands);
      }
    } else if (item.endsWith('.js')) {
      try {
        const commandPath = path.resolve(fullPath);
        let pull = require(commandPath);

        if (pull.name) {
          client.commands.set(pull.name, pull);
          commandCount++;
        } else {
          // Command file exists but has no name property
          const errorMsg = `Command file ${relativePath}/${item} has no name property`;
          console.log(`⚠️  ${errorMsg}`);
          failedCommands.push(`${relativePath}/${item} - No name property`);
        }

        if (pull.aliases && Array.isArray(pull.aliases)) {
          pull.aliases.forEach(alias => client.aliases.set(alias, pull.name));
        }
      } catch (error) {
        const errorMsg = `Failed to load command: ${relativePath}/${item} - ${error.message}`;
        console.log(`❌ ${errorMsg}`);
        failedCommands.push(`${relativePath}/${item} - ${error.message}`);

        if (errorLogger) {
          errorLogger.log(error, `Command Loading: ${relativePath}/${item}`, {
            command: `Loading ${item}`,
            args: `File: ${fullPath}`,
            error: error.message
          });
        }
      }
    }
  }

  return { commandCount, failedCommands };
}

const commandResult = loadCommandsFromDirectory('./commands/');
const commandCount = commandResult.commandCount || commandResult;
const failedCommands = commandResult.failedCommands || [];
client.commandCount = commandCount;
client.failedCommands = failedCommands;

require('./handlers/events')(client);



// Initialize webhook error logger early (before ready event)
errorLogger = new WebhookErrorLogger();
client.errorLogger = errorLogger;



// Load finder utilities and attach to client
const { findRole, findUser, findChannel, findGuild } = require('./handlers/finder');
client.findRole = findRole;
client.findUser = findUser;
client.findChannel = findChannel;
client.findGuild = findGuild;

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down bot...');

  // Close Discord client
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');

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

  // Try to log to console, but wrap in try-catch in case streams are broken
  try {
    console.error('Uncaught Exception:', error);
  } catch (consoleError) {
    // Console is broken, can't log
  }

  if (errorLogger) {
    errorLogger.log(error, 'Uncaught Exception', {
      command: 'Process Error',
      args: 'Main Process'
    }).catch(() => {
      // Webhook logging failed, nothing we can do
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  try {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  } catch (consoleError) {
    // Console is broken, can't log
  }

  if (errorLogger) {
    errorLogger.log(reason?.toString() || 'Unknown reason', 'Unhandled Promise Rejection', {
      command: 'Process Error',
      args: 'Main Process'
    }).catch(() => {
      // Webhook logging failed, nothing we can do
    });
  }
});

// Discord.js error events
client.on('error', (error) => {
  try {
    console.error('Discord.js Client Error:', error);
  } catch (consoleError) {
    // Console is broken, can't log
  }

  if (errorLogger) {
    errorLogger.log(error, 'Discord.js Client Error', {
      command: 'Discord.js Client',
      args: `Status: ${client.readyAt ? 'Ready' : 'Not Ready'} | Guilds: ${client.guilds.cache.size}`
    }).catch(() => {});
  }
});

client.on('warn', (warning) => {
  try {
    console.warn('Discord.js Client Warning:', warning);
  } catch (consoleError) {
    // Console is broken, can't log
  }

  if (errorLogger) {
    errorLogger.log(warning, 'Discord.js Client Warning', {
      command: 'Discord.js Client',
      args: `Status: ${client.readyAt ? 'Ready' : 'Not Ready'}`
    }).catch(() => {});
  }
});

client.login(config.bot.token)

// Export client for modules that need it (avoid circular dependencies by using global reference)
module.exports = client;