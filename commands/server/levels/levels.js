const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { findUser, findRole } = require('../../../handlers/finder');
const { createConfirmation, createPagination } = require('../../../core/buttons');
const { getService } = require('@services');
const { colors, emojis } = require('../../../config/setup');

module.exports = {
  name: "levels",
  aliases: ['level', 'lvl', 'rank'],
  description: "Manage the leveling system for your server",
  isGroupCommand: true,
  run: async (client, message, args) => {
    try {
      await ensureGuildData(message.guild.id);

      if (!args[0]) {
        // Show user's own level if no arguments
        return await handleViewLevel(client, message, []);
      }

      const subcommand = args[0].toLowerCase();

      // Handle subcommands that require Manage Guild permissions
      if (['unlock', 'enable', 'lock', 'disable', 'add', 'remove', 'set', 'sync', 'messagemode'].includes(subcommand)) {
        if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;
      }

      // Handle subcommands that require Administrator permissions
      if (['reset', 'cleanup'].includes(subcommand)) {
        if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;
      }

      switch (subcommand) {
        case 'unlock':
        case 'enable': {
          const subcommandInfo = {
            description: 'Enable the leveling system',
            usage: '{guildprefix}levels unlock',
            aliases: ['enable'],
            parameters: [],
            example: '{guildprefix}levels unlock'
          };
          return await handleUnlock(client, message, args);
        }
        case 'lock':
        case 'disable': {
          const subcommandInfo = {
            description: 'Disable the leveling system',
            usage: '{guildprefix}levels lock',
            aliases: ['disable'],
            parameters: [],
            example: '{guildprefix}levels lock'
          };
          return await handleLock(client, message, args);
        }
        case 'reset': {
          const subcommandInfo = {
            description: 'Reset all level data',
            usage: '{guildprefix}levels reset',
            aliases: [],
            parameters: [],
            example: '{guildprefix}levels reset'
          };
          return await handleReset(client, message, args);
        }
        case 'cleanup': {
          const subcommandInfo = {
            description: 'Remove level data for users who left',
            usage: '{guildprefix}levels cleanup',
            aliases: [],
            parameters: [],
            example: '{guildprefix}levels cleanup'
          };
          return await handleCleanup(client, message, args);
        }
        case 'leaderboard':
        case 'lb': {
          const subcommandInfo = {
            description: 'Show the server level leaderboard',
            usage: '{guildprefix}levels leaderboard',
            aliases: ['lb'],
            parameters: [],
            example: '{guildprefix}levels lb'
          };
          return await handleLeaderboard(client, message, args);
        }
        case 'add': {
          const subcommandInfo = {
            description: 'Add a level role reward',
            usage: '{guildprefix}levels add [@role] [level]',
            aliases: [],
            parameters: ['role', 'level'],
            example: '{guildprefix}levels add @VIP 10'
          };
          return await handleAddRole(client, message, args);
        }
        case 'remove':
        case 'rm': {
          const subcommandInfo = {
            description: 'Remove a level role reward',
            usage: '{guildprefix}levels remove [level]',
            aliases: ['rm'],
            parameters: ['level'],
            example: '{guildprefix}levels remove 10'
          };
          return await handleRemoveRole(client, message, args);
        }
        case 'set': {
          const subcommandInfo = {
            description: 'Set a user\'s level',
            usage: '{guildprefix}levels set [@user] [level]',
            aliases: [],
            parameters: ['user', 'level'],
            example: '{guildprefix}levels set @user 25'
          };
          return await handleSetLevel(client, message, args);
        }
        case 'sync': {
          const subcommandInfo = {
            description: 'Sync level roles for all members',
            usage: '{guildprefix}levels sync',
            aliases: [],
            parameters: [],
            example: '{guildprefix}levels sync'
          };
          return await handleSync(client, message, args);
        }
        case 'messagemode': {
          const subcommandInfo = {
            description: 'Configure level up message mode',
            usage: '{guildprefix}levels messagemode [none/channel/context] [#channel]',
            aliases: [],
            parameters: ['mode', 'channel (optional)'],
            example: '{guildprefix}levels messagemode channel #level-ups'
          };
          return await handleMessageMode(client, message, args);
        }
        case 'message': {
          const subcommandInfo = {
            description: 'Manage custom level up messages',
            usage: '{guildprefix}levels message [message/remove/none/view/variables]',
            aliases: [],
            parameters: ['action'],
            example: '{guildprefix}levels message {user.mention} leveled up to {level.new_rank}!'
          };
          return await handleLevelMessage(client, message, args);
        }

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
  const guildService = getService('guild');
  const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);

  if (isEnabled) {
    return embeds.warn(message, 'Leveling system is already **enabled**');
  }

  await guildService.enableLevelSystem(message.guild.id);
  return embeds.success(message, 'Leveling system has been **enabled**');
}

// Lock subcommand
async function handleLock(client, message, args) {
  const guildService = getService('guild');
  const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);

  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is already **disabled**');
  }

  await guildService.disableLevelSystem(message.guild.id);
  return embeds.success(message, 'Leveling system has been **disabled**');
}

