const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { hasDiscordPermission } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findRole, findUser } = require('../../handlers/finder');
const guildCache = require('../../database/cache/models/guild');
const config = require('../../config/setup');

module.exports = {
  name: "br",
  aliases: ['boosterrole', 'boostrole'],
  description: `Manage booster roles`,
  usage: `{guildprefix}br baserole [@role]
{guildprefix}br create [name]
{guildprefix}br rename [name]
{guildprefix}br icon [emoji/url]
{guildprefix}br color [hex]
{guildprefix}br share [@user]
{guildprefix}br remove/delete
{guildprefix}br cleanup`,
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'br');
    }

    // Ensure guild data exists in the database
    await ensureGuildData(message.guild.id);

    const subcommand = args[0].toLowerCase();

    // Base role management requires Manage Guild permission
    if (subcommand === 'baserole') {
      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;
      return await handleBaseRole(client, message, args.slice(1));
    }

    // Cleanup requires Manage Guild permission
    if (subcommand === 'cleanup') {
      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;
      return await handleCleanup(client, message, args.slice(1));
    }

    // Check if booster role system is enabled
    const isEnabled = await guildCache.isBoosterRoleSystemEnabled(message.guild.id);
    if (!isEnabled) {
      return embeds.warn(message, 'Booster role system is not enabled. An admin needs to set a base role first using `br baserole @role`');
    }

    // Handle other subcommands
    switch (subcommand) {
      case 'create':
        return await handleCreate(client, message, args.slice(1));
      case 'rename':
        return await handleRename(client, message, args.slice(1));
      case 'icon':
        return await handleIcon(client, message, args.slice(1));
      case 'color':
        return await handleColor(client, message, args.slice(1));
      case 'share':
        return await handleShare(client, message, args.slice(1));
      case 'remove':
      case 'delete':
        return await handleRemove(client, message, args.slice(1));
      default:
        return runHelpCommand(message, 'br');
    }
  }
};

// Helper function to check if user has a booster role or is boosting
async function canUseBoosterRoles(member) {
  // Check if user is boosting the server
  if (member.premiumSince) {
    return true;
  }
  
  // Check if user has an existing booster role
  const boosterRole = await guildCache.getUserBoosterRole(member.guild.id, member.id);
  if (boosterRole) {
    return true;
  }
  
  return false;
}

// Helper function to position role below base role
async function positionRoleBelowBase(guild, roleId, baseRoleId) {
  try {
    const baseRole = guild.roles.cache.get(baseRoleId);
    if (!baseRole) return false;

    const targetPosition = Math.max(1, baseRole.position - 1);
    await guild.roles.edit(roleId, { position: targetPosition });
    return true;
  } catch (error) {
    console.error('Error positioning role:', error);
    return false;
  }
}

// Helper function to check if server supports role icons
function supportsRoleIcons(guild) {
  // Role icons require Level 2 boost (7+ boosts) for basic functionality
  // Level 3 boost (14+ boosts) for full functionality
  return guild.premiumSubscriptionCount >= 7;
}

// Base role management
async function handleBaseRole(client, message, args) {
  if (!args[0]) {
    // Show current base role
    const baseRoleId = await guildCache.getBoosterRoleBaseRole(message.guild.id);
    if (!baseRoleId) {
      return embeds.info(message, 'No base role is currently set for the booster role system');
    }
    
    const baseRole = message.guild.roles.cache.get(baseRoleId);
    if (!baseRole) {
      // Base role was deleted, disable system
      await guildCache.setBoosterRoleBaseRole(message.guild.id, null);
      return embeds.warn(message, 'The base role was deleted. Booster role system has been disabled.');
    }
    
    return embeds.info(message, `Current base role: ${baseRole}\n\nAll booster roles will be positioned below this role.`);
  }

  const roleResult = await findRole(message.guild, args[0], client);
  if (!roleResult.found) {
    return embeds.warn(message, roleResult.error);
  }

  const role = roleResult.role;
  
  // Check if bot can manage this role
  const botMember = message.guild.members.cache.get(client.user.id);
  if (role.position >= botMember.roles.highest.position) {
    return embeds.warn(message, 'I cannot manage this role. Please ensure my highest role is above the base role.');
  }

  // Ensure cache writes are enabled before saving
  const { getCacheManager } = require('../../database/cache/core/CacheManager');
  const cacheManager = getCacheManager();
  if (!cacheManager.guildCache.areWritesEnabled()) {
    // Force enable writes if they're not enabled yet
    cacheManager.enableWrites();
  }

  // Set the base role
  await guildCache.setBoosterRoleBaseRole(message.guild.id, role.id);
  
  return embeds.success(message, `Base role set to ${role}!\n\nBooster role system is now **enabled**. All booster roles will be positioned below this role.`);
}

