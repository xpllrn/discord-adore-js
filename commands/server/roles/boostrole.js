// NOTE: Cache system has been updated to ensure ALL data is loaded before bot starts
// All cache write enabling checks are now redundant but left for backward compatibility
// The bot will not start until ALL cache data is loaded from the database

const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findRole, findUser } = require('../../../handlers/finder');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const logger = require('../../../utils/logger');

// Helper function to check if user has a booster role or is boosting
async function canUseBoosterRoles(member) {
  const guildService = getService('guild');
  if (member.premiumSince) return true;
  const boosterRole = await guildService.getUserBoosterRole(member.guild.id, member.id);
  if (boosterRole) return true;
  return false;
}

// Helper function to check if server supports role icons
function supportsRoleIcons(guild) {
  return guild.premiumSubscriptionCount >= 7;
}

// Helper function to parse color
function parseColor(colorInput) {
  const colorLib = require('color');
  const Color = colorLib.default || colorLib;
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
  name: "boostrole",
  aliases: ['br', 'boosterrole'],
  description: `Manage booster roles`,
  syntax: 'boostrole [subcommand] (parameters)',
  example: 'boostrole create My Cool Role',
  permission: 'manage_roles',
  isGroupCommand: true,

  subcommands: {
    create: {
      name: 'create',
      aliases: [],
      description: 'Create your personal booster role',
      syntax: '{guildprefix}boostrole create [name]',
      parameters: ['name'],
      example: '{guildprefix}boostrole create My Cool Role',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        if (!await canUseBoosterRoles(message.member)) {
          return embeds.warn(message, 'You need to be **boosting this server** to create a booster role');
        }

        const existingRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (existingRole) {
          const discordRole = message.guild.roles.cache.get(existingRole.roleId);
          if (!discordRole) {
            await guildService.deleteBoosterRole(message.guild.id, message.author.id);
          } else {
            return embeds.warn(message, 'You already have a booster role! Use other commands to customize it.');
          }
        }

        if (!args[0]) {
          return embeds.warn(message, 'Please provide a **name** for your booster role');
        }

        const roleName = args.join(' ');
        if (roleName.length > 100) {
          return embeds.warn(message, 'Role name must be **100 characters or less**');
        }

        try {
          const baseRoleId = await guildService.getBoosterRoleBaseRole(message.guild.id);
          const baseRole = message.guild.roles.cache.get(baseRoleId);

          if (!baseRole) {
            return embeds.warn(message, 'Base role not found. Please contact an admin to reconfigure the booster role system.');
          }

          const newRole = await message.guild.roles.create({
            name: roleName,
            color: 0x000000,
            permissions: 0n,
            mentionable: false,
            hoist: false,
            position: Math.max(1, baseRole.position - 1)
          });

          if (!newRole || !newRole.id) {
            return embeds.deny(message, 'Failed to create Discord role. Please check my permissions.');
          }

          try {
            await guildService.addBoosterRole(message.guild.id, message.author.id, newRole.id, roleName);
          } catch (dbError) {
            try {
              await newRole.delete('Failed to save to database');
            } catch (cleanupError) {
              logger.webhook.error(cleanupError, message);
            }
            return embeds.deny(message, 'Failed to save booster role to database. Please try again.');
          }

          try {
            await message.member.roles.add(newRole);
          } catch (roleError) {
            return embeds.deny(message, 'Created booster role but failed to assign it to you. Please contact an admin.');
          }

          return embeds.success(message, `Created your booster role: ${newRole}!`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to create booster role. Please check my permissions.');
        }
      }
    },

    rename: {
      name: 'rename',
      aliases: [],
      description: 'Rename your booster role',
      syntax: '{guildprefix}boostrole rename [name]',
      parameters: ['name'],
      example: '{guildprefix}boostrole rename New Name',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        if (!await canUseBoosterRoles(message.member)) {
          return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
        }

        if (!message.author || !message.author.id) {
          return embeds.deny(message, 'Unable to identify user. Please try again.');
        }

        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
        }

        if (!args[0]) {
          return embeds.warn(message, 'Please provide a **new name** for your booster role');
        }

        const newName = args.join(' ');
        if (newName.length > 100) {
          return embeds.warn(message, 'Role name must be **100 characters or less**');
        }

        try {
          const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
          if (!discordRole) {
            await guildService.deleteBoosterRole(message.guild.id, message.author.id);
            return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
          }

          await discordRole.edit({ name: newName });
          await guildService.updateBoosterRole(message.guild.id, message.author.id, { name: newName, lastUsed: new Date() });

          return embeds.success(message, `Renamed your booster role to: **${newName}**`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to rename booster role. Please check my permissions.');
        }
      }
    },

    icon: {
      name: 'icon',
      aliases: [],
      description: 'Set an icon for your booster role',
      syntax: '{guildprefix}boostrole icon [emoji/url]',
      parameters: ['emoji or url'],
      example: '{guildprefix}boostrole icon :star:',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        if (!await canUseBoosterRoles(message.member)) {
          return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
        }

        if (!supportsRoleIcons(message.guild)) {
          return embeds.warn(message, `This server needs **Level 2 boost** (7+ boosts) to use role icons. Current boosts: ${message.guild.premiumSubscriptionCount}`);
        }

        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
        }

        let iconUrl = null;
        if (args[0]) {
          if (args[0].toLowerCase() === 'none' || args[0].toLowerCase() === 'remove' || args[0].toLowerCase() === 'delete') {
            iconUrl = null;
          } else {
            try {
              new URL(args[0]);
              iconUrl = args[0];
            } catch {
              const emojiInput = args[0];
              const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
              if (customEmojiMatch) {
                const emojiId = customEmojiMatch[2];
                const isAnimated = emojiInput.startsWith('<a:');
                iconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;
              } else if (/^\d+$/.test(emojiInput)) {
                try {
                  const emoji = await client.emojis.cache.get(emojiInput) || await client.emojis.fetch(emojiInput);
                  if (emoji) {
                    iconUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`;
                  } else {
                    return embeds.warn(message, 'Could not find that emoji. Please use the full emoji format like `<:name:id>`');
                  }
                } catch {
                  return embeds.warn(message, 'Could not find that emoji. Please use the full emoji format like `<:name:id>`');
                }
              } else if (emojiInput.startsWith(':') && emojiInput.endsWith(':')) {
                const emojiName = emojiInput.slice(1, -1);
                const guildEmoji = message.guild.emojis.cache.find(e => e.name === emojiName);
                if (guildEmoji) {
                  iconUrl = `https://cdn.discordapp.com/emojis/${guildEmoji.id}.${guildEmoji.animated ? 'gif' : 'png'}`;
                } else {
                  return embeds.warn(message, `Custom emoji **${emojiName}** not found in this server. Please use the full format like \`<:${emojiName}:id>\``);
                }
              } else {
                iconUrl = emojiInput;
              }
            }
          }
        } else {
          return embeds.warn(message, 'Please provide an **emoji** (`:name:` or `<:name:id>`), **image URL**, or "none" to remove the icon');
        }

        try {
          const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
          if (!discordRole) {
            await guildService.deleteBoosterRole(message.guild.id, message.author.id);
            return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
          }

          if (iconUrl && !iconUrl.startsWith('http') && !/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}]/u.test(iconUrl)) {
            return embeds.warn(message, 'Invalid icon format. Please use:\n• Full format: `<:name:id>`\n• Emoji name: `:name:`\n• Direct image URL\n• Unicode emoji');
          }

          await discordRole.edit({ icon: iconUrl });
          await guildService.updateBoosterRole(message.guild.id, message.author.id, { icon: args[0], lastUsed: new Date() });

          let iconText;
          if (!iconUrl) {
            iconText = 'removed';
          } else if (iconUrl.startsWith('https://cdn.discordapp.com/emojis/')) {
            iconText = `set to custom emoji`;
          } else if (iconUrl.startsWith('http')) {
            iconText = `set to image`;
          } else {
            iconText = `set to ${iconUrl}`;
          }
          return embeds.success(message, `Icon for your booster role ${iconText}!`);
        } catch (error) {
          logger.webhook.error(error, message);
          if (error.code === 50035) {
            return embeds.warn(message, 'Invalid icon format. Please use a valid image URL or emoji.');
          } else if (error.code === 50013) {
            return embeds.warn(message, 'Missing permissions to edit this role. Make sure my role is above the booster role.');
          } else if (error.message.includes('ENOENT')) {
            return embeds.warn(message, 'Invalid emoji format. Please use:\n• Full format: `<:name:id>`\n• Emoji name: `:name:`\n• Direct image URL');
          } else if (error.message.includes('icon')) {
            return embeds.warn(message, 'Failed to set icon. This server may not have the required boost level for role icons, or the emoji/image is invalid.');
          } else if (error.message.includes('Invalid Form Body')) {
            return embeds.warn(message, 'Invalid emoji or image format. Try using a direct image URL or a different emoji.');
          }
          return embeds.deny(message, `Failed to update booster role icon: ${error.message}`);
        }
      }
    },

    color: {
      name: 'color',
      aliases: ['colour'],
      description: 'Set a color for your booster role',
      syntax: '{guildprefix}boostrole color [color]',
      parameters: ['color'],
      example: '{guildprefix}boostrole color #FF0000',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        if (!await canUseBoosterRoles(message.member)) {
          return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
        }

        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
        }

        if (!args[0]) {
          return embeds.warn(message, 'Please provide a **color** (e.g., #ff0000, red, FF0000) or "none" to remove color');
        }

        if (args[0].toLowerCase() === 'none' || args[0].toLowerCase() === 'remove') {
          try {
            const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
            if (!discordRole) {
              await guildService.deleteBoosterRole(message.guild.id, message.author.id);
              return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
            }
            await discordRole.edit({ color: 0x000000 });
            await guildService.updateBoosterRole(message.guild.id, message.author.id, { color: null, lastUsed: new Date() });
            return embeds.success(message, 'Color removed from your booster role!');
          } catch (error) {
            logger.webhook.error(error, message);
            return embeds.deny(message, 'Failed to remove booster role color. Please check my permissions.');
          }
        }

        try {
          const primaryColor = parseColor(args[0]);
          const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
          if (!discordRole) {
            await guildService.deleteBoosterRole(message.guild.id, message.author.id);
            return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
          }

          const colorInt = parseInt(primaryColor.replace('#', ''), 16);
          await discordRole.edit({ color: colorInt });
          await guildService.updateBoosterRole(message.guild.id, message.author.id, { color: primaryColor, lastUsed: new Date() });

          return embeds.success(message, `Changed your booster role color to **${args[0]}** (${primaryColor})`);
        } catch (error) {
          return embeds.warn(message, `Could not parse color **${args[0]}**. Try:\n• Color names: \`red\`, \`blue\`, \`brown\`, \`pink\`, etc.\n• Hex codes: \`#FF0000\` or \`FF0000\`\n• RGB: \`rgb(255,0,0)\``);
        }
      }
    },

    gradient: {
      name: 'gradient',
      aliases: [],
      description: 'Set a gradient color for your booster role',
      syntax: '{guildprefix}boostrole gradient [color1] [color2]',
      parameters: ['color1', 'color2'],
      example: '{guildprefix}boostrole gradient red blue',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        if (!await canUseBoosterRoles(message.member)) {
          return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
        }

        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
        }

        if (!args[0] || !args[1]) {
          return embeds.warn(message, 'Please provide **two colors** for the gradient (e.g., `br gradient red blue`)');
        }

        try {
          const color1 = parseColor(args[0]);
          const color2 = parseColor(args[1]);
          const color1Int = parseInt(color1.replace('#', ''), 16);
          const color2Int = parseInt(color2.replace('#', ''), 16);

          const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
          if (!discordRole) {
            await guildService.deleteBoosterRole(message.guild.id, message.author.id);
            return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
          }

          const hasEnhancedColors = message.guild.features?.includes('ENHANCED_ROLE_COLORS');
          if (!hasEnhancedColors) {
            return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use gradient colors.\n\nCurrent server features: ${message.guild.features?.join(', ') || 'None'}\n\nTry using \`br color\` for a single color instead.`);
          }

          try {
            const { Routes } = require('discord.js');
            await client.rest.patch(
              Routes.guildRole(message.guild.id, discordRole.id),
              {
                body: {
                  colors: {
                    primary_color: color1Int,
                    secondary_color: color2Int
                  }
                }
              }
            );

            await guildService.updateBoosterRole(message.guild.id, message.author.id, { color: `${color1},${color2}`, lastUsed: new Date() });
            return embeds.success(message, `Changed your booster role to gradient colors **${args[0]}** → **${args[1]}** (${color1} → ${color2})`);
          } catch (gradientError) {
            if (gradientError.code === 50035 || gradientError.message?.includes('ENHANCED_ROLES') || gradientError.message?.includes('guild feature')) {
              return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use gradient colors.`);
            }
            return embeds.deny(message, `Failed to set gradient colors: ${gradientError.message || 'Unknown error'}`);
          }
        } catch (error) {
          return embeds.warn(message, `Could not parse colors. Try:\n• Color names: \`red\`, \`blue\`, \`brown\`, \`pink\`, etc.\n• Hex codes: \`#FF0000\` or \`FF0000\``);
        }
      }
    },

    holographic: {
      name: 'holographic',
      aliases: ['holo'],
      description: 'Set your booster role to holographic colors',
      syntax: '{guildprefix}boostrole holographic',
      parameters: [],
      example: '{guildprefix}boostrole holographic',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        if (!await canUseBoosterRoles(message.member)) {
          return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
        }

        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
        }

        const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
        if (!discordRole) {
          await guildService.deleteBoosterRole(message.guild.id, message.author.id);
          return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
        }

        const holoColors = {
          primary_color: 11127295,
          secondary_color: 16759788,
          tertiary_color: 16761760
        };

        try {
          const { Routes } = require('discord.js');
          await client.rest.patch(
            Routes.guildRole(message.guild.id, discordRole.id),
            {
              body: {
                color: holoColors.primary_color,
                colors: {
                  primary_color: holoColors.primary_color,
                  secondary_color: holoColors.secondary_color,
                  tertiary_color: holoColors.tertiary_color
                }
              },
              reason: `Booster role set to holographic by ${message.author.tag}`
            }
          );

          await guildService.updateBoosterRole(message.guild.id, message.author.id, { color: 'holographic', lastUsed: new Date() });
          return embeds.success(message, `Changed your booster role to holographic colors! ✨`);
        } catch (error) {
          if (error.code === 50035 || error.message?.includes('ENHANCED_ROLES') || error.message?.includes('guild feature')) {
            return embeds.warn(message, `This server needs **Enhanced Roles** unlocked to use holographic colors.`);
          }
          return embeds.deny(message, `Failed to set holographic colors: ${error.message || 'Unknown error'}`);
        }
      }
    },

    share: {
      name: 'share',
      aliases: [],
      description: 'Share your booster role with another user',
      syntax: '{guildprefix}boostrole share [@user]',
      parameters: ['user'],
      example: '{guildprefix}boostrole share @vwsn',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        // Handle sub-subcommands
        const shareSubcommand = args[0]?.toLowerCase();
        
        if (shareSubcommand === 'remove') {
          return module.exports.subcommands['share remove'].handler(client, message, args.slice(1), guildService);
        }
        
        if (shareSubcommand === 'list') {
          return module.exports.subcommands['share list'].handler(client, message, args.slice(1), guildService);
        }

        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
        }

        if (!boosterRole.roleId) {
          return embeds.warn(message, 'Your booster role data is corrupted. Please contact an admin.');
        }

        if (!args[0]) {
          return embeds.warn(message, 'Please mention a **user** to share your booster role with');
        }

        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        const targetUser = userResult.user.user;
        const targetMember = userResult.user;

        if (targetUser.id === message.author.id) {
          return embeds.warn(message, 'You cannot share your booster role with yourself');
        }

        if (targetUser.bot) {
          return embeds.warn(message, 'You cannot share your booster role with bots');
        }

        if (!boosterRole.sharedWith) boosterRole.sharedWith = [];
        if (!boosterRole.pendingShares) boosterRole.pendingShares = [];

        if (boosterRole.sharedWith.find(s => s.userId === targetUser.id)) {
          return embeds.warn(message, `You have already shared your booster role with **${targetUser.username}**`);
        }

        if (boosterRole.sharedWith.length >= 5) {
          return embeds.warn(message, 'You can only share your booster role with **5 people** maximum');
        }

        if (boosterRole.pendingShares.find(ps => ps.userId === targetUser.id)) {
          return embeds.warn(message, `You already have a pending share request with **${targetUser.username}**`);
        }

        try {
          let discordRole = message.guild.roles.cache.get(boosterRole.roleId);
          if (!discordRole) {
            try {
              discordRole = await message.guild.roles.fetch(boosterRole.roleId);
            } catch (error) {
              discordRole = null;
            }
          }

          let roleDisplay;
          if (discordRole) {
            roleDisplay = `<@&${boosterRole.roleId}>`;
          } else {
            const roleName = boosterRole.name || 'Unknown Role';
            roleDisplay = `**${roleName}** (role deleted)`;
          }

          const pendingShareId = Date.now();

          const shareEmbed = new EmbedBuilder()
            .setColor(config.colors.embed)
            .setDescription(`**${message.author.username}** wants to share their booster role with you!`)
            .addFields(
              { name: 'Role', value: roleDisplay, inline: true },
              { name: 'Shared by', value: `<@${message.author.id}>`, inline: true }
            )
            .setFooter({ text: 'You have 60 seconds to respond' })
            .setTimestamp();

          const createButtons = (disabled = false) => {
            const row = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`br_accept_${pendingShareId}_${targetUser.id}`)
                  .setLabel('Accept')
                  .setStyle(ButtonStyle.Success)
                  .setDisabled(disabled),
                new ButtonBuilder()
                  .setCustomId(`br_decline_${pendingShareId}_${targetUser.id}`)
                  .setLabel('Decline')
                  .setStyle(ButtonStyle.Danger)
                  .setDisabled(disabled)
              );
            return row;
          };

          const buttons = createButtons();
          const shareMessage = await message.channel.send({
            content: `<@${targetUser.id}>`,
            embeds: [shareEmbed],
            components: [buttons]
          });

          const pendingShare = {
            id: pendingShareId,
            userId: message.author.id,
            targetUserId: targetUser.id,
            roleId: boosterRole.roleId,
            pending: true,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 1000)
          };

          if (!boosterRole.pendingShares) boosterRole.pendingShares = [];
          boosterRole.pendingShares.push(pendingShare);

          await guildService.updateBoosterRole(message.guild.id, message.author.id, {
            pendingShares: boosterRole.pendingShares
          });

          setTimeout(async () => {
            try {
              const updatedBoosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
              if (updatedBoosterRole && updatedBoosterRole.pendingShares) {
                updatedBoosterRole.pendingShares = updatedBoosterRole.pendingShares.filter(ps => ps.id !== pendingShareId);
                await guildService.updateBoosterRole(message.guild.id, message.author.id, {
                  pendingShares: updatedBoosterRole.pendingShares
                });
              }

              const disabledButtons = createButtons(true);
              try {
                await shareMessage.edit({ components: [disabledButtons] });
              } catch (editError) {
                if (editError.code !== 10008) {
                  logger.webhook.error(editError, message);
                }
              }
            } catch (error) {
              logger.webhook.error(error, message);
            }
          }, 60000);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to send share request. Please try again.');
        }
      }
    },

    'share remove': {
      name: 'share remove',
      aliases: [],
      description: 'Remove someone from your shared booster role',
      syntax: '{guildprefix}boostrole share remove [@user]',
      parameters: ['user'],
      example: '{guildprefix}boostrole share remove @vwsn',

      handler: async (client, message, args, guildService) => {
        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role!');
        }

        if (!args[0]) {
          return embeds.warn(message, 'Please mention a **user** to remove from your booster role');
        }

        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        const targetUser = userResult.user.user;
        const targetMember = userResult.user;

        if (!boosterRole.sharedWith) boosterRole.sharedWith = [];

        const sharedIndex = boosterRole.sharedWith.findIndex(s => s.userId === targetUser.id);
        if (sharedIndex === -1) {
          return embeds.warn(message, `**${targetUser.username}** doesn't have access to your booster role`);
        }

        try {
          const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
          if (discordRole && targetMember.roles.cache.has(discordRole.id)) {
            await targetMember.roles.remove(discordRole);
          }

          boosterRole.sharedWith.splice(sharedIndex, 1);
          await guildService.updateBoosterRole(message.guild.id, message.author.id, { sharedWith: boosterRole.sharedWith });

          return embeds.success(message, `Removed **${targetUser.username}** from your booster role`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to remove user from booster role. Please check my permissions.');
        }
      }
    },

    'share list': {
      name: 'share list',
      aliases: [],
      description: 'Show list of users who have your booster role',
      syntax: '{guildprefix}boostrole share list',
      parameters: [],
      example: '{guildprefix}boostrole share list',

      handler: async (client, message, args, guildService) => {
        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role!');
        }

        if (!boosterRole.sharedWith) boosterRole.sharedWith = [];

        if (boosterRole.sharedWith.length === 0) {
          return embeds.info(message, 'You haven\'t shared your booster role with anyone yet');
        }

        const sharedList = boosterRole.sharedWith.map((share, index) => {
          const sharedDate = share.sharedAt ? new Date(share.sharedAt).toLocaleDateString() : 'Unknown';
          return `${index + 1}. <@${share.userId}> - Shared on ${sharedDate}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Booster Role Shared With')
          .setDescription(sharedList)
          .setFooter({ text: `${boosterRole.sharedWith.length}/5 shares used` });

        return message.channel.send({ embeds: [embed] });
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete'],
      description: 'Remove your booster role',
      syntax: '{guildprefix}boostrole remove',
      parameters: [],
      example: '{guildprefix}boostrole remove',

      handler: async (client, message, args, guildService) => {
        const isEnabled = await guildService.isBoosterRoleSystemEnabled(message.guild.id);
        if (!isEnabled) {
          return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `settings baserole @role`');
        }

        const boosterRole = await guildService.getUserBoosterRole(message.guild.id, message.author.id);
        if (!boosterRole) {
          return embeds.warn(message, 'You don\'t have a booster role to remove!');
        }

        const roleName = boosterRole.name || 'Unknown Role';

        await createConfirmation(
          message,
          `Are you sure you want to **delete** your booster role **${roleName}**? This action cannot be undone.`,
          async (interaction) => {
            try {
              const discordRole = message.guild.roles.cache.get(boosterRole.roleId);

              if (discordRole) {
                const membersWithRole = discordRole.members;
                for (const [memberId, member] of membersWithRole) {
                  try {
                    await member.roles.remove(discordRole, 'Booster role deleted by owner');
                  } catch (roleError) {}
                }
                await discordRole.delete('Booster role removed by owner');
              }

              await guildService.deleteBoosterRole(message.guild.id, message.author.id);

              const successEmbed = embeds.createSuccess(message, `Successfully removed your booster role **${roleName}**!`);
              await interaction.editReply({ embeds: [successEmbed], components: [] });
            } catch (error) {
              logger.webhook.error(error, message);
              const errorEmbed = embeds.createDeny(message, 'Failed to remove booster role. Please check my permissions or try again.');
              await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }
          }
        );
      }
    },

    cleanup: {
      name: 'cleanup',
      aliases: [],
      description: 'Remove unused booster roles',
      syntax: '{guildprefix}boostrole cleanup [days]',
      parameters: ['days (optional)'],
      example: '{guildprefix}boostrole cleanup 30',

      handler: async (client, message, args, guildService) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

        const daysSinceLastUsed = args[0] ? parseInt(args[0]) : 30;

        if (isNaN(daysSinceLastUsed) || daysSinceLastUsed < 1 || daysSinceLastUsed > 365) {
          return embeds.warn(message, 'Please provide a valid number of days (1-365). Default is 30 days.');
        }

        try {
          const unusedRoles = await guildService.getUnusedBoosterRoles(message.guild.id, daysSinceLastUsed);

          if (unusedRoles.length === 0) {
            return embeds.info(message, `No unused booster roles found (inactive for ${daysSinceLastUsed}+ days)`);
          }

          let deletedCount = 0;
          let failedCount = 0;

          for (const boosterRole of unusedRoles) {
            try {
              const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
              if (discordRole) {
                await discordRole.delete('Booster role cleanup');
              }
              await guildService.deleteBoosterRole(message.guild.id, boosterRole.userId || boosterRole.ownerId);
              deletedCount++;
            } catch (error) {
              logger.webhook.error(error, message);
              failedCount++;
            }
          }

          const resultText = `Cleanup completed!\n\n` +
            `**Deleted:** ${deletedCount} booster roles\n` +
            (failedCount > 0 ? `**Failed:** ${failedCount} booster roles\n` : '') +
            `**Criteria:** Inactive for ${daysSinceLastUsed}+ days`;

          return embeds.success(message, resultText);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to perform cleanup. Please try again.');
        }
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'boostrole');
    }

    // Find matching subcommand (checks name and aliases)
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'boostrole');
  }
};
