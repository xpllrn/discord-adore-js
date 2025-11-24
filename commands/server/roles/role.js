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

module.exports = {
  name: "role",
  description: `Comprehensive role management system`,
  syntax: 'role [user] [role] or role [subcommand] (parameters)',
  example: 'role @user @Member',
  aliases: ['r'],
  permission: 'manage_roles',
  isGroupCommand: true,
  run: async (client, message, args) => {

    // Permission checks first using utils/permissions.js
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return embeds.deny(message, 'I need **Manage Roles** permission to use this command');
    }

    await ensureGuildData(message.guild.id);

    // CREATE ROLE SUBCOMMAND
    if (args[0] === 'create' || args[0] === 'c') {
      const subcommandInfo = {
        description: 'Create a new role',
        usage: '{guildprefix}role create [name]',
        aliases: ['c'],
        parameters: ['name'],
        example: '{guildprefix}role create VIP'
      };

      const roleName = args.slice(1).join(' ');

      if (!roleName) {
        return false;
      }

      try {
        const newRole = await message.guild.roles.create({
          name: roleName,
          permissions: 0n, // No permissions by default
          reason: `Role created by ${message.author.tag}`
        });

        return embeds.success(message, `Created role ${newRole}`);
      } catch (error) {
        return embeds.deny(message, 'Failed to **create role**. Please check my permissions.');
      }
    }

    // DELETE ROLE SUBCOMMAND
    if (args[0] === 'delete' || args[0] === 'del') {
      const subcommandInfo = {
        description: 'Delete a role',
        usage: '{guildprefix}role delete [role]',
        aliases: ['del'],
        parameters: ['role'],
        example: '{guildprefix}role delete VIP'
      };

      if (!args[1]) {
        return false;
      }

      const roleResult = findRole(message.guild, args.slice(1).join(' '));

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Add confirmation before deleting the role
      await createConfirmation(
        message,
        `Are you **sure** you want to delete <@&${role.id}> role?`,
        async (interaction) => {
          try {
            const roleName = role.name;
            await role.delete(`Role deleted by ${message.author.tag}`);
            
            // Edit the confirmation message to show success
            await interaction.update({
              embeds: [embeds.success(message, `Deleted role **${roleName}**`).embeds[0]],
              components: []
            });
          } catch (error) {
            // Edit the confirmation message to show error
            await interaction.update({
              embeds: [embeds.deny(message, 'Failed to **delete role**. Please check my permissions.').embeds[0]],
              components: []
            });
          }
        }
      );
      
      return; // Exit early since confirmation handles the response
    }

    // RENAME ROLE SUBCOMMAND
    if (args[0] === 'rename') {
      const subcommandInfo = {
        description: 'Rename a role',
        usage: '{guildprefix}role rename [role] [new name]',
        aliases: [],
        parameters: ['role', 'new name'],
        example: '{guildprefix}role rename VIP Premium'
      };

      if (!args[1] || !args[2]) {
        return false;
      }

      let roleResult = null;
      let newName = '';

      // Try different splits to find the role
      for (let i = 1; i < args.length - 1; i++) {
        const possibleRoleName = args.slice(1, i + 1).join(' ');
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

      // Check role hierarchy using utils/permissions.js
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

    // COLOR ROLE SUBCOMMAND
    if (args[0] === 'color') {
      const subcommandInfo = {
        description: 'Change role color',
        usage: '{guildprefix}role color [role] [color]',
        aliases: [],
        parameters: ['role', 'color'],
        example: '{guildprefix}role color VIP #ff0000'
      };

      if (!args[1] || !args[2]) {
        return false;
      }

      // For color command, try different parsing approaches
      let role = null;
      let colorArgs = [];

      // Check if there's a role mention in the arguments
      const roleMention = message.mentions.roles.first();

      if (roleMention) {
        // If there's a role mention, use it and find the color arguments
        role = roleMention;
        // Find the color arguments (should be all non-mention arguments after the role)
        const nonMentionArgs = args.filter(arg => !arg.startsWith('<@&'));
        colorArgs = nonMentionArgs.slice(1); // Skip the 'color' command
      } else {
        // No role mention, try different parsing approaches
        // Try to find role by testing different splits
        let roleFound = false;

        for (let i = 1; i < args.length - 1; i++) {
          const possibleRoleName = args.slice(1, i + 1).join(' ');
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

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Helper function to parse color
      const parseColor = (colorInput) => {
        try {
          // Handle hex codes without # prefix
          if (/^[0-9A-Fa-f]{6}$/.test(colorInput)) {
            colorInput = '#' + colorInput;
          }

          // Use the color library - it handles color names, hex, rgb, hsl, etc.
          const parsedColor = Color(colorInput);
          return parsedColor.hex().toUpperCase();
        } catch (error) {
          throw new Error(`Invalid color: ${colorInput}`);
        }
      };

      try {
        const primaryColor = parseColor(colorArgs[0]);
        await role.setColor(primaryColor, `Role color changed by ${message.author.tag}`);
        return embeds.success(message, `Changed ${role} color to **${colorArgs[0]}** (${primaryColor})`);
      } catch (error) {
        return embeds.deny(message, `Could not parse color **${colorArgs[0]}**. Try:\n• Color names: \`red\`, \`blue\`, \`brown\`, \`pink\`, etc.\n• Hex codes: \`#FF0000\` or \`FF0000\`\n• RGB: \`rgb(255,0,0)\``);
      }
    }

    // GRADIENT ROLE SUBCOMMAND
    if (args[0] === 'gradient') {
      const subcommandInfo = {
        description: 'Apply gradient color to role name',
        usage: '{guildprefix}role gradient [role] [color1] [color2]',
        aliases: [],
        parameters: ['role', 'color1', 'color2'],
        example: '{guildprefix}role gradient VIP #ff0000 #0000ff'
      };

      if (!args[1] || !args[2] || !args[3]) {
        return false;
      }

      // For gradient command, try different parsing approaches
      let role = null;
      let colorArgs = [];

      // Check if there's a role mention in the arguments
      const roleMention = message.mentions.roles.first();

      if (roleMention) {
        role = roleMention;
        const nonMentionArgs = args.filter(arg => !arg.startsWith('<@&'));
        colorArgs = nonMentionArgs.slice(1); // Skip the 'gradient' command
      } else {
        // Try to find role by testing different splits
        let roleFound = false;

        for (let i = 1; i < args.length - 2; i++) {
          const possibleRoleName = args.slice(1, i + 1).join(' ');
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

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Helper function to parse color
      const parseColor = (colorInput) => {
        try {
          if (/^[0-9A-Fa-f]{6}$/.test(colorInput)) {
            colorInput = '#' + colorInput;
          }
          const parsedColor = Color(colorInput);
          return parsedColor.hex().toUpperCase();
        } catch (error) {
          throw new Error(`Invalid color: ${colorInput}`);
        }
      };

      try {
        const color1 = parseColor(colorArgs[0]);
        const color2 = parseColor(colorArgs[1]);

        // Convert hex to integer
        const color1Int = parseInt(color1.replace('#', ''), 16);
        const color2Int = parseInt(color2.replace('#', ''), 16);

        // Check if server has ENHANCED_ROLE_COLORS feature
        const hasEnhancedColors = message.guild.features?.includes('ENHANCED_ROLE_COLORS');

        if (!hasEnhancedColors) {
          return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use gradient colors.\n\nCurrent server features: ${message.guild.features?.join(', ') || 'None'}\n\nTry using \`,role color\` for a single color instead.`);
        }

        // Use REST API to set gradient colors
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

    // HOLOGRAPHIC ROLE SUBCOMMAND
    if (args[0] === 'holographic' || args[0] === 'holo') {
      const subcommandInfo = {
        description: 'Apply holographic effect to role name',
        usage: '{guildprefix}role holographic [role]',
        aliases: ['holo'],
        parameters: ['role'],
        example: '{guildprefix}role holo VIP'
      };

      if (!args[1]) {
        return false;
      }

      const roleResult = findRole(message.guild, args.slice(1).join(' '));

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Discord's required holographic colors (as integers)
      const holoColors = {
        primary_color: 11127295,   // #A9D9FF
        secondary_color: 16759788, // #FF956C
        tertiary_color: 16761760   // #FFA020
      };

      try {
        // Use Discord.js REST API directly to PATCH the role with all three colors
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

    // ICON ROLE SUBCOMMAND
    if (args[0] === 'icon') {
      const subcommandInfo = {
        description: 'Set role icon',
        usage: '{guildprefix}role icon [role] [emoji]',
        aliases: [],
        parameters: ['role', 'emoji'],
        example: '{guildprefix}role icon VIP ⭐'
      };

      if (!args[1] || !args[2]) {
        return false;
      }

      // Check if server has boost level 2+ for role icons
      if (message.guild.premiumTier < 2) {
        return embeds.deny(message, 'Role icons require **server boost level 2+**. This server is currently level ' + message.guild.premiumTier);
      }

      let role = null;
      let emojiArg = '';

      // Check if there's a role mention in the arguments
      const roleMention = message.mentions.roles.first();

      if (roleMention) {
        // If there's a role mention, use it and find the emoji argument
        role = roleMention;
        // Find the emoji argument (should be the last non-mention argument)
        const nonMentionArgs = args.filter(arg => !arg.startsWith('<@&'));
        emojiArg = nonMentionArgs[nonMentionArgs.length - 1];
      } else {
        // No role mention, use original parsing
        // Find role name (everything except the last argument which is the emoji)
        emojiArg = args[args.length - 1];
        const roleName = args.slice(1, -1).join(' ');

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

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      let iconUrl = null;

      // Check if it's a URL first
      try {
        new URL(emojiArg);
        iconUrl = emojiArg;
      } catch {
        // Handle custom emoji format :name: by finding it in the guild
        if (emoji.startsWith(':') && emoji.endsWith(':')) {
          const emojiName = emoji.slice(1, -1);
          const guildEmoji = message.guild.emojis.cache.find(e => e.name === emojiName);
          if (guildEmoji) {
            iconUrl = `https://cdn.discordapp.com/emojis/${guildEmoji.id}.${guildEmoji.animated ? 'gif' : 'png'}`;
          } else {
            return embeds.deny(message, `Custom emoji **${emojiName}** not found in this server. Please use the full format like \`<:${emojiName}:id>\``);
          }
        } else {
          // Handle custom emoji mentions <:name:id> or <a:name:id>
          const customEmojiMatch = emoji.match(/<a?:(\w+):(\d+)>/);
          if (customEmojiMatch) {
            const emojiId = customEmojiMatch[2];
            const isAnimated = emoji.startsWith('<a:');
            iconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;
          } else if (/^\d+$/.test(emoji)) {
            // If it's just an emoji ID, convert to CDN URL
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
            // For Unicode emojis, use as-is
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

    // BULK ROLE ASSIGNMENT SUBCOMMANDS
    if (args[0] === 'humans' || args[0] === 'bots' || args[0] === 'all') {
      const subcommandInfo = {
        description: 'Assign role to multiple members',
        usage: '{guildprefix}role humans/bots/all [role]',
        aliases: [],
        parameters: ['role'],
        example: '{guildprefix}role humans Member'
      };

      // Check if there's already a role operation in progress for this guild
      if (roleOperationLocks.has(message.guild.id)) {
        return embeds.warn(message, 'A role operation is already in progress. Please wait for it to complete.');
      }

      if (!args[1]) {
        return false;
      }

      const roleResult = findRole(message.guild, args.slice(1).join(' '));

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Set lock for this guild
      roleOperationLocks.set(message.guild.id, true);

      try {
        // Fetch all members to ensure we have the complete list
        await message.guild.members.fetch();

        let targetMembers = [];

        if (args[0] === 'humans') {
          targetMembers = message.guild.members.cache.filter(member => !member.user.bot);
        } else if (args[0] === 'bots') {
          targetMembers = message.guild.members.cache.filter(member => member.user.bot);
        } else if (args[0] === 'all') {
          targetMembers = message.guild.members.cache;
        }

        const memberArray = Array.from(targetMembers.values());
        const totalCount = memberArray.length;

        // Send loading message with count
        const loadingMessage = await embeds.loading(message, `Adding **${role.name}** to **${totalCount}** ${args[0]} - this may take awhile...`);

        let successCount = 0;

        // Process members in batches to avoid server-specific rate limits
        const batchSize = 5;

        for (let i = 0; i < memberArray.length; i += batchSize) {
          const batch = memberArray.slice(i, i + batchSize);

          await Promise.allSettled(batch.map(async (member) => {
            try {
              // Skip if member already has the role
              if (member.roles.cache.has(role.id)) {
                return;
              }

              // Skip if we can't manage this member's roles
              if (role.position >= message.guild.members.me.roles.highest.position) {
                return;
              }

              // Skip if member is higher in hierarchy than the command user
              if (member.roles.highest.position >= message.member.roles.highest.position && member.id !== message.author.id) {
                return;
              }

              await member.roles.add(role.id, `Bulk role assignment by ${message.author.tag}`);
              successCount++;
            } catch (error) {
              // Silently handle errors
            }
          }));

          // Small delay between batches to avoid server-specific rate limits
          if (i + batchSize < memberArray.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Delete loading message and send success message
        await loadingMessage.delete();
        return embeds.success(message, `Added ${role} to **${successCount}** members`);

      } catch (error) {
        return embeds.deny(message, `Failed to add **${role.name}** to ${args[0]}. Please check my permissions.`);
      } finally {
        // Always remove the lock when done
        roleOperationLocks.delete(message.guild.id);
      }

    }

    // RESTORE ROLE SUBCOMMAND
    if (args[0] === 'restore') {
      const subcommandInfo = {
        description: 'Restore roles to a user who left the server',
        usage: '{guildprefix}role restore [user]',
        aliases: [],
        parameters: ['user'],
        example: '{guildprefix}role restore @user'
      };

      if (!args[1]) {
        return false;
      }

      const userResult = await findUser(message.guild, args[1], client);

      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }

      let user = userResult.user;
      
      // If findUser returned a global User object, we need to fetch the GuildMember
      if (userResult.isGlobal || !user.roles) {
        try {
          user = await message.guild.members.fetch(user.id);
        } catch (error) {
          return embeds.deny(message, `**${user.username}** is not a member of this server!`);
        }
      }

      const targetUser = user.user || user;

      // Check if user can perform action on target
      if (!checkSelfAction(message, targetUser, 'restore roles for')) return;
      if (!checkBotAction(message, targetUser)) return;
      if (!checkUserMemberHierarchy(message, user)) return;
      if (!checkDiscordActionable(message, user, 'manage roles')) return;

      // Find restore data for this user
      const guildData = await ensureGuildData(message.guild.id);
      
      // Clean up expired restore data first
      guildData.RoleRestore = guildData.RoleRestore.filter(
        restore => restore.expiresAt > new Date()
      );

      const restoreData = guildData.RoleRestore.find(
        restore => restore.userId === user.id
      );

      if (!restoreData || restoreData.roles.length === 0) {
        return embeds.deny(message, `No saved roles found for ${user}. Roles are only saved for 2 hours after a member leaves.`);
      }

      // Filter out roles that no longer exist or bot can't manage
      const validRoles = [];
      const invalidRoles = [];

      for (const roleId of restoreData.roles) {
        const role = message.guild.roles.cache.get(roleId);
        
        if (!role) {
          invalidRoles.push(roleId);
          continue;
        }

        // Check if bot can manage this role
        if (role.position >= message.guild.members.me.roles.highest.position) {
          invalidRoles.push(role.name);
          continue;
        }

        // Check if command user can manage this role
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
        // Add all valid roles
        await user.roles.add(validRoles.map(r => r.id), `Roles restored by ${message.author.tag}`);

        // Remove restore data after successful restore
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

    // DEFAULT ROLE TOGGLE (no subcommand)
    if (!args[0]) {
      return false;
    }

    // Main role toggle functionality: ,role (member) <role name>
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    let user = userResult.user;
    
    // If findUser returned a global User object, we need to fetch the GuildMember
    if (userResult.isGlobal || !user.roles) {
      try {
        user = await message.guild.members.fetch(user.id);
      } catch (error) {
        return embeds.deny(message, `**${user.username}** is not a member of this server!`);
      }
    }

    // Get the actual user object (handle both GuildMember and User objects)
    const targetUser = user.user || user;

    // Check if user can perform action on target using utils/permissions.js
    if (!checkSelfAction(message, targetUser, 'manage roles for')) return;
    if (!checkBotAction(message, targetUser)) return;
    if (!checkUserMemberHierarchy(message, user)) return;

    // Check if Discord allows role management on this member
    if (!checkDiscordActionable(message, user, 'manage roles')) return;

    // Parse multiple roles separated by commas
    const roleArgs = args.slice(1).join(' ').split(',').map(r => r.trim());
    
    const rolesToAdd = [];
    const rolesToRemove = [];
    const rolesToToggle = [];

    for (const roleArg of roleArgs) {
      if (!roleArg) continue;

      let shouldRemove = false;
      let shouldAdd = false;
      let roleQuery = roleArg;

      // Check for + prefix (force add)
      if (roleArg.startsWith('+')) {
        shouldAdd = true;
        roleQuery = roleArg.slice(1).trim();
      }
      // Check for - prefix (force remove)
      else if (roleArg.startsWith('-')) {
        shouldRemove = true;
        roleQuery = roleArg.slice(1).trim();
      }

      const roleResult = findRole(message.guild, roleQuery);

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      if (shouldRemove) {
        rolesToRemove.push(role);
      } else if (shouldAdd) {
        rolesToAdd.push(role);
      } else {
        rolesToToggle.push(role);
      }
    }

    try {
      const addedRoles = [];
      const removedRoles = [];

      // Handle forced additions
      for (const role of rolesToAdd) {
        if (!user.roles.cache.has(role.id)) {
          await user.roles.add(role.id, `Role added by ${message.author.tag}`);
          addedRoles.push(role);
        }
      }

      // Handle forced removals
      for (const role of rolesToRemove) {
        if (user.roles.cache.has(role.id)) {
          await user.roles.remove(role.id, `Role removed by ${message.author.tag}`);
          removedRoles.push(role);
        }
      }

      // Handle toggles (add if not present, remove if present)
      for (const role of rolesToToggle) {
        if (user.roles.cache.has(role.id)) {
          await user.roles.remove(role.id, `Role removed by ${message.author.tag}`);
          removedRoles.push(role);
        } else {
          await user.roles.add(role.id, `Role added by ${message.author.tag}`);
          addedRoles.push(role);
        }
      }

      // Build response message
      const messages = [];
      if (addedRoles.length > 0) {
        messages.push(`Added ${addedRoles.join(', ')} to ${user}`);
      }
      if (removedRoles.length > 0) {
        messages.push(`Removed ${removedRoles.join(', ')} from ${user}`);
      }

      if (messages.length > 0) {
        return embeds.success(message, messages.join('\n'));
      } else {
        return embeds.warn(message, 'No role changes were made');
      }
    } catch (error) {
      if (error.code === 50013) {
        return embeds.deny(message, `I don't have permission to manage ${user}'s roles. Please check my role hierarchy and permissions.`);
      }
      return embeds.deny(message, 'Failed to modify user roles. Please check my permissions.');
    }
  }
}