// Create booster role
async function handleCreate(client, message, args) {
  // Check if user can use booster roles
  if (!await canUseBoosterRoles(message.member)) {
    return embeds.warn(message, 'You need to be **boosting this server** to create a booster role');
  }

  // Check if user already has a booster role
  const existingRole = await guildCache.getUserBoosterRole(message.guild.id, message.author.id);
  if (existingRole) {
    // Check if the Discord role still exists
    const discordRole = message.guild.roles.cache.get(existingRole.roleId);
    if (!discordRole) {
      // Role was deleted, remove from database and allow creation of new one
      await guildCache.deleteBoosterRole(message.guild.id, existingRole.id);
      // Continue with role creation below
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
    // Get base role for positioning
    const baseRoleId = await guildCache.getBoosterRoleBaseRole(message.guild.id);
    const baseRole = message.guild.roles.cache.get(baseRoleId);
    
    if (!baseRole) {
      return embeds.warn(message, 'Base role not found. Please contact an admin to reconfigure the booster role system.');
    }

    // Create the role with no permissions (just a display role)
    const newRole = await message.guild.roles.create({
      name: roleName,
      color: 0x000000, // Default black color
      permissions: [], // No permissions - just a display role
      mentionable: false,
      hoist: false,
      position: Math.max(1, baseRole.position - 1)
    });

    // Add to database
    const boosterRoleData = {
      roleId: newRole.id,
      ownerId: message.author.id,
      name: roleName
    };

    // Ensure cache writes are enabled before saving
    const { getCacheManager } = require('../../database/cache/core/CacheManager');
    const cacheManager = getCacheManager();
    if (!cacheManager.guildCache.areWritesEnabled()) {
      // Force enable writes if they're not enabled yet
      cacheManager.enableWrites();
    }

    await guildCache.addBoosterRole(message.guild.id, boosterRoleData);

    // Give the role to the user
    await message.member.roles.add(newRole);

    return embeds.success(message, `Created your booster role: ${newRole}!`);

  } catch (error) {
    console.error('Error creating booster role:', error);
    return embeds.deny(message, 'Failed to create booster role. Please check my permissions.');
  }
}

// Rename booster role
async function handleRename(client, message, args) {
  // Check if user can use booster roles
  if (!await canUseBoosterRoles(message.member)) {
    return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
  }

  // Get user's booster role
  const boosterRole = await guildCache.getUserBoosterRole(message.guild.id, message.author.id);
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
    // Get the Discord role
    const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
    if (!discordRole) {
      // Role was deleted, remove from database
      await guildCache.deleteBoosterRole(message.guild.id, boosterRole.id);
      return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
    }

    // Update the role name
    await discordRole.edit({ name: newName });

    // Ensure cache writes are enabled before saving
    const { getCacheManager } = require('../../database/cache/core/CacheManager');
    const cacheManager = getCacheManager();
    if (!cacheManager.guildCache.areWritesEnabled()) {
      cacheManager.enableWrites();
    }

    // Update in database
    await guildCache.updateBoosterRole(message.guild.id, boosterRole.id, {
      name: newName,
      lastUsed: new Date()
    });

    return embeds.success(message, `Renamed your booster role to: **${newName}**`);

  } catch (error) {
    console.error('Error renaming booster role:', error);
    return embeds.deny(message, 'Failed to rename booster role. Please check my permissions.');
  }
}

