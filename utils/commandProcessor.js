const { Collection, PermissionFlagsBits } = require('discord.js');
const config = require('../config/setup');
const prefixCache = require('../database/cache/models/prefix');
const { embeds } = require('../core/embeds');
const { hasPermissionLevel, hasDiscordPermission, hasMultipleDiscordPermissions, checkPermissionLevel } = require('./permissions');
const { User } = require('../database');

const cooldowns = new Collection();

/**
 * Process command with prefix detection and cooldown handling
 * @param {Message} message - Discord message object
 * @param {boolean} isEdit - Whether this is an edited message
 */
async function processCommand(message, isEdit = false) {
  if (!message.client || !message.client.commands) return;
  if (!message.guild) return; // Skip DMs
  if (message.author.bot) return; // Skip bots

  const client = message.client;

  // Check if database models are available before processing commands
  const { getModels, isDatabaseReady } = require('../database');
  if (!isDatabaseReady()) {
    // Silently skip commands if database is not ready
    return;
  }

  const models = getModels();
  if (!models || !models.User || !models.Guild || !models.System) {
    // Silently skip commands if database models are not ready
    return;
  }

  // Check if cache system is ready before processing commands
  if (!client.cacheReady) {
    // Send a one-time message if cache is not ready (to avoid spam)
    if (!client.cacheNotReadyMessageSent) {
      console.log(`⏳ Cache not ready, skipping command from ${message.author.tag}`);
      client.cacheNotReadyMessageSent = true;
      
      // Clear the flag after 30 seconds to allow occasional status updates
      setTimeout(() => {
        client.cacheNotReadyMessageSent = false;
      }, 30000);
    }
    return;
  }

  // Check for valid prefix
  const prefixResult = await prefixCache.checkPrefixes(message);
  if (!prefixResult) return;

  const { prefix } = prefixResult;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Find command
  const command = client.commands.get(commandName) ||
                 client.commands.get(client.aliases.get(commandName));

  if (!command) return;



  try {
    // Check if user is blacklisted (skip for blacklist command itself)
    if (command.name !== 'blacklist') {
      const isBlacklisted = await checkUserBlacklist(message.author.id);
      if (isBlacklisted) {
        return; // Silently ignore blacklisted users
      }
    }

    // Check command permissions
    if (command.permission) {
      const hasPermission = await checkCommandPermission(message, command.permission);
      if (!hasPermission) return; // Return after permission check (dev silently ignored, others get error message)
    }

    // Handle cooldowns
    if (!isEdit) { // Don't apply cooldowns to edited messages
      const cooldownResult = handleCooldown(message, command);
      if (cooldownResult) {
        return embeds.warn(message, cooldownResult);
      }
    }

    // Execute command (support both execute and run methods)
    let commandResult;
    if (command.execute) {
      commandResult = await command.execute(message, args, client);
    } else if (command.run) {
      commandResult = await command.run(client, message, args);
    } else {
      throw new Error(`Command ${command.name} has no execute or run method`);
    }

    // If command has autoHelp enabled (default: true) and returned false (indicating invalid usage)
    if (command.autoHelp !== false && commandResult === false) {
      await runHelpCommand(message, command.name);
    }

  } catch (error) {
    // Handle InvalidUsageError by showing help
    if (error instanceof InvalidUsageError) {
      return await runHelpCommand(message, command.name);
    }

    // Log error to Discord webhook if error logger is available
    if (client.errorLogger) {
      client.errorLogger.log(error, `Command Execution: ${command.name}`, {
        command: command.name,
        args: args.join(' ') || '',
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }

    embeds.deny(message, 'There was an error **executing** that command, Please report this to **adore server** immediately.');
  }
}

/**
 * Check if user has permission to run command
 * Dev permissions are silently ignored, others show error messages
 * @param {Message} message - Discord message object
 * @param {string} permission - Permission requirement
 * @returns {Promise<boolean>} Whether user has permission
 */
async function checkCommandPermission(message, permission) {
  // Map permission strings to permission checks
  switch (permission.toLowerCase()) {
    case 'administrator':
      return hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator');

    case 'manage messages':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages');

    case 'manage guild':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild');

    case 'manage expressions':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageGuildExpressions, 'Manage Expressions');

    case 'moderate members':
      return hasDiscordPermission(message, PermissionFlagsBits.ModerateMembers, 'Moderate Members');

    case 'manage guild & manage roles':
      return hasMultipleDiscordPermissions(message,
        [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
        ['Manage Guild', 'Manage Roles']);

    case 'manage roles':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles');

    case 'manage channels':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels');

    case 'manage nicknames':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageNicknames, 'Manage Nicknames');

    case 'ban members':
      return hasDiscordPermission(message, PermissionFlagsBits.BanMembers, 'Ban Members');

    case 'kick members':
      return hasDiscordPermission(message, PermissionFlagsBits.KickMembers, 'Kick Members');

    case 'premium':
      return await checkPermissionLevel(message, 'premium');

    case 'dev':
      // Dev permissions are silently ignored (no error message)
      return await hasPermissionLevel(message, 'dev');

    default:
      return true; // Allow by default for unknown permissions
  }
}

/**
 * Handle command cooldowns
 * @param {Message} message - Discord message object
 * @param {Object} command - Command object
 * @returns {string|null} Cooldown message or null if no cooldown
 */
function handleCooldown(message, command) {
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldowns || 3) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      const timeString = timeLeft >= 60
        ? `${Math.floor(timeLeft / 60)}m ${Math.floor(timeLeft % 60)}s`
        : `${timeLeft.toFixed(1)}s`;
      return `Please wait **${timeString}** before using \`${command.name}\` again.`;
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  return null;
}

