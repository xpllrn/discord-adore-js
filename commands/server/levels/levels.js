const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { findUser, findRole } = require('../../../handlers/finder');
const { createConfirmation, createPagination } = require('../../../core/buttons');
const guildCache = require('../../../database/cache/models/guild');
const { colors, emojis } = require('../../../config/setup');

module.exports = {
  name: "levels",
  aliases: ['lvl', 'level', 'rank'],
  description: "Manage the leveling system for your server",
  usage: `{guildprefix}levels [@user]
{guildprefix}levels leaderboard

{guildprefix}levels unlock
{guildprefix}levels lock
{guildprefix}levels add [@role] [level]
{guildprefix}levels remove [level]
{guildprefix}levels set [@user] [level]
{guildprefix}levels sync
{guildprefix}levels messagemode [none/channel/context]

{guildprefix}levels reset
{guildprefix}levels cleanup`,
  run: async (client, message, args) => {
    try {
      await ensureGuildData(message.guild.id);

      if (!args[0]) {
        // Show user's own level if no arguments
        return await handleViewLevel(client, message, []);
      }

      const subcommand = args[0].toLowerCase();

      // Handle subcommands that require Manage Guild permissions
      if (['unlock', 'lock', 'add', 'remove', 'set', 'sync', 'messagemode'].includes(subcommand)) {
        if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;
      }

      // Handle subcommands that require Administrator permissions
      if (['reset', 'cleanup'].includes(subcommand)) {
        if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;
      }

      switch (subcommand) {
        case 'unlock':
          return await handleUnlock(client, message, args);
        case 'lock':
          return await handleLock(client, message, args);
        case 'reset':
          return await handleReset(client, message, args);
        case 'cleanup':
          return await handleCleanup(client, message, args);
        case 'leaderboard':
        case 'lb':
          return await handleLeaderboard(client, message, args);
        case 'add':
          return await handleAddRole(client, message, args);
        case 'remove':
        case 'rm':
          return await handleRemoveRole(client, message, args);
        case 'set':
          return await handleSetLevel(client, message, args);
        case 'sync':
          return await handleSync(client, message, args);
        case 'messagemode':
          return await handleMessageMode(client, message, args);
        default:
          // Try to find user for level viewing
          return await handleViewLevel(client, message, args);
      }

    } catch (error) {
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Levels Command', {
          command: 'levels',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      return embeds.deny(message, 'An error occurred while processing the levels command.');
    }
  }
};

// Unlock subcommand
async function handleUnlock(client, message, args) {
  const isEnabled = await guildCache.isLevelSystemEnabled(message.guild.id);
  
  if (isEnabled) {
    return embeds.warn(message, 'Leveling system is already **enabled**');
  }

  await guildCache.enableLevelSystem(message.guild.id);
  return embeds.success(message, 'Leveling system has been **enabled**');
}

// Lock subcommand
async function handleLock(client, message, args) {
  const isEnabled = await guildCache.isLevelSystemEnabled(message.guild.id);
  
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is already **disabled**');
  }

  await guildCache.disableLevelSystem(message.guild.id);
  return embeds.success(message, 'Leveling system has been **disabled**');
}

// View level subcommand
async function handleViewLevel(client, message, args) {
  let targetUser = message.author;
  let targetMember = message.member;

  // If user provided an argument, find the target user
  if (args[0]) {
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found || !userResult.user) {
      return embeds.deny(message, userResult.error || 'User not found!');
    }
    targetUser = userResult.user.user || userResult.user;
    targetMember = userResult.user;
  }

  // Check if level system is enabled
  const isEnabled = await guildCache.isLevelSystemEnabled(message.guild.id);
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is **disabled** in this server');
  }

  // Get user level data
  const userData = await guildCache.getUserLevel(message.guild.id, targetUser.id);
  const userRank = await guildCache.getUserRank(message.guild.id, targetUser.id);
  const totalMembers = await guildCache.getUserLeaderboard(message.guild.id, 1000);

  // Calculate progress
  const requiredExp = guildCache.getRequiredExperience(userData.level);
  const progress = Math.floor((userData.experience / requiredExp) * 10);

  // Create progress bar
  let progressBar = '';
  for (let i = 0; i < 10; i++) {
    if (i === 0) {
      progressBar += progress > 0 ? emojis.blueLeftRounded : emojis.whiteLeftRounded;
    } else if (i === 9) {
      progressBar += progress > 9 ? emojis.blueRightRounded : emojis.whiteRightRounded;
    } else {
      progressBar += progress > i ? emojis.blue : emojis.white;
    }
  }

  const progressPercentage = Math.floor((userData.experience / requiredExp) * 100);

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setAuthor({
      name: targetUser.username,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })
    .addFields(
      { name: '**Level**', value: userData.level.toString(), inline: true },
      { name: '**Server Rank**', value: `${userRank || 'N/A'} out of ${totalMembers.length}`, inline: true },
      { name: '**Exp**', value: `${userData.experience}/${requiredExp}`, inline: true },
      { name: `**Progress (${progressPercentage}%)**`, value: progressBar, inline: false }
    );

  return message.channel.send({ embeds: [embed] });
}