// View level subcommand
async function handleViewLevel(client, message, args) {
  const guildService = getService('guild');

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
  const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is **disabled** in this server');
  }

  // Get user level data
  const userData = await guildService.getUserLevel(message.guild.id, targetUser.id);
  const userRank = await guildService.getUserRank(message.guild.id, targetUser.id);
  const totalMembers = await guildService.getUserLeaderboard(message.guild.id, 1000);

  // Calculate progress
  const requiredExp = guildService.getRequiredExperience(userData.level);
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
  const guildService = getService('guild');
  await createConfirmation(
    message,
    'Are you sure you want to **reset all members\' level and XP data**? This action cannot be undone.',
    async (interaction) => {

      await guildService.resetAllUserLevels(message.guild.id);

      const successEmbed = new EmbedBuilder()
        .setColor(colors.success)
        .setDescription(`${emojis.success} <@${message.author.id}>: Reset all members' level and XP data`);

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }
  );
}

// Cleanup subcommand
async function handleCleanup(client, message, args) {
  const guildService = getService('guild');

  const userLevels = await guildService.getUserLeaderboard(message.guild.id, 1000);
  let removedCount = 0;

  for (const userData of userLevels) {
    try {
      const member = await message.guild.members.fetch(userData.userId);
      if (!member) {
        await guildService.removeUserLevel(message.guild.id, userData.userId);
        removedCount++;
      }
    } catch (error) {
      // User not in guild anymore
      await guildService.removeUserLevel(message.guild.id, userData.userId);
      removedCount++;
    }
  }

  return embeds.success(message, `Cleaned up level data for **${removedCount}** members who left the server`);
}

// Leaderboard subcommand
async function handleLeaderboard(client, message, args) {
  const guildService = getService('guild');
  const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is **disabled** in this server');
  }

  try {
    const leaderboard = await guildService.getUserLeaderboard(message.guild.id, 1000);

    if (leaderboard.length === 0) {
      return embeds.warn(message, 'No level data found');
    }

    const userPosition = await guildService.getUserRank(message.guild.id, message.author.id);

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
        return `\`${position.toString().padStart(2, '0')}\` **${userData.username}** - Level ${userData.level} (\`${userData.experience} XP\`)`;
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
  const guildService = getService('guild');
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

  await guildService.addLevelRole(message.guild.id, level, role.id);
  return embeds.success(message, `Added **${role.name}** as level **${level}** role`);
}

// Remove role subcommand
async function handleRemoveRole(client, message, args) {
  const guildService = getService('guild');
  if (!args[1]) {
    return runHelpCommand(message, 'levels');
  }

  const level = parseInt(args[1]);

  if (isNaN(level) || level < 1) {
    return embeds.deny(message, 'Please provide a valid level number');
  }

  const removed = await guildService.removeLevelRole(message.guild.id, level);

  if (removed) {
    return embeds.success(message, `Removed level role for level **${level}**`);
  } else {
    return embeds.warn(message, `No level role found for level **${level}**`);
  }
}

// Set level subcommand
async function handleSetLevel(client, message, args) {
  const guildService = getService('guild');
  if (!args[1] || !args[2]) {
    return runHelpCommand(message, 'levels');
  }

  // Check if level system is enabled
  const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is **disabled** in this server. Use `levels unlock` or `levels enable` to enable it.');
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
  await guildService.setUserLevel(message.guild.id, targetUser.id, level, 0);

  return embeds.success(message, `Set **${targetUser.username}**'s level to **${level}**`);
}

// Sync subcommand
async function handleSync(client, message, args) {
  const guildService = getService('guild');
  const lastSyncTime = await guildService.getLastSyncTime(message.guild.id);
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

  if (lastSyncTime && lastSyncTime > twoHoursAgo) {
    const timeLeft = Math.ceil((lastSyncTime.getTime() + (2 * 60 * 60 * 1000) - now.getTime()) / (60 * 1000));
    return embeds.warn(message, `Level role sync is on cooldown. Try again in **${timeLeft}** minutes`);
  }

  const levelRoles = await guildService.getLevelRoles(message.guild.id);
  if (levelRoles.length === 0) {
    return embeds.warn(message, 'No level roles configured');
  }

  const userLevels = await guildService.getUserLeaderboard(message.guild.id, 1000);
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

  await guildService.updateLastSyncTime(message.guild.id);
  return embeds.success(message, `Synced level roles for **${syncedCount}** members`);
}

