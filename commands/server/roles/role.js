const { ensureGuildData } = require('../../../database');
const { embeds } = require('../../../core/embeds');
const { createConfirmation } = require('../../../core/buttons');
const { hasDiscordPermission, checkUserRoleHierarchy, checkBotRoleHierarchy, checkUserMemberHierarchy, checkSelfAction, checkBotAction, checkDiscordActionable } = require('../../../utils/permissions');
const { findRole, findUser } = require('../../../handlers/finder');
const { PermissionFlagsBits } = require('discord.js');
const colorLib = require('color');
const Color = colorLib.default || colorLib;
const logger = require('../../../utils/logger');

// Map to track ongoing role operations per guild to prevent concurrent operations
const roleOperationLocks = new Map();

// Helper function to parse color
function parseColor(colorInput) {
  try {
    if (/^[0-9A-Fa-f]{6}$/.test(colorInput)) {
      colorInput = '#' + colorInput;
    }
    const parsedColor = Color(colorInput);
    return parsedColor.hex().toUpperCase();
  } catch (error) {
    throw new Error(`Invalid color: ${colorInput}`);
  }
}

module.exports = {
  name: "role",
  description: `Comprehensive role management system`,
  syntax: 'role [user] [role] or role [subcommand] (parameters)',
  example: 'role @user @Member',
  aliases: ['r'],
  permission: 'manage_roles',
  isGroupCommand: true,

  subcommands: {
    create: {
      name: 'create',
      aliases: ['c'],
      description: 'Create a new role',
      syntax: '{guildprefix}role create [name]',
      parameters: ['name'],
      example: '{guildprefix}role create VIP',

      handler: async (client, message, args) => {
        const roleName = args.join(' ');

        if (!roleName) {
          return false;
        }

        try {
          const newRole = await message.guild.roles.create({
            name: roleName,
            permissions: 0n,
            reason: `Role created by ${message.author.tag}`
          });

          return embeds.success(message, `Created role ${newRole}`);
        } catch (error) {
          return embeds.deny(message, 'Failed to **create role**. Please check my permissions.');
        }
      }
    },

    delete: {
      name: 'delete',
      aliases: ['del'],
      description: 'Delete a role',
      syntax: '{guildprefix}role delete [role]',
      parameters: ['role'],
      example: '{guildprefix}role delete VIP',

      handler: async (client, message, args) => {
        if (!args[0]) {
          return false;
        }

        const roleResult = findRole(message.guild, args.join(' '));

        if (!roleResult.found) {
          return embeds.deny(message, roleResult.error);
        }

        const role = roleResult.role;

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        await createConfirmation(
          message,
          `Are you **sure** you want to delete <@&${role.id}> role?`,
          async (interaction, sentMessage) => {
            try {
              const roleName = role.name;
              await role.delete(`Role deleted by ${message.author.tag}`);
              
              await sentMessage.edit({
                embeds: [embeds.createSuccess(message, `Deleted role **${roleName}**`)],
                components: []
              });
            } catch (error) {
              await sentMessage.edit({
                embeds: [embeds.createDeny(message, 'Failed to **delete role**. Please check my permissions.')],
                components: []
              });
            }
          }
        );
        
        return;
      }
    },

    rename: {
      name: 'rename',
      aliases: [],
      description: 'Rename a role',
      syntax: '{guildprefix}role rename [role] [new name]',
      parameters: ['role', 'new name'],
      example: '{guildprefix}role rename VIP Premium',

      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) {
          return false;
        }

        let roleResult = null;
        let newName = '';

        for (let i = 0; i < args.length - 1; i++) {
          const possibleRoleName = args.slice(0, i + 1).join(' ');
          const testResult = findRole(message.guild, possibleRoleName);

          if (testResult.found) {
            roleResult = testResult;
            newName = args.slice(i + 1).join(' ');
            break;
          }
        }

        if (!roleResult || !newName) {
          return false;
        }

        const role = roleResult.role;

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        try {
          const oldName = role.name;
          await role.setName(newName, `Role renamed by ${message.author.tag}`);
          return embeds.success(message, `Renamed **${oldName}** to ${role}`);
        } catch (error) {
          return embeds.deny(message, 'Failed to **rename role**. Please check my permissions.');
        }
      }
    },

    color: {
      name: 'color',
      aliases: [],
      description: 'Change role color',
      syntax: '{guildprefix}role color [role] [color]',
      parameters: ['role', 'color'],
      example: '{guildprefix}role color VIP #ff0000',

      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) {
          return false;
        }

        let role = null;
        let colorArgs = [];

        const roleMention = message.mentions.roles.first();

        if (roleMention && roleMention.guild.id === message.guild.id) {
          role = roleMention;
          const nonMentionArgs = args.filter(arg => !arg.startsWith('<@&'));
          colorArgs = nonMentionArgs;
        } else {
          let roleFound = false;

          for (let i = 0; i < args.length - 1; i++) {
            const possibleRoleName = args.slice(0, i + 1).join(' ');
            const roleResult = findRole(message.guild, possibleRoleName);

            if (roleResult.found) {
              role = roleResult.role;
              colorArgs = args.slice(i + 1);
              roleFound = true;
              break;
            }
          }

          if (!roleFound) {
            return false;
          }
        }

        if (!role || colorArgs.length === 0) {
          return false;
        }

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        try {
          const primaryColor = parseColor(colorArgs[0]);
          await role.setColor(primaryColor, `Role color changed by ${message.author.tag}`);
          return embeds.success(message, `Changed ${role} color to **${colorArgs[0]}** (${primaryColor})`);
        } catch (error) {
          return embeds.deny(message, `Could not parse color **${colorArgs[0]}**. Try:\n• Color names: \`red\`, \`blue\`, \`brown\`, \`pink\`, etc.\n• Hex codes: \`#FF0000\` or \`FF0000\`\n• RGB: \`rgb(255,0,0)\``);
        }
      }
    },

    gradient: {
      name: 'gradient',
      aliases: [],
      description: 'Apply gradient color to role name',
      syntax: '{guildprefix}role gradient [role] [color1] [color2]',
      parameters: ['role', 'color1', 'color2'],
      example: '{guildprefix}role gradient VIP #ff0000 #0000ff',

      handler: async (client, message, args) => {
        if (!args[0] || !args[1] || !args[2]) {
          return false;
        }

        let role = null;
        let colorArgs = [];

        const roleMention = message.mentions.roles.first();

        if (roleMention && roleMention.guild.id === message.guild.id) {
          role = roleMention;
          const nonMentionArgs = args.filter(arg => !arg.startsWith('<@&'));
          colorArgs = nonMentionArgs;
        } else {
          let roleFound = false;

          for (let i = 0; i < args.length - 2; i++) {
            const possibleRoleName = args.slice(0, i + 1).join(' ');
            const roleResult = findRole(message.guild, possibleRoleName);

            if (roleResult.found) {
              role = roleResult.role;
              colorArgs = args.slice(i + 1);
              roleFound = true;
              break;
            }
          }

          if (!roleFound) {
            return false;
          }
        }

        if (!role || colorArgs.length < 2) {
          return false;
        }

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        try {
          const color1 = parseColor(colorArgs[0]);
          const color2 = parseColor(colorArgs[1]);

          const color1Int = parseInt(color1.replace('#', ''), 16);
          const color2Int = parseInt(color2.replace('#', ''), 16);

          const hasEnhancedColors = message.guild.features?.includes('ENHANCED_ROLE_COLORS');

          if (!hasEnhancedColors) {
            return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use gradient colors.\n\nCurrent server features: ${message.guild.features?.join(', ') || 'None'}\n\nTry using \`,role color\` for a single color instead.`);
          }

          try {
            const { Routes } = require('discord.js');

            await client.rest.patch(
              Routes.guildRole(message.guild.id, role.id),
              {
                body: {
                  colors: {
                    primary_color: color1Int,
                    secondary_color: color2Int
                  }
                }
              }
            );

            return embeds.success(message, `Changed ${role} to gradient colors **${colorArgs[0]}** → **${colorArgs[1]}** (${color1} → ${color2})`);
          } catch (gradientError) {
            if (gradientError.code === 50035 || gradientError.message?.includes('ENHANCED_ROLES') || gradientError.message?.includes('guild feature')) {
              return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use gradient colors.`);
            }
            return embeds.deny(message, `Failed to set gradient colors: ${gradientError.message || 'Unknown error'}`);
          }
        } catch (error) {
          return embeds.deny(message, `Could not parse colors. Try:\n• Color names: \`red\`, \`blue\`, \`brown\`, \`pink\`, etc.\n• Hex codes: \`#FF0000\` or \`FF0000\``);
        }
      }
    },

    holographic: {
      name: 'holographic',
      aliases: ['holo'],
      description: 'Apply holographic effect to role name',
      syntax: '{guildprefix}role holographic [role]',
      parameters: ['role'],
      example: '{guildprefix}role holo VIP',

      handler: async (client, message, args) => {
        if (!args[0]) {
          return false;
        }

        const roleResult = findRole(message.guild, args.join(' '));

        if (!roleResult.found) {
          return embeds.deny(message, roleResult.error);
        }

        const role = roleResult.role;

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        const holoColors = {
          primary_color: 11127295,
          secondary_color: 16759788,
          tertiary_color: 16761760
        };

        try {
          const { Routes } = require('discord.js');
          await client.rest.patch(
            Routes.guildRole(message.guild.id, role.id),
            {
              body: {
                color: holoColors.primary_color,
                colors: {
                  primary_color: holoColors.primary_color,
                  secondary_color: holoColors.secondary_color,
                  tertiary_color: holoColors.tertiary_color
                }
              },
              reason: `Role set to holographic by ${message.author.tag}`
            }
          );

          return embeds.success(message, `Changed ${role} to holographic colors! ✨`);
        } catch (error) {
          if (error.code === 50035 || error.message?.includes('ENHANCED_ROLES') || error.message?.includes('guild feature')) {
            return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use holographic colors.`);
          }
          return embeds.deny(message, `Failed to set holographic colors: ${error.message || 'Unknown error'}`);
        }
      }
    },

    icon: {
      name: 'icon',
      aliases: [],
      description: 'Set role icon',
      syntax: '{guildprefix}role icon [role] [emoji]',
      parameters: ['role', 'emoji'],
      example: '{guildprefix}role icon VIP ⭐',

      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) {
          return false;
        }

        if (message.guild.premiumTier < 2) {
          return embeds.deny(message, 'Role icons require **server boost level 2+**. This server is currently level ' + message.guild.premiumTier);
        }

        let role = null;
        let emojiArg = '';

        const roleMention = message.mentions.roles.first();

        if (roleMention && roleMention.guild.id === message.guild.id) {
          role = roleMention;
          const nonMentionArgs = args.filter(arg => !arg.startsWith('<@&'));
          emojiArg = nonMentionArgs[nonMentionArgs.length - 1];
        } else {
          emojiArg = args[args.length - 1];
          const roleName = args.slice(0, -1).join(' ');

          const roleResult = findRole(message.guild, roleName);

          if (!roleResult.found) {
            return embeds.deny(message, roleResult.error);
          }

          role = roleResult.role;
        }

        if (!role) {
          return false;
        }

        let emoji = emojiArg;

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        let iconUrl = null;

        try {
          new URL(emojiArg);
          iconUrl = emojiArg;
        } catch {
          if (emoji.startsWith(':') && emoji.endsWith(':')) {
            const emojiName = emoji.slice(1, -1);
            const guildEmoji = message.guild.emojis.cache.find(e => e.name === emojiName);
            if (guildEmoji) {
              iconUrl = `https://cdn.discordapp.com/emojis/${guildEmoji.id}.${guildEmoji.animated ? 'gif' : 'png'}`;
            } else {
              return embeds.deny(message, `Custom emoji **${emojiName}** not found in this server. Please use the full format like \`<:${emojiName}:id>\``);
            }
          } else {
            const customEmojiMatch = emoji.match(/<a?:(\w+):(\d+)>/);
            if (customEmojiMatch) {
              const emojiId = customEmojiMatch[2];
              const isAnimated = emoji.startsWith('<a:');
              iconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;
            } else if (/^\d+$/.test(emoji)) {
              try {
                const emojiObj = await client.emojis.cache.get(emoji) || await client.emojis.fetch(emoji);
                if (emojiObj) {
                  iconUrl = `https://cdn.discordapp.com/emojis/${emojiObj.id}.${emojiObj.animated ? 'gif' : 'png'}`;
                } else {
                  return embeds.deny(message, 'Could not find that emoji. Please use the full emoji format like `<:name:id>`');
                }
              } catch {
                return embeds.deny(message, 'Could not find that emoji. Please use the full emoji format like `<:name:id>`');
              }
            } else {
              iconUrl = emoji;
            }
          }
        }

        try {
          await role.setIcon(iconUrl, `Role icon changed by ${message.author.tag}`);
          return embeds.success(message, `Changed ${role} icon to ${emojiArg}`);
        } catch (error) {
          if (error.code === 50035) {
            return embeds.deny(message, 'Invalid emoji format. Please use:\n• Full format: `<:name:id>`\n• Emoji name: `:name:`\n• Direct image URL\n• Unicode emoji');
          } else if (error.code === 50013) {
            return embeds.deny(message, 'Missing permissions to edit this role. Make sure my role is above the target role.');
          }
          return embeds.deny(message, 'Failed to change role icon. Please check the emoji is valid and accessible.');
        }
      }
    },

    humans: {
      name: 'humans',
      aliases: [],
      description: 'Assign role to all human members',
      syntax: '{guildprefix}role humans [role]',
      parameters: ['role'],
      example: '{guildprefix}role humans Member',

      handler: async (client, message, args) => {
        return handleBulkRole(client, message, args, 'humans');
      }
    },

    bots: {
      name: 'bots',
      aliases: [],
      description: 'Assign role to all bot members',
      syntax: '{guildprefix}role bots [role]',
      parameters: ['role'],
      example: '{guildprefix}role bots Bot',

      handler: async (client, message, args) => {
        return handleBulkRole(client, message, args, 'bots');
      }
    },

    all: {
      name: 'all',
      aliases: [],
      description: 'Assign role to all members',
      syntax: '{guildprefix}role all [role]',
      parameters: ['role'],
      example: '{guildprefix}role all Member',

      handler: async (client, message, args) => {
        return handleBulkRole(client, message, args, 'all');
      }
    },

    restore: {
      name: 'restore',
      aliases: [],
      description: 'Restore roles to a user who left the server',
      syntax: '{guildprefix}role restore [user]',
      parameters: ['user'],
      example: '{guildprefix}role restore @user',

      handler: async (client, message, args) => {
        if (!args[0]) {
          return false;
        }

        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.deny(message, userResult.error);
        }

        let user = userResult.user;
        
        if (userResult.isGlobal || !user.roles) {
          try {
            user = await message.guild.members.fetch(user.id);
          } catch (error) {
            return embeds.deny(message, `**${user.username}** is not a member of this server!`);
          }
        }

        const targetUser = user.user || user;

        if (!checkSelfAction(message, targetUser, 'restore roles for')) return;
        if (!checkBotAction(message, targetUser)) return;
        if (!checkUserMemberHierarchy(message, user)) return;
        if (!checkDiscordActionable(message, user, 'manage roles')) return;

        const guildData = await ensureGuildData(message.guild.id);
        
        guildData.RoleRestore = guildData.RoleRestore.filter(
          restore => restore.expiresAt > new Date()
        );

        const restoreData = guildData.RoleRestore.find(
          restore => restore.userId === user.id
        );

        if (!restoreData || restoreData.roles.length === 0) {
          return embeds.deny(message, `No saved roles found for ${user}. Roles are only saved for 2 hours after a member leaves.`);
        }

        const validRoles = [];
        const invalidRoles = [];

        for (const roleId of restoreData.roles) {
          const role = message.guild.roles.cache.get(roleId);
          
          if (!role) {
            invalidRoles.push(roleId);
            continue;
          }

          if (role.position >= message.guild.members.me.roles.highest.position) {
            invalidRoles.push(role.name);
            continue;
          }

          if (role.position >= message.member.roles.highest.position && message.member.id !== message.guild.ownerId) {
            invalidRoles.push(role.name);
            continue;
          }

          validRoles.push(role);
        }

        if (validRoles.length === 0) {
          return embeds.deny(message, `No valid roles to restore for ${user}. All saved roles are either deleted or cannot be managed.`);
        }

        try {
          await user.roles.add(validRoles.map(r => r.id), `Roles restored by ${message.author.tag}`);

          guildData.RoleRestore = guildData.RoleRestore.filter(
            restore => restore.userId !== user.id
          );
          await guildData.save();

          const timeAgo = Math.floor((Date.now() - restoreData.leftAt.getTime()) / 1000 / 60);
          let response = `Restored **${validRoles.length}** role${validRoles.length !== 1 ? 's' : ''} to ${user} (saved ${timeAgo} minute${timeAgo !== 1 ? 's' : ''} ago)`;
          
          if (invalidRoles.length > 0) {
            response += `\n\n**Note:** ${invalidRoles.length} role${invalidRoles.length !== 1 ? 's were' : ' was'} skipped (deleted or insufficient permissions)`;
          }

          return embeds.success(message, response);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to restore roles. Please check my permissions.');
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return embeds.deny(message, 'I need **Manage Roles** permission to use this command');
    }

    await ensureGuildData(message.guild.id);

    if (!args[0]) {
      return false;
    }

    const sub = args[0].toLowerCase();

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    // Default role toggle functionality
    return handleRoleToggle(client, message, args);
  }
};