/**
 * Get the current prefix for a guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<string>} Guild prefix
 */
async function getGuildPrefix(guildId) {
  return await prefixCache.getGuildPrefix(guildId);
}

/**
 * Get the current self prefix for a user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} User self prefix or null
 */
async function getUserPrefix(userId) {
  return await prefixCache.getUserPrefix(userId);
}

/**
 * Set guild prefix
 * @param {string} guildId - Guild ID
 * @param {string} prefix - New prefix
 * @returns {Promise<boolean>} Success status
 */
async function setGuildPrefix(guildId, prefix) {
  return await prefixCache.setGuildPrefix(guildId, prefix);
}

/**
 * Set user self prefix
 * @param {string} userId - User ID
 * @param {string} prefix - New self prefix
 * @returns {Promise<boolean>} Success status
 */
async function setUserPrefix(userId, prefix) {
  return await prefixCache.setUserPrefix(userId, prefix);
}

/**
 * Clear user self prefix
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function clearUserPrefix(userId) {
  return await prefixCache.clearUserPrefix(userId);
}

/**
 * Check if user is blacklisted using cache system
 * @param {string} userId - Discord user ID
 * @returns {Promise<boolean>} Whether user is blacklisted
 */
async function checkUserBlacklist(userId) {
  const systemCache = require('../database/cache/models/system');
  return await systemCache.getUserBlacklist(userId);
}

/**
 * Custom error class for invalid command usage
 */
class InvalidUsageError extends Error {
  constructor(commandName) {
    super(`Invalid usage for command: ${commandName}`);
    this.name = 'InvalidUsageError';
    this.commandName = commandName;
  }
}

/**
 * Run help command for a specific command
 * @param {Message} message - Discord message object
 * @param {string} commandName - Name of command to show help for
 */
async function runHelpCommand(message, commandName) {
  const client = message.client;
  const helpCommand = client.commands.get('help') || client.commands.get('h');

  if (helpCommand && helpCommand.run) {
    await helpCommand.run(client, message, [commandName]);
  }
}

module.exports = {
  processCommand,
  getGuildPrefix,
  getUserPrefix,
  setGuildPrefix,
  setUserPrefix,
  clearUserPrefix,
  runHelpCommand,
  InvalidUsageError
};
