const { ActivityType } = require('discord.js');
const chalk = require('chalk');
const config = require('../../config/setup');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    client.lavalink.manager.init(client.user.id);
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
 * Initialize database connection after Discord is ready
 * @param {Client} client - Discord client instance
 */
async function initializeDatabaseConnection(client) {
  const { initializeDatabase } = require('../../database');
  
  // Get database connections from config
  const globalConnection = config.database.globalConnection;
  const localConnection = config.database.localConnection;

  // Determine if we should connect to database
  const shouldConnect = globalConnection || localConnection;

  if (!shouldConnect) {
    console.log(chalk.yellow('    > database connection skipped - no connection strings provided'));
    return;
  }

  console.log(chalk.white('>> Database Connection'));
  console.log(chalk.blue('   [~] Initializing multi-tenant database system...'));

  // Multi-tenant setup with separate databases
  const connectionConfig = {
    global: globalConnection,
    local: localConnection
  };

  if (!globalConnection && !localConnection) {
    throw new Error('No database connection strings found - please set GLOBAL_CONNECTION and/or LOCAL_CONNECTION');
  }

  const dbSuccess = await initializeDatabase(connectionConfig);
  if (dbSuccess) {
    console.log(chalk.green('   [+] Global database connected'));
    console.log(chalk.green('   [+] Local database connected'));
    console.log(chalk.green('   [+] Cache system initialized'));
    console.log(chalk.green('   [+] Data preloading started'));
    console.log('\n');

    // Load and set bot status from database
    await loadBotStatusFromDatabase(client);

    // Emit custom event to signal database is ready
    client.emit('databaseReady');
  } else {
    throw new Error('Database connection failed');
  }
}

/**
 * Load bot status from database configuration
 * @param {Client} client - Discord client instance
 */
async function loadBotStatusFromDatabase(client) {
  try {
    const { System } = require('../../database');
    const instanceId = process.env.INSTANCE_ID;

    // Display instance information
    const instanceName = 'Adore';
    console.log(chalk.white('>> Instance Configuration'));
    console.log(chalk.cyan(`   [i] Instance Name: ${instanceName}`));
    console.log(chalk.cyan(`   [i] Instance ID: ${instanceId || 'Not Set'}`));

    if (!instanceId) {
      client.user.setPresence({
        activities: [{ name: 'adore.exe', type: ActivityType.Watching }],
        status: 'online'
      });
      console.log(chalk.green('   [+] Status: Watching adore.exe'));
      return;
    }

    // Get system data
    const systemData = await System.findOne({ _id: 'system' });
    if (!systemData || !systemData.InstanceConfig) {
      client.user.setPresence({
        activities: [{ name: 'adore.exe', type: ActivityType.Watching }],
        status: 'online'
      });
      console.log(chalk.green('   [+] Status: Watching adore.exe'));
      return;
    }

    // Find instance configuration
    const instanceConfig = systemData.InstanceConfig.find(config => config.instanceId === instanceId);
    if (!instanceConfig || !instanceConfig.botStatus) {
      client.user.setPresence({
        activities: [{ name: 'adore.exe', type: ActivityType.Watching }],
        status: 'online'
      });
      console.log(chalk.green('   [+] Status: Watching adore.exe'));
      return;
    }

    // Set bot status from database
    const { activity, type, status } = instanceConfig.botStatus;
    if (activity) {
      const activityType = ActivityType[type] || ActivityType.Watching;
      client.user.setPresence({
        activities: [{ name: activity, type: activityType }],
        status: status || 'online'
      });
      console.log(chalk.green(`   [+] Status: ${type} ${activity}`));
    } else {
      client.user.setStatus(status || 'online');
      console.log(chalk.green(`   [+] Status: ${status || 'online'}`));
    }

  } catch (error) {
    // Fallback to default
    client.user.setPresence({
      activities: [{ name: 'adore.exe', type: ActivityType.Watching }],
      status: 'online'
    });
    console.log(chalk.green('  Status: Watching adore.exe'));
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
