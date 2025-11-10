const { ActivityType } = require('discord.js');
const chalk = require('chalk');
const config = require('../../config/setup');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    const startTime = Date.now();

  console.log('');
  console.log(chalk.cyan('██╗   ██╗██╗     ███████╗███████╗██████╗     ██████╗  ██████╗ ████████╗'));
  console.log(chalk.cyan('██║   ██║██║     ██╔════╝██╔════╝██╔══██╗    ██╔══██╗██╔═══██╗╚══██╔══╝'));
  console.log(chalk.cyan('██║   ██║██║     █████╗  █████╗  ██║  ██║    ██████╔╝██║   ██║   ██║   '));
  console.log(chalk.cyan('╚██╗ ██╔╝██║     ██╔══╝  ██╔══╝  ██║  ██║    ██╔══██╗██║   ██║   ██║   '));
  console.log(chalk.cyan(' ╚████╔╝ ███████╗███████╗███████╗██████╔╝    ██████╔╝╚██████╔╝   ██║   '));
  console.log(chalk.cyan('  ╚═══╝  ╚══════╝╚══════╝╚══════╝╚═════╝     ╚═════╝  ╚═════╝    ╚═╝   '));
  console.log('');
  console.log('');

  // System initialization
  const guildCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  console.log(chalk.white(`System: ${guildCount} servers, ${userCount.toLocaleString()} users, ${client.commands.size} commands, ${client.eventCount} events`));
  console.log('');

  // Set loading status while cache initializes
  client.user.setPresence({
    activities: [{ name: 'Loading cache...', type: ActivityType.Custom }],
    status: 'idle'
  });

  try {
    await initializeDatabaseConnection(client);
    
    // Run one-time data reset
    await resetLastFMAndSprintData();
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
  console.log(chalk.green(`vleed is active [${startupTime}ms]`));
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

  console.log(chalk.white('Database: Connecting...'));

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
    // Initialize new service layer
    try {
      await initializeServices();
      
      // Check service health
      const health = getServiceHealth();
      if (health.overall) {
        console.log(chalk.green('Database: Connected (user, guild, services)'));
      } else {
        console.log(chalk.yellow('Database: Connected with warnings'));
      }
    } catch (error) {
      console.log(chalk.yellow('Database: Connected with warnings -', error.message));
    }
    
    console.log('');

    // Load and set bot status from database
    await loadBotStatusFromDatabase(client);

    // Mark services as ready for command processing
    client.cacheReady = true;
    
    // Wait a moment for database connections to fully stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Resume active sprints
    try {
      const { resumeActiveSprints } = require('./backgroundTasks');
      await resumeActiveSprints(client);
    } catch (error) {
      console.log(chalk.yellow('Sprint system warning:', error.message));
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
    activities: [{ name: 'save 31$', type: ActivityType.Custom }],
    status: 'dnd'
  });
  console.log(chalk.white('Instance: vleed | Status: save 31$'));
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

/**
 * Reset all LastFM and Sprint data on startup
 */
async function resetLastFMAndSprintData() {
  try {
    console.log(chalk.yellow('🔧 Resetting LastFM and Sprint data...'));
    
    const { getModels } = require('../../database');
    const models = getModels();
    
    if (!models || !models.Guild || !models.User) {
      console.log(chalk.yellow('   Skipped - Models not available'));
      return;
    }

    const Guild = models.Guild;
    const User = models.User;
    
    // Reset Guild data
    const guilds = await Guild.find({});
    let guildsUpdated = 0;
    let totalLastFMCrownsRemoved = 0;
    let totalMessageStatsRemoved = 0;
    let totalSprintsRemoved = 0;

    for (const guild of guilds) {
      let needsUpdate = false;

      // Remove all LastFM Crowns
      if (guild.LastFMCrowns && guild.LastFMCrowns.length > 0) {
        totalLastFMCrownsRemoved += guild.LastFMCrowns.length;
        guild.LastFMCrowns = [];
        needsUpdate = true;
      }

      // Clean MessageStats (remove corrupted ones)
      if (guild.MessageStats && guild.MessageStats.length > 0) {
        const originalLength = guild.MessageStats.length;
        guild.MessageStats = guild.MessageStats.filter(stat => 
          stat.date && stat.userId
        );
        const removed = originalLength - guild.MessageStats.length;
        if (removed > 0) {
          totalMessageStatsRemoved += removed;
          needsUpdate = true;
        }
      }

      // Remove all Sprints
      if (guild.Sprints && guild.Sprints.length > 0) {
        totalSprintsRemoved += guild.Sprints.length;
        guild.Sprints = [];
        needsUpdate = true;
      }

      if (needsUpdate) {
        await guild.save();
        guildsUpdated++;
      }
    }

    // Reset User data
    const users = await User.find({});
    let usersUpdated = 0;
    let totalLibrariesRemoved = 0;
    let totalSprintHistoryRemoved = 0;

    for (const user of users) {
      let needsUpdate = false;

      // Remove LastFM username
      if (user.LastFMUsername) {
        user.LastFMUsername = null;
        needsUpdate = true;
      }

      // Remove LastFM library
      if (user.LastFMLibrary) {
        user.LastFMLibrary = null;
        totalLibrariesRemoved++;
        needsUpdate = true;
      }

      // Remove Sprint history
      if (user.SprintHistory && user.SprintHistory.length > 0) {
        totalSprintHistoryRemoved += user.SprintHistory.length;
        user.SprintHistory = [];
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        usersUpdated++;
      }
    }

    console.log(chalk.green(`✅ Reset complete: ${guildsUpdated} guilds, ${usersUpdated} users updated`));
    console.log(chalk.gray(`   Removed: ${totalLastFMCrownsRemoved} crowns, ${totalMessageStatsRemoved} corrupted stats, ${totalSprintsRemoved} sprints, ${totalLibrariesRemoved} libraries`));
    
  } catch (error) {
    console.log(chalk.red('❌ Reset failed:', error.message));
  }
}