// Message mode subcommand
async function handleMessageMode(client, message, args) {
  const guildService = getService('guild');
  if (!args[1]) {
    const currentMode = await guildService.getLevelMessageMode(message.guild.id);
    return embeds.info(message, `Current level up message mode: **${currentMode}**`);
  }

  const mode = args[1].toLowerCase();

  if (!['none', 'channel', 'context'].includes(mode)) {
    return embeds.deny(message, 'Invalid mode. Use: **none**, **channel**, or **context**');
  }

  // If mode is 'channel' but no channel is provided, show help
  if (mode === 'channel' && !args[2]) {
    return runHelpCommand(message, 'levels');
  }

  let description;

  if (mode === 'channel') {
    // Find the target channel
    const targetChannel = message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[2]) ||
      message.guild.channels.cache.find(ch => ch.name.toLowerCase() === args[2].toLowerCase());

    if (!targetChannel) {
      return embeds.deny(message, 'Channel not found! Please mention a valid channel or provide a valid channel ID/name.');
    }

    if (!targetChannel.isTextBased()) {
      return embeds.deny(message, 'Please select a text channel for level up messages.');
    }

    // Check if bot has permission to send messages in that channel
    if (!targetChannel.permissionsFor(message.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
      return embeds.deny(message, `I don't have permission to send messages in ${targetChannel}. Please ensure I have **Send Messages** and **Embed Links** permissions.`);
    }

    // Set both the mode and the channel
    await guildService.setLevelMessageMode(message.guild.id, mode);
    await guildService.setLevelUpChannel(message.guild.id, targetChannel.id);

    description = `Level up messages will now be sent in ${targetChannel}`;
  } else {
    // For 'none' and 'context' modes
    await guildService.setLevelMessageMode(message.guild.id, mode);

    switch (mode) {
      case 'none':
        description = 'Level up messages are now **disabled**';
        break;
      case 'context':
        description = 'Level up messages will be sent **where the user is talking**';
        break;
    }
  }

  return embeds.success(message, description);
}

// Level message subcommand
async function handleLevelMessage(client, message, args) {
  const guildService = getService('guild');
  
  if (!args[1]) return false;

  // Handle view subcommand
  if (args[1] === 'view') {
    const customMessage = await guildService.getLevelCustomMessage(message.guild.id);

    if (customMessage) {
      // Use EmbedVariableProcessor to handle the custom message with variables
      const { EmbedVariableProcessor } = require('../../../utils/embedbuilder');
      EmbedVariableProcessor.process(message.channel, customMessage, {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        level: { new_rank: 25 } // Example level for preview
      });
    } else {
      // Show default message preview
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`**${message.member?.displayName || message.author.username}** had **leveled up**!\n> They are now **level 25**, yayyyyy`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

      return message.channel.send({ 
        content: `**Preview of default level message:**\n${message.author}`,
        embeds: [embed] 
      });
    }
    return;
  }

  // Handle variables subcommand
  if (args[1] === 'variables') {
    const member = message.author;
    const embed = new EmbedBuilder()
      .setColor(colors.info)
      .setTitle('Level Up Message Variables')
      .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{level.new_rank}\` — Member's new level at time of level up`);

    return message.channel.send({ embeds: [embed] });
  }

  // Require Manage Guild permission for setting/removing messages
  if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

  try {
    const levelMessage = args.slice(1).join(' ');

    // Handle remove/none command
    if (levelMessage.toLowerCase() === 'remove' || levelMessage.toLowerCase() === 'none') {
      await guildService.removeLevelCustomMessage(message.guild.id);
      return embeds.success(message, "Custom level message has been removed. The default message will now be used.");
    }

    // Check if the message contains the required {level.new_rank} variable
    if (!levelMessage.includes('{level.new_rank}')) {
      return embeds.deny(message, 'Level up messages **must** include the `{level.new_rank}` variable to show the user\'s new level.');
    }

    // Set the custom message
    await guildService.setLevelCustomMessage(message.guild.id, levelMessage);

    return embeds.success(message, "Custom level message has been set successfully!");
  } catch (error) {
    console.error('Level message error:', error);
    return embeds.deny(message, `Failed to set level message: ${error.message}`);
  }
}