// Set booster role icon
async function handleIcon(client, message, args) {
  // Check if user can use booster roles
  if (!await canUseBoosterRoles(message.member)) {
    return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
  }

  // Check if server supports role icons
  if (!supportsRoleIcons(message.guild)) {
    return embeds.warn(message, `This server needs **Level 2 boost** (7+ boosts) to use role icons. Current boosts: ${message.guild.premiumSubscriptionCount}`);
  }

  // Get user's booster role
  const boosterRole = await guildCache.getUserBoosterRole(message.guild.id, message.author.id);
  if (!boosterRole) {
    return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
  }

  let iconUrl = null;
  if (args[0]) {
    if (args[0].toLowerCase() === 'none' || args[0].toLowerCase() === 'remove') {
      iconUrl = null;
    } else {
      // Check if it's a URL
      try {
        new URL(args[0]);
        iconUrl = args[0];
      } catch {
        // Handle emoji (both Unicode and custom Discord emojis)
        const emojiInput = args[0];

        // Check if it's a custom Discord emoji <:name:id> or <a:name:id>
        const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
        if (customEmojiMatch) {
          // For role icons, Discord expects just the emoji ID, not the full format
          const emojiId = customEmojiMatch[2];
          const isAnimated = emojiInput.startsWith('<a:');
          iconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;
        } else if (/^\d+$/.test(emojiInput)) {
          // If it's just an emoji ID, convert to CDN URL
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
          // Handle :name: format by searching for the emoji in the guild
          const emojiName = emojiInput.slice(1, -1);
          const guildEmoji = message.guild.emojis.cache.find(e => e.name === emojiName);
          if (guildEmoji) {
            iconUrl = `https://cdn.discordapp.com/emojis/${guildEmoji.id}.${guildEmoji.animated ? 'gif' : 'png'}`;
          } else {
            return embeds.warn(message, `Custom emoji **${emojiName}** not found in this server. Please use the full format like \`<:${emojiName}:id>\``);
          }
        } else {
          // For Unicode emojis or other formats, try to use as-is
          iconUrl = emojiInput;
        }
      }
    }
  } else {
    return embeds.warn(message, 'Please provide an **emoji** (`:name:` or `<:name:id>`), **image URL**, or "none" to remove the icon');
  }

  try {
    // Get the Discord role
    const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
    if (!discordRole) {
      // Role was deleted, remove from database
      await guildCache.deleteBoosterRole(message.guild.id, boosterRole.id);
      return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
    }

    // Validate iconUrl before sending to Discord
    if (iconUrl && !iconUrl.startsWith('http') && !/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}]/u.test(iconUrl)) {
      return embeds.warn(message, 'Invalid icon format. Please use:\n• Full format: `<:name:id>`\n• Emoji name: `:name:`\n• Direct image URL\n• Unicode emoji');
    }

    // Update the role icon
    await discordRole.edit({ icon: iconUrl });

    // Ensure cache writes are enabled before saving
    const { getCacheManager } = require('../../database/cache/core/CacheManager');
    const cacheManager = getCacheManager();
    if (!cacheManager.guildCache.areWritesEnabled()) {
      cacheManager.enableWrites();
    }

    // Update in database - store the original input for display purposes
    await guildCache.updateBoosterRole(message.guild.id, boosterRole.id, {
      icon: args[0], // Store original input format
      lastUsed: new Date()
    });

    // Show appropriate success message
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
    console.error('Error setting booster role icon:', error);

    // More specific error handling
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

// Set booster role color
async function handleColor(client, message, args) {
  // Check if user can use booster roles
  if (!await canUseBoosterRoles(message.member)) {
    return embeds.warn(message, 'You need to be **boosting this server** to use booster role commands');
  }

  // Get user's booster role
  const boosterRole = await guildCache.getUserBoosterRole(message.guild.id, message.author.id);
  if (!boosterRole) {
    return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
  }

  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **hex color code** (e.g., #ff0000, red) or "none" to remove color');
  }

  let color = null;
  const colorInput = args[0].toLowerCase();

  if (colorInput === 'none' || colorInput === 'remove') {
    color = 0x000000; // Default black
  } else {
    // Try to parse color
    try {
      // Remove # if present
      const hexColor = colorInput.replace('#', '');

      // Check if it's a valid hex color
      if (/^[0-9A-F]{6}$/i.test(hexColor)) {
        color = parseInt(hexColor, 16);
      } else {
        // Try common color names
        const colorMap = {
          'red': 0xff0000,
          'green': 0x00ff00,
          'blue': 0x0000ff,
          'yellow': 0xffff00,
          'purple': 0x800080,
          'pink': 0xffc0cb,
          'orange': 0xffa500,
          'cyan': 0x00ffff,
          'magenta': 0xff00ff,
          'lime': 0x00ff00,
          'white': 0xffffff,
          'black': 0x000000
        };

        if (colorMap[colorInput]) {
          color = colorMap[colorInput];
        } else {
          return embeds.warn(message, 'Invalid color! Use a hex code (e.g., #ff0000) or color name (e.g., red)');
        }
      }
    } catch {
      return embeds.warn(message, 'Invalid color format! Use a hex code (e.g., #ff0000) or color name (e.g., red)');
    }
  }

  try {
    // Get the Discord role
    const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
    if (!discordRole) {
      // Role was deleted, remove from database
      await guildCache.deleteBoosterRole(message.guild.id, boosterRole.id);
      return embeds.warn(message, 'Your booster role was deleted. Use `br create` to make a new one.');
    }

    // Update the role color
    await discordRole.edit({ color: color });

    // Ensure cache writes are enabled before saving
    const { getCacheManager } = require('../../database/cache/core/CacheManager');
    const cacheManager = getCacheManager();
    if (!cacheManager.guildCache.areWritesEnabled()) {
      cacheManager.enableWrites();
    }

    // Update in database
    const hexColor = color === 0x000000 ? null : `#${color.toString(16).padStart(6, '0')}`;
    await guildCache.updateBoosterRole(message.guild.id, boosterRole.id, {
      color: hexColor,
      lastUsed: new Date()
    });

    const colorText = hexColor ? `set to ${hexColor}` : 'removed';
    return embeds.success(message, `Color for your booster role ${colorText}!`);

  } catch (error) {
    console.error('Error setting booster role color:', error);
    return embeds.deny(message, 'Failed to update booster role color. Please check my permissions.');
  }
}

