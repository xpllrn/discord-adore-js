const { ensureGuildData } = require('../../../database');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, checkUserRoleHierarchy, checkBotRoleHierarchy, checkUserMemberHierarchy, checkSelfAction, checkBotAction, checkDiscordActionable } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findRole, findUser } = require('../../../handlers/finder');
const { PermissionFlagsBits } = require('discord.js');
const colorLib = require('color');
const Color = colorLib.default || colorLib;

// Map to track ongoing role operations per guild to prevent concurrent operations
const roleOperationLocks = new Map();

module.exports = {
  name: "role",
  description: `Comprehensive role management system`,
  aliases: ['r'],
  usage: '{guildprefix}role [member] [role]\n{guildprefix}role create [name]\n{guildprefix}role delete [role]\n{guildprefix}role rename [role] [new name]\n{guildprefix}role color [role] [color]\n{guildprefix}role gradient [role] [color1] [color2]\n{guildprefix}role holographic [role]\n{guildprefix}role icon [role] [emoji]\n{guildprefix}role humans [role]\n{guildprefix}role bots [role]\n{guildprefix}role all [role]',
  permission: 'Manage Roles',
  run: async (client, message, args) => {

    // Permission checks first using utils/permissions.js
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return embeds.deny(message, 'I need **Manage Roles** permission to use this command');
    }

    await ensureGuildData(message.guild.id);

    // CREATE ROLE SUBCOMMAND
    if (args[0] === 'create' || args[0] === 'c') {
      const roleName = args.slice(1).join(' ');

      if (!roleName) {
        return runHelpCommand(message, 'role');
      }

      try {
        const newRole = await message.guild.roles.create({
          name: roleName,
          permissions: 0n, // No permissions by default
          reason: `Role created by ${message.author.tag}`
        });

        return embeds.success(message, `Created role **${newRole.name}**`);
      } catch (error) {
        return embeds.deny(message, 'Failed to **create role**. Please check my permissions.');
      }
    }

    // DELETE ROLE SUBCOMMAND
    if (args[0] === 'delete' || args[0] === 'del') {
      if (!args[1]) {
        return runHelpCommand(message, 'role');
      }

      const roleResult = findRole(message.guild, args.slice(1).join(' '));

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      try {
        const roleName = role.name;
        await role.delete(`Role deleted by ${message.author.tag}`);
        return embeds.success(message, `Deleted role **${roleName}**`);
      } catch (error) {
        return embeds.deny(message, 'Failed to **delete role**. Please check my permissions.');
      }
    }

    // RENAME ROLE SUBCOMMAND
    if (args[0] === 'rename') {
      if (!args[1] || !args[2]) {
        return runHelpCommand(message, 'role');
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
        return embeds.deny(message, 'Could not find the role to rename. Usage: `,role rename <old role name> <new role name>`');
      }

      const role = roleResult.role;

      // Check role hierarchy using utils/permissions.js
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      try {
        const oldName = role.name;
        await role.setName(newName, `Role renamed by ${message.author.tag}`);
        return embeds.success(message, `Renamed **${oldName}** to **${newName}**`);
      } catch (error) {
        return embeds.deny(message, 'Failed to **rename role**. Please check my permissions.');
      }
    }

    // COLOR ROLE SUBCOMMAND
    if (args[0] === 'color') {
      if (!args[1] || !args[2]) {
        return runHelpCommand(message, 'role');
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
          return embeds.deny(message, `Could not find role. Usage: \`,role color <role name> <color> [color2]\``);
        }
      }

      if (!role || colorArgs.length === 0) {
        return embeds.deny(message, `Could not find role or color. Usage: \`,role color <role name> <color> [color2]\``);
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
        return embeds.success(message, `Changed **${role.name}** color to **${colorArgs[0]}** (${primaryColor})`);
      } catch (error) {
        return embeds.deny(message, `Could not parse color **${colorArgs[0]}**. Try:\n• Color names: \`red\`, \`blue\`, \`brown\`, \`pink\`, etc.\n• Hex codes: \`#FF0000\` or \`FF0000\`\n• RGB: \`rgb(255,0,0)\``);
      }
    }

    // GRADIENT ROLE SUBCOMMAND
    if (args[0] === 'gradient') {
      if (!args[1] || !args[2] || !args[3]) {
        return runHelpCommand(message, 'role');
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
          return embeds.deny(message, `Could not find role. Usage: \`,role gradient <role name> <color1> <color2>\``);
        }
      }

      if (!role || colorArgs.length < 2) {
        return embeds.deny(message, `Please provide two colors. Usage: \`,role gradient <role name> <color1> <color2>\``);
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

        // Try to set gradient colors using Discord's API
        try {
          if (role.setColors && typeof role.setColors === 'function') {
            await role.setColors([color1, color2], `Role gradient colors changed by ${message.author.tag}`);
          } else {
            await role.edit({
              color: [color1, color2]
            }, `Role gradient colors changed by ${message.author.tag}`);
          }
          return embeds.success(message, `Changed **${role.name}** to gradient colors **${colorArgs[0]}** → **${colorArgs[1]}** (${color1} → ${color2})`);
        } catch (gradientError) {
          if (gradientError.code === 50035 || gradientError.message?.includes('ENHANCED_ROLES')) {
            return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use gradient colors. Try using \`,role color\` for a single color instead.`);
          }
          return embeds.deny(message, `Failed to set gradient colors. This feature may not be supported.`);
        }
      } catch (error) {
        return embeds.deny(message, `Could not parse colors. Try:\n• Color names: \`red\`, \`blue\`, \`brown\`, \`pink\`, etc.\n• Hex codes: \`#FF0000\` or \`FF0000\``);
      }
    }

    // HOLOGRAPHIC ROLE SUBCOMMAND
    if (args[0] === 'holographic' || args[0] === 'holo') {
      if (!args[1]) {
        return runHelpCommand(message, 'role');
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
        await client.rest.patch(
          `/guilds/${message.guild.id}/roles/${role.id}`,
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

        return embeds.success(message, `Changed **${role.name}** to holographic colors! ✨`);
      } catch (error) {
        console.error('Holographic error:', error);
        if (error.code === 50035 || error.message?.includes('ENHANCED_ROLES') || error.message?.includes('guild feature')) {
          return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use holographic colors.`);
        }
        return embeds.deny(message, `Failed to set holographic colors: ${error.message || 'Unknown error'}`);
      }
    }

    // ICON ROLE SUBCOMMAND
    if (args[0] === 'icon') {
      if (!args[1] || !args[2]) {
        return runHelpCommand(message, 'role');
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
        return embeds.deny(message, `Could not find role. Usage: \`,role icon <role name> <emoji>\``);
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
        return embeds.success(message, `Changed **${role.name}** icon to ${emojiArg}`);
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
      // Check if there's already a role operation in progress for this guild
      if (roleOperationLocks.has(message.guild.id)) {
        return embeds.warn(message, 'A role operation is already in progress. Please wait for it to complete.');
      }

      if (!args[1]) {
        return runHelpCommand(message, 'role');
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
        return embeds.success(message, `Added **${role.name}** to **${successCount}** members`);

      } catch (error) {
        return embeds.deny(message, `Failed to add **${role.name}** to ${args[0]}. Please check my permissions.`);
      } finally {
        // Always remove the lock when done
        roleOperationLocks.delete(message.guild.id);
      }

    }

    // DEFAULT ROLE TOGGLE (no subcommand)
    if (!args[0]) {
      return runHelpCommand(message, 'role');
    }

    // Main role toggle functionality: ,role (member) <role name>
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    const user = userResult.user;
    const roleResult = findRole(message.guild, args.slice(1).join(' '));

    if (!roleResult.found) {
      return embeds.deny(message, roleResult.error);
    }

    const role = roleResult.role;

    // Get the actual user object (handle both GuildMember and User objects)
    const targetUser = user.user || user;

    // Check if user can perform action on target using utils/permissions.js
    if (!checkSelfAction(message, targetUser, 'manage roles for')) return;
    if (!checkBotAction(message, targetUser)) return;
    if (!checkUserMemberHierarchy(message, user)) return;

    // Check if Discord allows role management on this member
    if (!checkDiscordActionable(message, user, 'manage roles')) return;

    // Check role hierarchy using utils/permissions.js
    if (!checkUserRoleHierarchy(message, role)) return;
    if (!checkBotRoleHierarchy(message, role)) return;

    try {
      if (user.roles.cache.has(role.id)) {
        // Remove role
        await user.roles.remove(role.id, `Role removed by ${message.author.tag}`);
        return embeds.success(message, `Removed **${role.name}** from **${targetUser.username}**`);
      } else {
        // Add role
        await user.roles.add(role.id, `Role added by ${message.author.tag}`);
        return embeds.success(message, `Added **${role.name}** to **${targetUser.username}**`);
      }
    } catch (error) {
      if (error.code === 50013) {
        return embeds.deny(message, `I don't have permission to manage **${targetUser.username}**'s roles or the **${role.name}** role. Please check my role hierarchy and permissions.`);
      }
      return embeds.deny(message, 'Failed to modify user roles. Please check my permissions.');
    }
  }
}