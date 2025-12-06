const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { findUser, findRole } = require('../../../handlers/finder');
const { createConfirmation, createPagination } = require('../../../core/buttons');
const { getService } = require('@services');
const { colors, emojis } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "levels",
  aliases: ['level', 'lvl', 'rank'],
  description: "Manage the leveling system for your server",
  syntax: 'levels [subcommand] (parameters)',
  example: 'levels unlock',
  isGroupCommand: true,

  subcommands: {
    unlock: {
      name: 'unlock',
      aliases: ['enable'],
      description: 'Enable the leveling system',
      syntax: '{guildprefix}levels unlock',
      parameters: [],
      example: '{guildprefix}levels unlock',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);

        if (isEnabled) {
          return embeds.warn(message, 'Leveling system is already **enabled**');
        }

        await guildService.enableLevelSystem(message.guild.id);
        return embeds.success(message, 'Leveling system has been **enabled**');
      }
    },

    lock: {
      name: 'lock',
      aliases: ['disable'],
      description: 'Disable the leveling system',
      syntax: '{guildprefix}levels lock',
      parameters: [],
      example: '{guildprefix}levels lock',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);

        if (!isEnabled) {
          return embeds.warn(message, 'Leveling system is already **disabled**');
        }

        await guildService.disableLevelSystem(message.guild.id);
        return embeds.success(message, 'Leveling system has been **disabled**');
      }
    },

    setrate: {
      name: 'setrate',
      aliases: [],
      description: 'Set XP gain multiplier',
      syntax: '{guildprefix}levels setrate [multiplier]',
      parameters: ['multiplier'],
      example: '{guildprefix}levels setrate 2',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) {
          const currentRate = await guildService.getXPRate(message.guild.id);
          return embeds.info(message, `Current XP rate multiplier: **${currentRate}x**`);
        }

        const rate = parseFloat(args[0]);

        if (isNaN(rate) || rate <= 0 || rate > 10) {
          return embeds.deny(message, 'XP rate must be a number between **0.1** and **10**');
        }

        await guildService.setXPRate(message.guild.id, rate);
        return embeds.success(message, `XP rate multiplier set to **${rate}x**`);
      }
    },

    roles: {
      name: 'roles',
      aliases: [],
      description: 'Show all level roles',
      syntax: '{guildprefix}levels roles',
      parameters: [],
      example: '{guildprefix}levels roles',

      handler: async (client, message, args, guildService) => {
        const levelRoles = await guildService.getLevelRoles(message.guild.id);

        if (levelRoles.length === 0) {
          return embeds.warn(message, 'No level roles configured');
        }

        const sortedRoles = levelRoles.sort((a, b) => a.level - b.level);

        const rolesList = sortedRoles.map(lr => {
          const role = message.guild.roles.cache.get(lr.roleId);
          const roleName = role ? role.name : 'Deleted Role';
          return `**Level ${lr.level}** — ${role ? role : roleName}`;
        }).join('\n');

        const stackRoles = await guildService.getStackRoles(message.guild.id);
        const stackText = stackRoles ? 'Roles **stack** (users keep lower level roles)' : 'Roles **don\'t stack** (only highest role is kept)';

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle('Level Roles')
          .setDescription(rolesList)
          .setFooter({ text: stackText });

        return message.channel.send({ embeds: [embed] });
      }
    },

    stack: {
      name: 'stack',
      aliases: [],
      description: 'Toggle role stacking',
      syntax: '{guildprefix}levels stack [on/off]',
      parameters: ['on/off'],
      example: '{guildprefix}levels stack on',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) {
          const currentStack = await guildService.getStackRoles(message.guild.id);
          const status = currentStack ? 'on' : 'off';
          return embeds.info(message, `Role stacking is currently **${status}**`);
        }

        const setting = args[0].toLowerCase();

        if (!['on', 'off', 'true', 'false', 'enable', 'disable'].includes(setting)) {
          return embeds.deny(message, 'Please use **on** or **off**');
        }

        const stack = ['on', 'true', 'enable'].includes(setting);

        await guildService.setStackRoles(message.guild.id, stack);

        const description = stack
          ? 'Role stacking is now **on** — users will keep all level roles they\'ve earned'
          : 'Role stacking is now **off** — users will only have their highest level role';

        return embeds.success(message, description);
      }
    },

    update: {
      name: 'update',
      aliases: [],
      description: 'Update a level role',
      syntax: '{guildprefix}levels update [@role] [level]',
      parameters: ['role', 'level'],
      example: '{guildprefix}levels update @VIP 15',

      handler: async (client, message, args, guildService) => {
        if (!args[0] || !args[1]) {
          return runHelpCommand(message, 'levels');
        }

        const roleResult = findRole(message.guild, args[0]);

        if (!roleResult.found) {
          return embeds.deny(message, roleResult.error);
        }

        const role = roleResult.role;
        const newLevel = parseInt(args[1]);

        if (isNaN(newLevel) || newLevel < 1 || newLevel > 1000) {
          return embeds.deny(message, 'Level must be a number between **1** and **1000**');
        }

        if (role.position >= message.guild.members.me.roles.highest.position) {
          return embeds.deny(message, 'I cannot manage this role due to role hierarchy');
        }

        if (role.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
          return embeds.deny(message, 'You cannot manage this role due to role hierarchy');
        }

        const levelRoles = await guildService.getLevelRoles(message.guild.id);
        const existingRole = levelRoles.find(lr => lr.roleId === role.id);

        if (!existingRole) {
          return embeds.deny(message, `**${role.name}** is not configured as a level role. Use \`levels add\` to add it.`);
        }

        const oldLevel = existingRole.level;

        const conflictRole = levelRoles.find(lr => lr.level === newLevel && lr.roleId !== role.id);
        if (conflictRole) {
          const conflictRoleObj = message.guild.roles.cache.get(conflictRole.roleId);
          const conflictRoleName = conflictRoleObj ? conflictRoleObj.name : 'Unknown Role';
          return embeds.deny(message, `Level **${newLevel}** already has a role assigned (**${conflictRoleName}**). Remove it first or choose a different level.`);
        }

        await guildService.updateLevelRole(message.guild.id, oldLevel, newLevel, role.id);
        return embeds.success(message, `Updated **${role.name}** from level **${oldLevel}** to level **${newLevel}**`);
      }
    },


    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset all level data',
      syntax: '{guildprefix}levels reset',
      parameters: [],
      example: '{guildprefix}levels reset',

      handler: async (client, message, args, guildService) => {
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
    },

    cleanup: {
      name: 'cleanup',
      aliases: [],
      description: 'Remove level data for users who left',
      syntax: '{guildprefix}levels cleanup',
      parameters: [],
      example: '{guildprefix}levels cleanup',

      handler: async (client, message, args, guildService) => {
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
            await guildService.removeUserLevel(message.guild.id, userData.userId);
            removedCount++;
          }
        }

        return embeds.success(message, `Cleaned up level data for **${removedCount}** members who left the server`);
      }
    },

    leaderboard: {
      name: 'leaderboard',
      aliases: ['lb'],
      description: 'Show the server level leaderboard',
      syntax: '{guildprefix}levels leaderboard',
      parameters: [],
      example: '{guildprefix}levels lb',

      handler: async (client, message, args, guildService) => {
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

          const leaderboardWithUsernames = await Promise.all(
            leaderboard.map(async (userData, index) => {
              let username = `User ${index + 1}`;

              const userId = userData.userId;

              try {
                const member = message.guild.members.cache.get(userId);
                if (member) {
                  username = member.displayName;
                } else {
                  const cachedUser = client.users.cache.get(userId);
                  if (cachedUser) {
                    username = cachedUser.username;
                  } else if (userId && /^\d{17,19}$/.test(userId)) {
                    try {
                      const fetchedUser = await Promise.race([
                        client.users.fetch(userId),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                      ]);
                      if (fetchedUser) {
                        username = fetchedUser.username;
                      }
                    } catch (fetchError) {
                      username = `User ${userId.slice(-4)}`;
                    }
                  }
                }
              } catch (error) {
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
    },

    add: {
      name: 'add',
      aliases: [],
      description: 'Add a level role reward',
      syntax: '{guildprefix}levels add [@role] [level]',
      parameters: ['role', 'level'],
      example: '{guildprefix}levels add @VIP 10',

      handler: async (client, message, args, guildService) => {
        if (!args[0] || !args[1]) {
          return runHelpCommand(message, 'levels');
        }

        const roleResult = findRole(message.guild, args[0]);

        if (!roleResult.found) {
          return embeds.deny(message, roleResult.error);
        }

        const role = roleResult.role;
        const level = parseInt(args[1]);

        if (isNaN(level) || level < 1 || level > 1000) {
          return embeds.deny(message, 'Level must be a number between **1** and **1000**');
        }

        if (role.position >= message.guild.members.me.roles.highest.position) {
          return embeds.deny(message, 'I cannot manage this role due to role hierarchy');
        }

        if (role.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
          return embeds.deny(message, 'You cannot manage this role due to role hierarchy');
        }

        await guildService.addLevelRole(message.guild.id, level, role.id);
        return embeds.success(message, `Added **${role.name}** as level **${level}** role`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['rm'],
      description: 'Remove a level role reward',
      syntax: '{guildprefix}levels remove [level]',
      parameters: ['level'],
      example: '{guildprefix}levels remove 10',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) {
          return runHelpCommand(message, 'levels');
        }

        const level = parseInt(args[0]);

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
    },

    set: {
      name: 'set',
      aliases: [],
      description: 'Set a user\'s level',
      syntax: '{guildprefix}levels set [@user] [level]',
      parameters: ['user', 'level'],
      example: '{guildprefix}levels set @user 25',

      handler: async (client, message, args, guildService) => {
        if (!args[0] || !args[1]) {
          return runHelpCommand(message, 'levels');
        }

        const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Leveling system is **disabled** in this server. Use `levels unlock` or `levels enable` to enable it.');
        }

        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found || !userResult.user) {
          return embeds.deny(message, userResult.error);
        }

        const targetUser = userResult.user.user || userResult.user;
        const level = parseInt(args[1]);

        if (isNaN(level) || level < 1 || level > 1000) {
          return embeds.deny(message, 'Level must be a number between **1** and **1000**');
        }

        await guildService.setUserLevel(message.guild.id, targetUser.id, level, 0);

        return embeds.success(message, `Set **${targetUser.username}**'s level to **${level}**`);
      }
    },

    sync: {
      name: 'sync',
      aliases: [],
      description: 'Sync level roles for all members',
      syntax: '{guildprefix}levels sync',
      parameters: [],
      example: '{guildprefix}levels sync',

      handler: async (client, message, args, guildService) => {
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

        const stackRoles = await guildService.getStackRoles(message.guild.id);
        const userLevels = await guildService.getUserLeaderboard(message.guild.id, 1000);
        let syncedCount = 0;

        for (const userData of userLevels) {
          try {
            const member = await message.guild.members.fetch(userData.userId);
            if (!member) continue;

            if (stackRoles) {
              const eligibleRoles = levelRoles.filter(lr => lr.level <= userData.level);

              for (const levelRole of eligibleRoles) {
                const role = message.guild.roles.cache.get(levelRole.roleId);
                if (role && !member.roles.cache.has(role.id)) {
                  await member.roles.add(role);
                  syncedCount++;
                }
              }
            } else {
              const eligibleRoles = levelRoles.filter(lr => lr.level <= userData.level);
              
              if (eligibleRoles.length > 0) {
                const sortedRoles = eligibleRoles.sort((a, b) => b.level - a.level);
                const highestLevelRole = sortedRoles[0];
                const highestRole = message.guild.roles.cache.get(highestLevelRole.roleId);

                if (highestRole) {
                  for (const levelRole of levelRoles) {
                    if (levelRole.roleId !== highestLevelRole.roleId) {
                      const role = message.guild.roles.cache.get(levelRole.roleId);
                      if (role && member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                      }
                    }
                  }

                  if (!member.roles.cache.has(highestRole.id)) {
                    await member.roles.add(highestRole);
                    syncedCount++;
                  }
                }
              }
            }
          } catch (error) {
            continue;
          }
        }

        await guildService.updateLastSyncTime(message.guild.id);
        return embeds.success(message, `Synced level roles for **${syncedCount}** members`);
      }
    },

    messagemode: {
      name: 'messagemode',
      aliases: [],
      description: 'Configure level up message mode',
      syntax: '{guildprefix}levels messagemode [none/channel/context] [#channel]',
      parameters: ['mode', 'channel (optional)'],
      example: '{guildprefix}levels messagemode channel #level-ups',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) {
          const currentMode = await guildService.getLevelMessageMode(message.guild.id);
          return embeds.info(message, `Current level up message mode: **${currentMode}**`);
        }

        const mode = args[0].toLowerCase();

        if (!['none', 'channel', 'context'].includes(mode)) {
          return embeds.deny(message, 'Invalid mode. Use: **none**, **channel**, or **context**');
        }

        if (mode === 'channel' && !args[1]) {
          return runHelpCommand(message, 'levels');
        }

        let description;

        if (mode === 'channel') {
          const mentionedChannel = message.mentions.channels.first();
          const targetChannel = (mentionedChannel && mentionedChannel.guild.id === message.guild.id) ? mentionedChannel :
            message.guild.channels.cache.get(args[1]) ||
            message.guild.channels.cache.find(ch => ch.name.toLowerCase() === args[1].toLowerCase());

          if (!targetChannel) {
            return embeds.deny(message, 'Channel not found! Please mention a valid channel or provide a valid channel ID/name.');
          }

          if (!targetChannel.isTextBased()) {
            return embeds.deny(message, 'Please select a text channel for level up messages.');
          }

          if (!targetChannel.permissionsFor(message.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
            return embeds.deny(message, `I don't have permission to send messages in ${targetChannel}. Please ensure I have **Send Messages** and **Embed Links** permissions.`);
          }

          await guildService.setLevelMessageMode(message.guild.id, mode);
          await guildService.setLevelUpChannel(message.guild.id, targetChannel.id);

          description = `Level up messages will now be sent in ${targetChannel}`;
        } else {
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
    },

    message: {
      name: 'message',
      aliases: [],
      description: 'Manage custom level up messages',
      syntax: '{guildprefix}levels message [message/remove/none/view/variables] (--ping)',
      parameters: ['action', '--ping (optional)'],
      example: '{guildprefix}levels message {user.mention} leveled up to {level.new_rank}! --ping',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return false;

        if (args[0] === 'view') {
          const customMessage = await guildService.getLevelCustomMessage(message.guild.id);
          const levelSystem = await guildService.getLevelSystem(message.guild.id);

          if (customMessage) {
            try {
              const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');

              EmbedVariableProcessor.process(message.channel, customMessage, {
                user: message.author,
                guild: message.guild,
                channel: message.channel,
                pingEnabled: levelSystem?.customMessagePingEnabled || false,
                level: { new_rank: 25 }
              });

            } catch (error) {
              logger.webhook.error(error, message);
              return embeds.deny(message, `Error processing custom message: ${error.message}\n\nRaw message: \`\`\`${customMessage}\`\`\``);
            }
          } else {
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

        if (args[0] === 'variables') {
          const member = message.author;
          const embed = new EmbedBuilder()
            .setColor(colors.info)
            .setTitle('Level Up Message Variables')
            .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.display_name}\` — ${member.displayName}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{level.new_rank}\` — Member's new level at time of level up`);

          return message.channel.send({ embeds: [embed] });
        }

        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

        try {
          let levelMessage = args.join(' ');

          if (levelMessage.toLowerCase() === 'remove' || levelMessage.toLowerCase() === 'none') {
            await guildService.removeLevelCustomMessage(message.guild.id);
            return embeds.success(message, "Custom level message has been removed. The default message will now be used.");
          }

          // Check for --ping flag
          const pingEnabled = levelMessage.trim().endsWith('--ping');
          if (pingEnabled) {
            levelMessage = levelMessage.slice(0, -6).trim();
          }

          if (!levelMessage.includes('{level.new_rank}')) {
            return embeds.deny(message, 'Level up messages **must** include the `{level.new_rank}` variable to show the user\'s new level.');
          }

          await guildService.setLevelCustomMessage(message.guild.id, levelMessage, pingEnabled);

          const pingStatus = pingEnabled ? ' with **ping enabled**' : '';
          return embeds.success(message, `Custom level message has been set successfully${pingStatus}!`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to set level message: ${error.message}`);
        }
      }
    }
  },

  run: async (client, message, args) => {
    try {
      await ensureGuildData(message.guild.id);
      const guildService = getService('guild');

      if (!args[0]) {
        return await handleViewLevel(client, message, [], guildService);
      }

      const sub = args[0].toLowerCase();

      if (['unlock', 'enable', 'lock', 'disable', 'add', 'remove', 'set', 'sync', 'messagemode', 'setrate', 'stack', 'update'].includes(sub)) {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;
      }

      if (['reset', 'cleanup'].includes(sub)) {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;
      }

      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), guildService);
      }

      return await handleViewLevel(client, message, args, guildService);

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

async function handleViewLevel(client, message, args, guildService) {
  let targetUser = message.author;
  let targetMember = message.member;

  if (args[0]) {
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found || !userResult.user) {
      return embeds.deny(message, userResult.error);
    }
    targetUser = userResult.user.user || userResult.user;
    targetMember = userResult.user;
  }

  const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);
  if (!isEnabled) {
    return embeds.warn(message, 'Leveling system is **disabled** in this server');
  }

  const userData = await guildService.getUserLevel(message.guild.id, targetUser.id);
  const userRank = await guildService.getUserRank(message.guild.id, targetUser.id);
  const totalMembers = await guildService.getUserLeaderboard(message.guild.id, 1000);

  const requiredExp = guildService.getRequiredExperience(userData.level);
  const progress = Math.floor((userData.experience / requiredExp) * 10);

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
