const { ActivityType } = require('discord.js');
const chalk = require('chalk');
const config = require('../../config/setup');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    const startTime = Date.now();

  console.log('');
  console.log(chalk.cyan(' █████╗ ██████╗  ██████╗ ██████╗ ███████╗   ███████╗██╗  ██╗███████╗'));
  console.log(chalk.cyan('██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██╔════╝   ██╔════╝╚██╗██╔╝██╔════╝'));
  console.log(chalk.cyan('███████║██║  ██║██║   ██║██████╔╝█████╗     █████╗   ╚███╔╝ █████╗  '));
  console.log(chalk.cyan('██╔══██║██║  ██║██║   ██║██╔══██╗██╔══╝     ██╔══╝   ██╔██╗ ██╔══╝  '));
  console.log(chalk.cyan('██║  ██║██████╔╝╚██████╔╝██║  ██║███████╗██╗███████╗██╔╝ ██╗███████╗'));
  console.log(chalk.cyan('╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚═╝  ╚═╝╚══════╝'));
  console.log('');
  
  // System info
  const guildCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  const slashCommandInfo = client.slashCommandCount > 0 ? `, ${client.slashCommandCount} slash` : '';
  console.log(chalk.gray(`   ${guildCount} servers • ${userCount.toLocaleString()} users • ${client.commands.size} commands${slashCommandInfo} • ${client.eventCount} events`));
  console.log('');

  // Set loading status
  client.user.setPresence({
    activities: [{ name: 'Starting up...', type: ActivityType.Custom }],
    status: 'idle'
  });

  // Create loading bar
  const loader = createLoadingBar();
  
  try {
    await initializeDatabaseConnection(client, loader);
    
    // Show startup time
    const endTime = Date.now();
    const startupTime = endTime - startTime;
    
    // Complete with startup time
    loader.complete(`adore is ready [${startupTime}ms]`);
    console.log('');
  } catch (error) {
    loader.fail('Initialization failed');
    console.log(chalk.red(`   ✖ ${error.message}`));

    if (client.errorLogger) {
      client.errorLogger.log(error, 'Database Initialization', {
        command: 'Database Connection',
        args: 'Ready Event'
      });
    }
  }


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
 * Create a loading bar with progress updates
 */
function createLoadingBar() {
  const barLength = 50;
  let currentStep = 0;
  const totalSteps = 5;
  let currentMessage = 'Initializing...';
  
  const update = (step, message) => {
    currentStep = step;
    currentMessage = message;
    render();
  };
  
  const render = () => {
    const progress = currentStep / totalSteps;
    const filled = Math.floor(barLength * progress);
    const empty = barLength - filled;
    
    const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentage = Math.floor(progress * 100);
    
    process.stdout.write(`\r   ${bar} ${percentage}% ${chalk.gray(currentMessage)}`);
  };
  
  const complete = (message = 'Complete!') => {
    const bar = chalk.green('█'.repeat(barLength));
    process.stdout.write(`\r   ${bar} 100% ${chalk.green(message)}\n`);
  };
  
  const fail = (message) => {
    const bar = chalk.red('█'.repeat(barLength));
    process.stdout.write(`\r   ${bar} ${chalk.red(message)}\n`);
  };
  
  // Initial render
  render();
  
  return { update, complete, fail };
}

/**
 * Initialize database connection and services after Discord is ready
 * @param {Client} client - Discord client instance
 * @param {Object} loader - Loading bar instance
 */
async function initializeDatabaseConnection(client, loader) {
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

  loader.update(1, 'Connecting to database...');

  // Database setup with separate databases
  const connectionConfig = {
    user: userConnection,
    guild: guildConnection
  };

  if (!userConnection && !guildConnection) {
    throw new Error('No database connection strings found');
  }

  const dbSuccess = await initializeDatabase(connectionConfig);
  if (dbSuccess) {
    loader.update(2, 'Initializing services...');
    
    // Initialize services
    try {
      await initializeServices();
      getServiceHealth();
    } catch (error) {
      // Continue anyway
    }
    
    loader.update(3, 'Warming up cache...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    loader.update(4, 'Loading configuration...');
    await loadBotStatusFromDatabase(client);

    // Mark as ready
    client.cacheReady = true;
    
    loader.update(5, 'Starting background tasks...');
    
    // Resume background tasks
    try {
      const { resumeActiveSprints } = require('./backgroundTasks');
      await resumeActiveSprints(client);
    } catch (error) {
      // Silent fail
    }
    
    // Emit ready events
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

  // Set bot status
  client.user.setPresence({
    activities: [{ name: '/help || free premium', type: ActivityType.Custom }],
    status: 'dnd'
  });
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
      console.log(chalk.red(`Environment: Missing required variables - ${validation.missingRequired.join(', ')}`));
      console.log('');
    }

    if (validation.hasWarnings) {
      console.log(chalk.yellow(`Environment: Missing recommended variables - ${validation.missingRecommended.join(', ')}`));
      console.log('');
    }
  }
  // If no validation issues, function does nothing (completely silent)
}