// Share booster role with another user
async function handleShare(client, message, args) {
  // Ensure cache writes are enabled before lookup
  const { getCacheManager } = require('../../database/cache/core/CacheManager');
  const cacheManager = getCacheManager();
  if (!cacheManager.guildCache.areWritesEnabled()) {
    cacheManager.enableWrites();
  }

  // Get user's booster role (no need to check if they're boosting for sharing)
  const boosterRole = await guildCache.getUserBoosterRole(message.guild.id, message.author.id);
  if (!boosterRole) {
    return embeds.warn(message, 'You don\'t have a booster role! Use `br create` to make one.');
  }

  console.log(`Sharing booster role: id=${boosterRole.id}, roleId=${boosterRole.roleId}, ownerId=${boosterRole.ownerId}`);

  if (!args[0]) {
    return embeds.warn(message, 'Please mention a **user** to share your booster role with');
  }

  const userResult = await findUser(message.guild, args[0], client);
  if (!userResult.found) {
    return embeds.warn(message, userResult.error);
  }

  const targetUser = userResult.user.user;
  const targetMember = userResult.user;

  // Check if trying to share with self
  if (targetUser.id === message.author.id) {
    return embeds.warn(message, 'You cannot share your booster role with yourself');
  }

  // Check if target is a bot
  if (targetUser.bot) {
    return embeds.warn(message, 'You cannot share your booster role with bots');
  }

  // Initialize missing properties for older booster roles
  if (!boosterRole.sharedWith) boosterRole.sharedWith = [];
  if (!boosterRole.pendingShares) boosterRole.pendingShares = [];

  // Check if already shared with this user
  if (boosterRole.sharedWith.find(s => s.userId === targetUser.id)) {
    return embeds.warn(message, `You have already shared your booster role with **${targetUser.username}**`);
  }

  // Check if at sharing limit (5 people)
  if (boosterRole.sharedWith.length >= 5) {
    return embeds.warn(message, 'You can only share your booster role with **5 people** maximum');
  }

  // Check if there's already a pending share for this user
  if (boosterRole.pendingShares.find(ps => ps.userId === targetUser.id)) {
    return embeds.warn(message, `You already have a pending share request with **${targetUser.username}**`);
  }

  try {
    // Check if the Discord role still exists
    const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
    const roleDisplay = discordRole ? `<@&${boosterRole.roleId}>` : `**${boosterRole.name}** (role deleted)`;

    // Create share request embed
    const shareEmbed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setDescription(`**${message.author.username}** wants to share their booster role with you!`)
      .addFields(
        { name: 'Role', value: roleDisplay, inline: true },
        { name: 'Shared by', value: `<@${message.author.id}>`, inline: true }
      )
      .setFooter({ text: 'You have 5 minutes to respond' })
      .setTimestamp();

    // Create accept/decline buttons using buttons.js pattern
    const createButtons = (disabled = false) => {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`br_accept_${boosterRole.id}_${targetUser.id}`)
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
          new ButtonBuilder()
            .setCustomId(`br_decline_${boosterRole.id}_${targetUser.id}`)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
        );
      return row;
    };

    const buttons = createButtons();

    // Send the share request
    const shareMessage = await message.channel.send({
      content: `<@${targetUser.id}>`,
      embeds: [shareEmbed],
      components: [buttons]
    });

    // Ensure cache writes are enabled before saving
    const { getCacheManager } = require('../../database/cache/core/CacheManager');
    const cacheManager = getCacheManager();
    if (!cacheManager.guildCache.areWritesEnabled()) {
      cacheManager.enableWrites();
    }

    // Add to pending shares
    await guildCache.addBoosterRolePendingShare(
      message.guild.id,
      boosterRole.id,
      targetUser.id,
      shareMessage.id,
      message.channel.id
    );

    // Create collector for button interactions
    const collector = shareMessage.createMessageComponentCollector({
      time: 60000 // 60 seconds timeout
    });

    collector.on('collect', async (interaction) => {
      try {
        // Check if interaction is still valid
        if (!interaction.isRepliable()) {
          return;
        }

        // Check if the user is the target user
        if (interaction.user.id !== targetUser.id) {
          const warnEmbed = new EmbedBuilder()
            .setColor(config.colors.warn)
            .setDescription(`${config.emojis.warn} <@${interaction.user.id}>: This button is **NOT** for you`);

          return interaction.reply({
            embeds: [warnEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Disable buttons
        const disabledButtons = createButtons(true);
        await interaction.update({
          components: [disabledButtons]
        });

        collector.stop();
      } catch (error) {
        console.error('Error handling br share interaction:', error);
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        try {
          // Remove pending share from database
          await guildCache.removeBoosterRolePendingShare(message.guild.id, boosterRole.id, targetUser.id);

          // Disable buttons on timeout
          const disabledButtons = createButtons(true);
          await shareMessage.edit({
            components: [disabledButtons]
          });
        } catch (error) {
          // Message might have been deleted
        }
      }
    });

    return embeds.success(message, `Sent a share request to **${targetUser.username}**! They have 60 seconds to respond.`);

  } catch (error) {
    console.error('Error sharing booster role:', error);
    return embeds.deny(message, 'Failed to send share request. Please try again.');
  }
}

// Cleanup unused booster roles
async function handleCleanup(client, message, args) {
  const daysSinceLastUsed = args[0] ? parseInt(args[0]) : 30;

  if (isNaN(daysSinceLastUsed) || daysSinceLastUsed < 1 || daysSinceLastUsed > 365) {
    return embeds.warn(message, 'Please provide a valid number of days (1-365). Default is 30 days.');
  }

  try {
    const unusedRoles = await guildCache.getUnusedBoosterRoles(message.guild.id, daysSinceLastUsed);

    if (unusedRoles.length === 0) {
      return embeds.info(message, `No unused booster roles found (inactive for ${daysSinceLastUsed}+ days)`);
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const boosterRole of unusedRoles) {
      try {
        // Try to delete the Discord role
        const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
        if (discordRole) {
          await discordRole.delete('Booster role cleanup');
        }

        // Remove from database
        await guildCache.deleteBoosterRole(message.guild.id, boosterRole.id);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting booster role ${boosterRole.id}:`, error);
        failedCount++;
      }
    }

    const resultText = `Cleanup completed!\n\n` +
                      `**Deleted:** ${deletedCount} booster roles\n` +
                      (failedCount > 0 ? `**Failed:** ${failedCount} booster roles\n` : '') +
                      `**Criteria:** Inactive for ${daysSinceLastUsed}+ days`;

    return embeds.success(message, resultText);

  } catch (error) {
    console.error('Error during booster role cleanup:', error);
    return embeds.deny(message, 'Failed to perform cleanup. Please try again.');
  }
}

// Remove/delete booster role
async function handleRemove(client, message, args) {
  // Get user's booster role
  const boosterRole = await guildCache.getUserBoosterRole(message.guild.id, message.author.id);
  if (!boosterRole) {
    return embeds.warn(message, 'You don\'t have a booster role to remove!');
  }

  try {
    // Try to delete the Discord role
    const discordRole = message.guild.roles.cache.get(boosterRole.roleId);
    if (discordRole) {
      await discordRole.delete('Booster role removed by owner');
    }

    // Remove from database
    await guildCache.deleteBoosterRole(message.guild.id, boosterRole.id);
    return embeds.success(message, `Successfully removed your booster role **${boosterRole.name}**!`);

  } catch (error) {
    console.error('Error removing booster role:', error);
    return embeds.deny(message, 'Failed to remove booster role. Please check my permissions or try again.');
  }
}
