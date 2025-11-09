const { ActivityType } = require('discord.js');
const chalk = require('chalk');
const config = require('../../config/setup');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    const startTime = Date.now();

  console.log('');
  console.log(chalk.cyan('▄▀█ █▀▄ █▀█ █▀█ █▀▀   ░   █▀▀ ▀▄▀ █▀▀'));
  console.log(chalk.cyan('█▀█ █▄▀ █▄█ █▀▄ ██▄   ▄   ██▄ █░█ ██▄'));
  console.log('');
  console.log(chalk.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');

  // System initialization
  console.log(chalk.white('>> System Initialization'));
  const guildCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  console.log(chalk.green(`   [+] Connected to ${guildCount} servers`));
  console.log(chalk.green(`   [+] Monitoring ${userCount.toLocaleString()} users`));
  console.log(chalk.green(`   [+] Loaded ${client.commands.size} commands`));
  console.log(chalk.green(`   [+] Registered ${client.eventCount} event handlers`));
  console.log('');

  // Set loading status while cache initializes
  client.user.setPresence({
    activities: [{ name: 'Loading cache...', type: ActivityType.Custom }],
    status: 'idle'
  });

  try {
    await initializeDatabaseConnection(client);
  } catch (error) {
    console.log(chalk.red('Database initialization failed:', error.message));

    // Log error if error logger is available
    if (client.errorLogger) {
      client.errorLogger.log(error, 'Database Initialization', {
        command: 'Database Connection',
        args: 'Ready Event'
      });
    }
  }

  // Show startup time
  const endTime = Date.now();
  const startupTime = endTime - startTime;
  console.log('');
  console.log(chalk.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
  console.log(chalk.green(`>> System Online - Ready in ${startupTime}ms`));
  console.log('');
  console.log(chalk.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
  console.log('');
  console.log('');


    // Show environment validation results only if there are issues
    showEnvironmentValidation();

    // Cleanup unwanted guild
    const guild = client.guilds.cache.get('828746399255887904');
    if (guild) {
      guild.leave().catch(() => {});
    }
  }
};

/**
 * Initialize database connection and services after Discord is ready
 * @param {Client} client - Discord client instance
 */
async function initializeDatabaseConnection(client) {
  const { initializeDatabase } = require('../../database');
  const { initializeServices, getServiceHealth } = require('@services');
  
  // Get database connections from config
  const userConnection = config.database.userConnection;
  const guildConnection = config.database.guildConnection;

  // Determine if we should connect to database
  const shouldConnect = userConnection || guildConnection;

  if (!shouldConnect) {
    console.log(chalk.yellow('    > database connection skipped - no connection strings provided'));
    return;
  }

  console.log(chalk.white('>> Database Connection'));
  console.log(chalk.blue('   [~] Initializing multi-tenant database system...'));

  // Database setup with separate databases
  const connectionConfig = {
    user: userConnection,
    guild: guildConnection
  };

  if (!userConnection && !guildConnection) {
    throw new Error('No database connection strings found - please set USER_DATABASE and/or GUILD_DATABASE');
  }

  const dbSuccess = await initializeDatabase(connectionConfig);
  if (dbSuccess) {
    console.log(chalk.green('   [+] User database connected'));
    console.log(chalk.green('   [+] Guild database connected'));
    
    // Initialize new service layer
    console.log(chalk.blue('   [~] Initializing Data Service Layer...'));
    try {
      await initializeServices();
      console.log(chalk.green('   [+] Service layer initialized'));
      
      // Check service health
      const health = getServiceHealth();
      if (health.overall) {
        console.log(chalk.green('   [+] All services healthy'));
        console.log(chalk.cyan(`   [i] Guild Service: ${health.guild ? 'Ready' : 'Not Ready'}`));
        console.log(chalk.cyan(`   [i] User Service: ${health.user ? 'Ready' : 'Not Ready'}`));
        console.log(chalk.cyan(`   [i] System Service: ${health.system ? 'Ready' : 'Not Ready'}`));
        console.log(chalk.cyan(`   [i] Prefix Service: ${health.prefix ? 'Ready' : 'Not Ready'}`));
      } else {
        console.log(chalk.yellow('   [~] Some services not fully initialized'));
      }
    } catch (error) {
      console.log(chalk.yellow('   [~] Service layer initialization warning:', error.message));
      console.log(chalk.yellow('   [~] Some services not fully initialized'));
    }
    
    console.log('\n');

    // Load and set bot status from database
    await loadBotStatusFromDatabase(client);

    // Mark services as ready for command processing
    client.cacheReady = true;
    
    // Wait a moment for database connections to fully stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Resume active sprints
    console.log(chalk.blue('   [~] Resuming active sprints...'));
    try {
      const { resumeActiveSprints } = require('./backgroundTasks');
      await resumeActiveSprints(client);
      console.log(chalk.green('   [+] Sprint system initialized'));
    } catch (error) {
      console.log(chalk.yellow('   [~] Sprint initialization warning:', error.message));
    }
    
    // Emit ready events
    console.log(chalk.blue('   [~] Triggering delayed ready events...'));
    client.emit('databaseReady');
    client.emit('cacheReady');
    client.emit('cacheReadyComplete');
  } else {
    throw new Error('Database connection failed');
  }
}

/**
 * Load bot status from database configuration using new service layer
 * @param {Client} client - Discord client instance
 */
async function loadBotStatusFromDatabase(client) {
  try {
    const { getService } = require('@services');

    // Display instance information
    const instanceName = 'Adore';
    console.log(chalk.white('>> Instance Configuration'));
    console.log(chalk.cyan(`   [i] Instance Name: ${instanceName}`));

    // Set default bot status
    client.user.setPresence({
      activities: [{ name: 'stalking you', type: ActivityType.Custom }],
      status: 'dnd'
    });
    console.log(chalk.green('   [+] Status: stalking you'));

  } catch (error) {
    // Fallback to default
    client.user.setPresence({
      activities: [{ name: 'stalking you', type: ActivityType.Custom }],
      status: 'dnd'
    });
    console.log(chalk.green('   [+] Status: stalking you (default)'));
  }
}

/**
 * Show environment variable validation results after startup
 */
function showEnvironmentValidation() {
  const validation = config.validation;

  // Debug: Check what validation results we have
  // console.log('DEBUG - Validation results:', validation);

  // Only show validation messages if there are actually issues
  if (validation && (validation.hasErrors || validation.hasWarnings)) {
    console.log(''); // Add spacing before validation messages

    if (validation.hasErrors) {
      console.log(chalk.red('>> Environment Configuration Issues'));
      console.log(chalk.red(`   [!] Missing required variables: ${validation.missingRequired.join(', ')}`));
      console.log(chalk.red('   [!] Please check your .env file and ensure all required variables are set.'));
      console.log('');
    }

    if (validation.hasWarnings) {
      console.log(chalk.yellow('>> Webhok connection'));
      console.log(chalk.yellow(`   [~] Missing recommended variables: ${validation.missingRecommended.join(', ')}`));
      console.log(chalk.yellow('   [~] Some features may not work properly without these variables.'));
      console.log('');
    }

    console.log(chalk.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log('');
  }
  // If no validation issues, function does nothing (completely silent)
}