// Helper function for bulk role operations (humans, bots, all)
async function handleBulkRole(client, message, args, type) {
  if (!args[0]) {
    return false;
  }

  const roleResult = findRole(message.guild, args.join(' '));

  if (!roleResult.found) {
    return embeds.deny(message, roleResult.error);
  }

  const role = roleResult.role;

  if (!checkUserRoleHierarchy(message, role)) return;
  if (!checkBotRoleHierarchy(message, role)) return;

  // Check if operation is already in progress for this guild
  const lockKey = `${message.guild.id}-${type}`;
  if (roleOperationLocks.has(lockKey)) {
    return embeds.deny(message, `A bulk role operation is already in progress for this server. Please wait for it to complete.`);
  }

  // Fetch all members with timeout handling
  try {
    await message.guild.members.fetch({ time: 120000 });
  } catch (error) {
    if (error.code === 'GuildMembersTimeout') {
      return embeds.deny(message, 'Failed to fetch server members. The server may be too large or Discord is experiencing issues. Please try again later.');
    }
    throw error;
  }

  let targetMembers;
  let typeLabel;

  switch (type) {
    case 'humans':
      targetMembers = message.guild.members.cache.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
      typeLabel = 'human members';
      break;
    case 'bots':
      targetMembers = message.guild.members.cache.filter(m => m.user.bot && !m.roles.cache.has(role.id));
      typeLabel = 'bots';
      break;
    case 'all':
      targetMembers = message.guild.members.cache.filter(m => !m.roles.cache.has(role.id));
      typeLabel = 'members';
      break;
    default:
      return false;
  }

  if (targetMembers.size === 0) {
    return embeds.warn(message, `All ${typeLabel} already have the ${role} role.`);
  }

  await createConfirmation(
    message,
    `Are you **sure** you want to add ${role} to **${targetMembers.size}** ${typeLabel}?\n\nThis may take a while for large servers.`,
    async (interaction, sentMessage) => {
      roleOperationLocks.set(lockKey, true);

      try {
        await sentMessage.edit({
          embeds: [embeds.createInfo(message, `Adding ${role} to **${targetMembers.size}** ${typeLabel}... This may take a while.`)],
          components: []
        });

        let successCount = 0;
        let failCount = 0;

        for (const [, member] of targetMembers) {
          try {
            await member.roles.add(role.id, `Bulk role add by ${message.author.tag}`);
            successCount++;

            // Rate limit protection
            if (successCount % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            failCount++;
          }
        }

        const resultMessage = failCount > 0
          ? `Added ${role} to **${successCount}** ${typeLabel}. Failed for **${failCount}** members.`
          : `Added ${role} to **${successCount}** ${typeLabel}.`;

        await message.channel.send({
          embeds: [embeds.createSuccess(message, resultMessage)]
        });
      } catch (error) {
        logger.webhook.error(error, message);
        await message.channel.send({
          embeds: [embeds.createDeny(message, 'An error occurred during the bulk role operation.')]
        });
      } finally {
        roleOperationLocks.delete(lockKey);
      }
    }
  );

  return;
}

// Helper function for default role toggle (,role @user @role)
async function handleRoleToggle(client, message, args) {
  // Try to find user first
  const userResult = await findUser(message.guild, args[0], client);

  if (!userResult.found) {
    return false;
  }

  let user = userResult.user;

  // Ensure we have a guild member
  if (userResult.isGlobal || !user.roles) {
    try {
      user = await message.guild.members.fetch(user.id);
    } catch (error) {
      return embeds.deny(message, `**${user.username}** is not a member of this server!`);
    }
  }

  const targetUser = user.user || user;

  // Permission checks
  if (!checkSelfAction(message, targetUser, 'manage roles for')) return;
  if (!checkBotAction(message, targetUser)) return;
  if (!checkUserMemberHierarchy(message, user)) return;
  if (!checkDiscordActionable(message, user, 'manage roles')) return;

  // Find the role (remaining args after user)
  const roleArgs = args.slice(1);

  if (roleArgs.length === 0) {
    return false;
  }

  const roleResult = findRole(message.guild, roleArgs.join(' '));

  if (!roleResult.found) {
    return embeds.deny(message, roleResult.error);
  }

  const role = roleResult.role;

  if (!checkUserRoleHierarchy(message, role)) return;
  if (!checkBotRoleHierarchy(message, role)) return;

  // Toggle the role
  try {
    if (user.roles.cache.has(role.id)) {
      await user.roles.remove(role.id, `Role removed by ${message.author.tag}`);
      return embeds.success(message, `Removed ${role} from ${user}`);
    } else {
      await user.roles.add(role.id, `Role added by ${message.author.tag}`);
      return embeds.success(message, `Added ${role} to ${user}`);
    }
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to modify role. Please check my permissions.');
  }
}