// Reset subcommand
async function handleReset(client, message, args) {
  await createConfirmation(
    message,
    'Are you sure you want to **reset all members\' level and XP data**? This action cannot be undone.',
    async (interaction) => {
      await guildCache.resetAllUserLevels(message.guild.id);

      const successEmbed = new EmbedBuilder()
        .setColor(colors.success)
        .setDescription(`${emojis.success} <@${message.author.id}>: Reset all members' level and XP data`);

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }
  );
}

// Cleanup subcommand
async function handleCleanup(client, message, args) {
  const userLevels = await guildCache.getUserLeaderboard(message.guild.id, 1000);
  let removedCount = 0;

  for (const userData of userLevels) {
    try {
      const member = await message.guild.members.fetch(userData.userId);
      if (!member) {
        await guildCache.removeUserLevel(message.guild.id, userData.userId);
        removedCount++;
      }
    } catch (error) {
      // User not in guild anymore
      await guildCache.removeUserLevel(message.guild.id, userData.userId);
      removedCount++;
    }
  }

  return embeds.success(message, `Cleaned up level data for **${removedCount}** members who left the server`);
}

// Leaderboard subcommand
async function handleLeaderboard(client, message, args) {
  const isEnabled = await guildCache.isLevelSystemEnabled(message.guild.id);
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is **disabled** in this server');
  }

  try {
    const leaderboard = await guildCache.getUserLeaderboard(message.guild.id, 1000);

    if (leaderboard.length === 0) {
      return embeds.warn(message, 'No level data found');
    }

    const userPosition = await guildCache.getUserRank(message.guild.id, message.author.id);

    // Pre-fetch all usernames to avoid async issues in pagination
    const leaderboardWithUsernames = await Promise.all(
      leaderboard.map(async (userData, index) => {
        let username = `User ${index + 1}`;

        // Extract userId from userData
        const userId = userData.userId;

        try {
          // Try to get from guild members first (most reliable)
          const member = message.guild.members.cache.get(userId);
          if (member) {
            username = member.displayName;
          } else {
            // Try to get from Discord users cache
            const cachedUser = client.users.cache.get(userId);
            if (cachedUser) {
              username = cachedUser.username;
            } else if (userId && /^\d{17,19}$/.test(userId)) {
              // Try to fetch from Discord API (with timeout)
              try {
                const fetchedUser = await Promise.race([
                  client.users.fetch(userId),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
                if (fetchedUser) {
                  username = fetchedUser.username;
                }
              } catch (fetchError) {
                // Use fallback with user ID
                username = `User ${userId.slice(-4)}`;
              }
            }
          }
        } catch (error) {
          // Use position-based fallback if everything fails
          username = `User ${index + 1}`;
        }

        return {
          ...userData,
          userId: userId,
          username: username
        };
      })
    );

    const formatPage = (pageUsers, currentPage, totalPages) => {
      const startIndex = (currentPage - 1) * 10;

      const leaderboardList = pageUsers.map((userData, index) => {
        const position = startIndex + index + 1;
        return `\`${position.toString().padStart(2, '0')}\` **${userData.username}** - Level ${userData.level} (${userData.totalExperience} XP)`;
      }).join('\n');

      const footerText = userPosition
        ? `Your position: #${userPosition} • Page ${currentPage}/${totalPages}`
        : `Page ${currentPage}/${totalPages}`;

      return new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle('Level Leaderboard')
        .setDescription(leaderboardList)
        .setFooter({ text: footerText });
    };

    await createPagination(message, leaderboardWithUsernames, formatPage, 10, 'Level Leaderboard');
  } catch (error) {
    if (client?.errorLogger) {
      client.errorLogger.log(error, 'Level Leaderboard', {
        command: 'levels leaderboard',
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
    return embeds.deny(message, 'Failed to retrieve level leaderboard');
  }
}

// Add role subcommand
async function handleAddRole(client, message, args) {
  if (!args[1] || !args[2]) {
    return runHelpCommand(message, 'levels');
  }

  const roleResult = message.mentions.roles.first() ?
    { found: true, role: message.mentions.roles.first() } :
    findRole(message.guild, args[1]);

  if (!roleResult.found) {
    return embeds.deny(message, roleResult.error);
  }

  const role = roleResult.role;
  const level = parseInt(args[2]);

  if (isNaN(level) || level < 1 || level > 1000) {
    return embeds.deny(message, 'Level must be a number between **1** and **1000**');
  }

  // Check role hierarchy
  if (role.position >= message.guild.members.me.roles.highest.position) {
    return embeds.deny(message, 'I cannot manage this role due to role hierarchy');
  }

  if (role.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
    return embeds.deny(message, 'You cannot manage this role due to role hierarchy');
  }

  await guildCache.addLevelRole(message.guild.id, level, role.id);
  return embeds.success(message, `Added **${role.name}** as level **${level}** role`);
}

// Remove role subcommand
async function handleRemoveRole(client, message, args) {
  if (!args[1]) {
    return runHelpCommand(message, 'levels');
  }

  const level = parseInt(args[1]);

  if (isNaN(level) || level < 1) {
    return embeds.deny(message, 'Please provide a valid level number');
  }

  const removed = await guildCache.removeLevelRole(message.guild.id, level);

  if (removed) {
    return embeds.success(message, `Removed level role for level **${level}**`);
  } else {
    return embeds.warn(message, `No level role found for level **${level}**`);
  }
}

// Set level subcommand
async function handleSetLevel(client, message, args) {
  if (!args[1] || !args[2]) {
    return runHelpCommand(message, 'levels');
  }

  // Check if level system is enabled
  const isEnabled = await guildCache.isLevelSystemEnabled(message.guild.id);
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is **disabled** in this server. Use `levels unlock` to enable it.');
  }

  // Find the target user
  const userResult = await findUser(message.guild, args[1], client);
  if (!userResult.found || !userResult.user) {
    return embeds.deny(message, userResult.error || 'User not found!');
  }

  const targetUser = userResult.user.user || userResult.user;
  const level = parseInt(args[2]);

  if (isNaN(level) || level < 1 || level > 1000) {
    return embeds.deny(message, 'Level must be a number between **1** and **1000**');
  }

  // Set the user's level
  await guildCache.setUserLevel(message.guild.id, targetUser.id, level, 0);

  return embeds.success(message, `Set **${targetUser.username}**'s level to **${level}**`);
}

// Sync subcommand
async function handleSync(client, message, args) {
  const lastSyncTime = await guildCache.getLastSyncTime(message.guild.id);
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

  if (lastSyncTime && lastSyncTime > twoHoursAgo) {
    const timeLeft = Math.ceil((lastSyncTime.getTime() + (2 * 60 * 60 * 1000) - now.getTime()) / (60 * 1000));
    return embeds.warn(message, `Level role sync is on cooldown. Try again in **${timeLeft}** minutes`);
  }

  const levelRoles = await guildCache.getLevelRoles(message.guild.id);
  if (levelRoles.length === 0) {
    return embeds.warn(message, 'No level roles configured');
  }

  const userLevels = await guildCache.getUserLeaderboard(message.guild.id, 1000);
  let syncedCount = 0;

  for (const userData of userLevels) {
    try {
      const member = await message.guild.members.fetch(userData.userId);
      if (!member) continue;

      // Find roles user should have based on their level
      const eligibleRoles = levelRoles.filter(lr => lr.level <= userData.level);

      for (const levelRole of eligibleRoles) {
        const role = message.guild.roles.cache.get(levelRole.roleId);
        if (role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role);
          syncedCount++;
        }
      }
    } catch (error) {
      // Skip members that can't be fetched or roles that can't be added
      continue;
    }
  }

  await guildCache.updateLastSyncTime(message.guild.id);
  return embeds.success(message, `Synced level roles for **${syncedCount}** members`);
}

// Message mode subcommand
async function handleMessageMode(client, message, args) {
  if (!args[1]) {
    const currentMode = await guildCache.getLevelMessageMode(message.guild.id);
    return embeds.info(message, `Current level up message mode: **${currentMode}**`);
  }

  const mode = args[1].toLowerCase();

  if (!['none', 'channel', 'context'].includes(mode)) {
    return embeds.deny(message, 'Invalid mode. Use: **none**, **channel**, or **context**');
  }

  await guildCache.setLevelMessageMode(message.guild.id, mode);

  let description;
  switch (mode) {
    case 'none':
      description = 'Level up messages are now **disabled**';
      break;
    case 'channel':
      description = 'Level up messages will be sent in a **specific channel** (use `levels channel` to set)';
      break;
    case 'context':
      description = 'Level up messages will be sent **where the user is talking**';
      break;
  }

  return embeds.success(message, description);
}
