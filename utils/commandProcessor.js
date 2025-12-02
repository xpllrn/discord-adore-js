const { Collection, PermissionFlagsBits } = require('discord.js');
const config = require('../config/setup');
const { embeds } = require('../core/embeds');
const { hasPermissionLevel, hasDiscordPermission, hasMultipleDiscordPermissions, checkPermissionLevel } = require('./permissions');
const { getService } = require('@services');

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

  // Check for valid prefix using new PrefixService
  const prefixService = getService('prefix');
  const prefixResult = await prefixService.resolvePrefix(message);
  if (!prefixResult) return;

  const { prefix, content } = prefixResult;
  let args = content.trim().split(/ +/);
  let commandName = args.shift().toLowerCase();

  // Check for guild aliases first
  const guildService = getService('guild');
  const guildData = await guildService.get(message.guild.id);
  const guildAliases = guildData?.Aliases || [];

  // Find matching alias
  const guildAlias = guildAliases.find(a => a.shortcut === commandName);

  if (guildAlias) {
    // Check if alias contains {0} placeholder
    if (guildAlias.command.includes('{0}')) {
      // Get the first argument to replace {0}
      const placeholderValue = args.shift() || '';

      // Replace {0} with the first argument
      const expandedCommand = guildAlias.command.replace(/\{0\}/g, placeholderValue);

      // Parse the expanded command
      const aliasCommand = expandedCommand.split(' ');
      commandName = aliasCommand.shift().toLowerCase();
      // Prepend expanded alias args to remaining user args
      args = [...aliasCommand, ...args];
    } else {
      // Original behavior for aliases without placeholders
      const aliasCommand = guildAlias.command.split(' ');
      commandName = aliasCommand.shift().toLowerCase();
      // Prepend alias args to user args
      args = [...aliasCommand, ...args];
    }
  }

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
        return embeds.cooldown(message, cooldownResult);
      }
    }

    // Execute command (support both execute and run methods)
    // Prioritize run() for prefix commands, but also support unified execute()
    let commandResult;
    if (command.run) {
      commandResult = await command.run(client, message, args);
    } else if (command.execute) {
      // Unified execute method that works for both prefix and slash
      commandResult = await command.execute(message, args);
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

    // Handle permission errors with fallback chain
    if (error.code === 50013) {
      return await handlePermissionError(message, 'There was an error executing that command due to missing permissions.');
    }

    // Log error to console and webhook
    const logger = require('./logger');
    const cmdName = command?.name || commandName || 'Unknown';
    
    // Log to console first
    logger.console.error(`Command Error [${cmdName}]:`, error.message);
    logger.console.error(error.stack);
    
    // Log to webhook
    await logger.webhook.error(error, message);

    // Try to send error message with fallback chain
    try {
      await embeds.deny(message, 'There was an error **executing** that command, Please report this to [**here**](https://adore.rest/server) immediately.');
    } catch (embedError) {
      if (embedError.code === 50013) {
        await handlePermissionError(message, 'There was an error executing that command.');
      }
    }
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
  // Map permission strings to permission checks (underscore format only)
  switch (permission.toLowerCase()) {
    case 'administrator':
      return hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator');

    case 'manage_messages':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages');

    case 'manage_guild':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild');

    case 'manage_expressions':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageGuildExpressions, 'Manage Expressions');

    case 'moderate_members':
      return hasDiscordPermission(message, PermissionFlagsBits.ModerateMembers, 'Moderate Members');

    case 'manage_guild_&_manage_roles':
      return hasMultipleDiscordPermissions(message,
        [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
        ['Manage Guild', 'Manage Roles']);

    case 'manage_guild_&_manage_nicknames':
      return hasMultipleDiscordPermissions(message,
        [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageNicknames],
        ['Manage Guild', 'Manage Nicknames']);

    case 'manage_roles':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles');

    case 'manage_channels':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels');

    case 'manage_nicknames':
      return hasDiscordPermission(message, PermissionFlagsBits.ManageNicknames, 'Manage Nicknames');

    case 'ban_members':
      return hasDiscordPermission(message, PermissionFlagsBits.BanMembers, 'Ban Members');

    case 'kick_members':
      return hasDiscordPermission(message, PermissionFlagsBits.KickMembers, 'Kick Members');

    case 'attach_files':
      return hasDiscordPermission(message, PermissionFlagsBits.AttachFiles, 'Attach Files');

    case 'antinuke_admin':
      // Check if user is antinuke admin or server owner
      const { getService } = require('@services');
      const antinukeService = getService('antinuke');
      const isOwner = message.author.id === message.guild.ownerId;
      const isAntiNukeAdmin = await antinukeService.isAdmin(message.guild.id, message.author.id);
      
      if (!isOwner && !isAntiNukeAdmin) {
        embeds.deny(message, 'You need to be an **antinuke admin** or **server owner** to use this command');
        return false;
      }
      return true;

    case 'server_owner':
      if (message.guild.ownerId !== message.author.id) {
        embeds.deny(message, 'Only the **server owner** can use this command');
        return false;
      }
      return true;

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
 * Get the current prefix for a guild using new PrefixService
 * @param {string} guildId - Guild ID
 * @returns {Promise<string>} Guild prefix
 */
async function getGuildPrefix(guildId) {
  try {
    const prefixService = getService('prefix');
    const result = await prefixService.getGuildPrefix(guildId);
    return result;
  } catch (error) {
    console.error('Error getting guild prefix:', error.message);
    return config.prefix || '!'; // Fallback to default prefix
  }
}

/**
 * Get the current self prefix for a user using new PrefixService
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} User self prefix or null
 */
async function getUserPrefix(userId) {
  try {
    const prefixService = getService('prefix');
    return await prefixService.getUserPrefix(userId);
  } catch (error) {
    console.error('Error getting user prefix:', error.message);
    return null;
  }
}

/**
 * Set guild prefix using new PrefixService
 * @param {string} guildId - Guild ID
 * @param {string} prefix - New prefix
 * @returns {Promise<boolean>} Success status
 */
async function setGuildPrefix(guildId, prefix) {
  console.log(`🔄 [PREFIX-PROCESSOR] Setting prefix for guild ${guildId} to "${prefix}"`);

  try {
    const prefixService = getService('prefix');
    const result = await prefixService.setGuildPrefix(guildId, prefix);
    console.log(`📊 [PREFIX-PROCESSOR] setGuildPrefix returned: ${result}`);
    return result;
  } catch (error) {
    console.error(`❌ [PREFIX-PROCESSOR] Error in setGuildPrefix:`, error.message);
    return false;
  }
}

/**
 * Set user self prefix using new PrefixService
 * @param {string} userId - User ID
 * @param {string} prefix - New self prefix
 * @returns {Promise<boolean>} Success status
 */
async function setUserPrefix(userId, prefix) {
  try {
    const prefixService = getService('prefix');
    return await prefixService.setUserPrefix(userId, prefix);
  } catch (error) {
    console.error('Error setting user prefix:', error.message);
    return false;
  }
}

/**
 * Clear user self prefix using new PrefixService
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function clearUserPrefix(userId) {
  try {
    const prefixService = getService('prefix');
    return await prefixService.clearUserPrefix(userId);
  } catch (error) {
    console.error('Error clearing user prefix:', error.message);
    return false;
  }
}

/**
 * Check if user is blacklisted using new SystemService
 * @param {string} userId - Discord user ID
 * @returns {Promise<boolean>} Whether user is blacklisted
 */
async function checkUserBlacklist(userId) {
  try {
    const systemService = getService('system');
    return await systemService.isUserBlacklisted(userId);
  } catch (error) {
    console.error('Error checking user blacklist:', error.message);
    return false; // Default to not blacklisted on error
  }
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
 * @param {string} subcommandName - Optional subcommand name to show help for
 */
async function runHelpCommand(message, commandName, subcommandName = null) {
  const client = message.client;
  const helpCommand = client.commands.get('help') || client.commands.get('h');

  if (helpCommand && helpCommand.run) {
    const args = subcommandName ? [commandName, subcommandName] : [commandName];
    await helpCommand.run(client, message, args);
  }
}

/**
 * Handle permission errors with fallback chain:
 * 1. Try to send as plain text (if embed permission missing)
 * 2. Try to DM the user
 * 3. Try to react to the message
 * 4. Fail silently
 * 
 * @param {Message} message - Discord message object
 * @param {string} errorText - The error message to send (unused, using fixed message)
 */
async function handlePermissionError(message, errorText) {
  let missingPermType = 'embed';

  // Fallback 1: Try to send as plain text (if only embed permission is missing)
  try {
    const permissionMessage = `I do **NOT** have perms to type **${missingPermType}** in the server, Please **check** adore role perms.`;
    await message.channel.send(`<@${message.author.id}>: ${permissionMessage}`);
    return;
  } catch (textError) {
    // Text message failed, means we can't send messages at all
    missingPermType = 'send';
  }

  // Fallback 2: Try to DM the user
  try {
    const permissionMessage = `I do **NOT** have perms to **${missingPermType}** in the server, Please **check** adore role perms.`;
    await message.author.send(permissionMessage);
    return;
  } catch (dmError) {
    // DM failed, continue to next fallback
  }

  // Fallback 3: Try to react to the message
  try {
    await message.react('❌');
    return;
  } catch (reactionError) {
    // Reaction failed, continue to silent fallback
  }

  // Fallback 4: Fail silently
  // No action needed
}

module.exports = {
  processCommand,
  getGuildPrefix,
  getUserPrefix,
  setGuildPrefix,
  setUserPrefix,
  clearUserPrefix,
  runHelpCommand,
  handlePermissionError,
  InvalidUsageError
};
