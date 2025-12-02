const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../core/embeds');
const config = require('../config/setup');
const permsConfig = require('../config/perms.json');
const database = require('../database');

// Build permission levels from environment variables and perms.json
const PERMISSION_LEVELS = {
  premium: {
    roleId: config.permissions.premiumRoleId,
    name: 'Premium',
    message: permsConfig.premium.customMessage || 'You need to buy **premium/boost** adore app server for this feature!'
  },
  dev: {
    userId: config.bot.ownerId, // Only DEV_ID can use developer commands
    name: 'Developer',
    message: permsConfig.dev.customMessage || 'This command is restricted to **developers** only!'
  }
};

// Permission level checking
async function hasPermissionLevel(message, level) {
  const userId = message.author.id;
  const config = require('../config/setup');

  // Check if it's the dev level - ONLY bot owner (DEV_ID) can use developer commands
  if (level === 'dev') {
    return userId === config.bot.ownerId;
  }

  // For other permission levels (like premium), check normally
  if (userId === config.bot.ownerId) {
    return true;
  }

  // Server owner bypasses permission level checks in their own server (except dev)
  if (isServerOwner(message)) {
    return true;
  }

  // Check instance-based permissions first
  if (await hasInstancePermission(userId, level)) {
    return true;
  }

  // Check if it's premium level
  if (level === 'premium') {
    try {
      if (!PERMISSION_LEVELS.premium?.roleId || !config.bot.devServerId) {
        return false;
      }

      const devServer = message.client.guilds.cache.get(config.bot.devServerId);
      if (!devServer) {
        return false;
      }

      const member = await devServer.members.fetch(userId).catch(() => null);
      if (member && member.roles.cache.has(PERMISSION_LEVELS.premium.roleId)) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  return false;
}

// Instance-based permission checking
async function hasInstancePermission(userId, permission) {
  try {
    const config = require('../config/setup');

    // DEV_ID user has access to ALL instance permissions
    if (userId === config.bot.ownerId) return true;

    const { System } = database;
    if (!System) return false;

    // Get system data
    const systemData = await System.findOne({ _id: 'system' });
    if (!systemData) return false;

    // For now, return true for all permissions since we removed instance-based permissions
    return true;

  } catch (error) {
    return false;
  }
}

async function checkPermissionLevel(message, level) {
  const hasPermission = await hasPermissionLevel(message, level);

  if (!hasPermission) {
    embeds.warn(message, PERMISSION_LEVELS[level]?.message || 'You do not have permission to use this command!');
    return false;
  }

  return true;
}

// Hierarchy checks
function checkUserHierarchy(message, targetMember, sendError = true) {
  // DEV_ID user bypasses all hierarchy checks
  if (isGlobalDev(message.author.id)) {
    return true;
  }

  // Server owner bypasses all hierarchy checks
  if (isServerOwner(message)) {
    return true;
  }

  // Users can manage roles for themselves (hierarchy check happens at role level)
  if (targetMember.id === message.author.id) {
    return true;
  }

  if (targetMember.roles.highest.position >= message.member.roles.highest.position) {
    if (sendError) {
      embeds.warn(message, `**${targetMember.user.username}** is above your role!`);
    }
    return false;
  }
  return true;
}

function checkBotHierarchy(message, target, sendError = true) {
  const targetPosition = target.roles ? target.roles.highest.position : target.position;
  const targetName = target.user ? target.user.username : target.name;

  if (targetPosition >= message.guild.members.me.roles.highest.position) {
    if (sendError) {
      embeds.warn(message, `**${targetName}** is above my role!`);
    }
    return false;
  }
  return true;
}

function checkUserRoleHierarchy(message, role, enabled = true) {
  if (!enabled) return true;

  // DEV_ID user bypasses all hierarchy checks
  if (isGlobalDev(message.author.id)) {
    return true;
  }

  // Server owner bypasses all hierarchy checks
  if (isServerOwner(message)) {
    return true;
  }

  if (role.position >= message.member.roles.highest.position) {
    embeds.warn(message, `**${role.name}** is above your role!`);
    return false;
  }
  return true;
}

function checkBotRoleHierarchy(message, role, enabled = true) {
  if (!enabled) return true;

  if (role.position >= message.guild.members.me.roles.highest.position) {
    embeds.warn(message, `**${role.name}** is above my role!`);
    return false;
  }
  return true;
}

function checkUserMemberHierarchy(message, member, enabled = true) {
  if (!enabled) return true;
  return checkUserHierarchy(message, member, true);
}

function checkBotMemberHierarchy(message, member, enabled = true) {
  if (!enabled) return true;
  return checkBotHierarchy(message, member, true);
}

// Action checks
function checkSelfAction(message, targetUser, action) {
  // DEV_ID user can target themselves (for testing purposes)
  if (isGlobalDev(message.author.id)) {
    return true;
  }

  // For role management, users CAN manage roles for themselves if the role is below their highest role
  // This is standard Discord behavior - users can assign/remove roles to/from themselves
  // The hierarchy check (checkUserRoleHierarchy) will handle whether they can manage the specific role
  if (action.includes('manage roles')) {
    return true;
  }

  // For other actions (like moderation), prevent self-targeting
  if (targetUser.id === message.author.id) {
    embeds.warn(message, `You cannot ${action} yourself!`);
    return false;
  }
  return true;
}

function checkBotAction(message, targetUser) {
  if (targetUser.id === message.guild.members.me.id) {
    message.channel.send('Leave me alone!');
    return false;
  }
  return true;
}

function checkDiscordActionable(message, member, action) {
  let actionable = false;

  switch (action.toLowerCase()) {
    case 'kick':
      actionable = member.kickable;
      break;
    case 'ban':
      actionable = member.bannable;
      break;
    case 'timeout':
    case 'mute':
      actionable = member.moderatable;
      break;
    case 'manage roles':
    case 'jail':
      actionable = member.manageable;
      break;
    default:
      actionable = true;
  }

  if (!actionable) {
    embeds.warn(message, `**${member.user.username}** is above my role!`);
    return false;
  }
  return true;
}

// Discord permission checks
function hasDiscordPermission(message, permission, permissionName, customMessage = null) {
  // DEV_ID user bypasses all Discord permission checks
  if (isGlobalDev(message.author.id)) {
    return true;
  }

  // Server owner bypasses all Discord permission checks in their own server
  if (isServerOwner(message)) {
    return true;
  }

  if (!message.member.permissions.has(permission)) {
    const errorMessage = customMessage || `You need \`${permissionName}\` permission to use this command!`;
    embeds.warn(message, errorMessage);
    return false;
  }
  return true;
}

// Multiple Discord permission checks
function hasMultipleDiscordPermissions(message, permissions, permissionNames) {
  // DEV_ID user bypasses all Discord permission checks
  if (isGlobalDev(message.author.id)) {
    return true;
  }

  // Server owner bypasses all Discord permission checks in their own server
  if (isServerOwner(message)) {
    return true;
  }

  const missingPermissions = [];

  for (let i = 0; i < permissions.length; i++) {
    if (!message.member.permissions.has(permissions[i])) {
      missingPermissions.push(permissionNames[i]);
    }
  }

  if (missingPermissions.length > 0) {
    const permissionText = missingPermissions.length === 1
      ? `\`${missingPermissions[0]}\` permission`
      : `\`${missingPermissions.join('\` and \`')}\` permissions`;
    embeds.warn(message, `You need ${permissionText} to use this command!`);
    return false;
  }
  return true;
}

// Check if user is the global dev (DEV_ID)
function isGlobalDev(userId) {
  const config = require('../config/setup');
  return userId === config.bot.ownerId;
}

// Check if user is the server owner
function isServerOwner(message) {
  return message.author.id === message.guild.ownerId;
}

// All Discord Permissions Reference
const DISCORD_PERMISSIONS = {
  // General Server Permissions
  Administrator: PermissionFlagsBits.Administrator,
  ViewAuditLog: PermissionFlagsBits.ViewAuditLog,
  ManageGuild: PermissionFlagsBits.ManageGuild,
  ManageRoles: PermissionFlagsBits.ManageRoles,
  ManageChannels: PermissionFlagsBits.ManageChannels,
  KickMembers: PermissionFlagsBits.KickMembers,
  BanMembers: PermissionFlagsBits.BanMembers,
  CreateInstantInvite: PermissionFlagsBits.CreateInstantInvite,
  ChangeNickname: PermissionFlagsBits.ChangeNickname,
  ManageNicknames: PermissionFlagsBits.ManageNicknames,
  ManageGuildExpressions: PermissionFlagsBits.ManageGuildExpressions,
  ManageWebhooks: PermissionFlagsBits.ManageWebhooks,
  ViewChannel: PermissionFlagsBits.ViewChannel,
  ModerateMembers: PermissionFlagsBits.ModerateMembers,
  ViewCreatorMonetizationAnalytics: PermissionFlagsBits.ViewCreatorMonetizationAnalytics,
  ManageEvents: PermissionFlagsBits.ManageEvents,

  // Text Channel Permissions
  SendMessages: PermissionFlagsBits.SendMessages,
  SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
  CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
  CreatePrivateThreads: PermissionFlagsBits.CreatePrivateThreads,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  AddReactions: PermissionFlagsBits.AddReactions,
  UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
  UseExternalStickers: PermissionFlagsBits.UseExternalStickers,
  MentionEveryone: PermissionFlagsBits.MentionEveryone,
  ManageMessages: PermissionFlagsBits.ManageMessages,
  ManageThreads: PermissionFlagsBits.ManageThreads,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
  SendTTSMessages: PermissionFlagsBits.SendTTSMessages,
  SendVoiceMessages: PermissionFlagsBits.SendVoiceMessages,
  UseApplicationCommands: PermissionFlagsBits.UseApplicationCommands,

  // Voice Channel Permissions
  Connect: PermissionFlagsBits.Connect,
  Speak: PermissionFlagsBits.Speak,
  Stream: PermissionFlagsBits.Stream,
  UseEmbeddedActivities: PermissionFlagsBits.UseEmbeddedActivities,
  UseSoundboard: PermissionFlagsBits.UseSoundboard,
  UseExternalSounds: PermissionFlagsBits.UseExternalSounds,
  UseVAD: PermissionFlagsBits.UseVAD,
  PrioritySpeaker: PermissionFlagsBits.PrioritySpeaker,
  MuteMembers: PermissionFlagsBits.MuteMembers,
  DeafenMembers: PermissionFlagsBits.DeafenMembers,
  MoveMembers: PermissionFlagsBits.MoveMembers,
  SetVoiceChannelStatus: PermissionFlagsBits.SetVoiceChannelStatus,

  // Stage Channel Permissions
  RequestToSpeak: PermissionFlagsBits.RequestToSpeak
};

// Permission name mapping for user-friendly display
const PERMISSION_NAMES = {
  Administrator: 'Administrator',
  ViewAuditLog: 'View Audit Log',
  ManageGuild: 'Manage Server',
  ManageRoles: 'Manage Roles',
  ManageChannels: 'Manage Channels',
  KickMembers: 'Kick Members',
  BanMembers: 'Ban Members',
  CreateInstantInvite: 'Create Invite',
  ChangeNickname: 'Change Nickname',
  ManageNicknames: 'Manage Nicknames',
  ManageGuildExpressions: 'Manage Expressions',
  ManageWebhooks: 'Manage Webhooks',
  ViewChannel: 'View Channels',
  ModerateMembers: 'Timeout Members',
  ViewCreatorMonetizationAnalytics: 'View Server Insights',
  ManageEvents: 'Manage Events',
  SendMessages: 'Send Messages',
  SendMessagesInThreads: 'Send Messages in Threads',
  CreatePublicThreads: 'Create Public Threads',
  CreatePrivateThreads: 'Create Private Threads',
  EmbedLinks: 'Embed Links',
  AttachFiles: 'Attach Files',
  AddReactions: 'Add Reactions',
  UseExternalEmojis: 'Use External Emojis',
  UseExternalStickers: 'Use External Stickers',
  MentionEveryone: 'Mention @everyone, @here, and All Roles',
  ManageMessages: 'Manage Messages',
  ManageThreads: 'Manage Threads',
  ReadMessageHistory: 'Read Message History',
  SendTTSMessages: 'Send Text-to-Speech Messages',
  SendVoiceMessages: 'Send Voice Messages',
  UseApplicationCommands: 'Use Application Commands',
  Connect: 'Connect',
  Speak: 'Speak',
  Stream: 'Video',
  UseEmbeddedActivities: 'Use Activities',
  UseSoundboard: 'Use Soundboard',
  UseExternalSounds: 'Use External Sounds',
  UseVAD: 'Use Voice Activity',
  PrioritySpeaker: 'Priority Speaker',
  MuteMembers: 'Mute Members',
  DeafenMembers: 'Deafen Members',
  MoveMembers: 'Move Members',
  SetVoiceChannelStatus: 'Set Voice Channel Status',
  RequestToSpeak: 'Request to Speak'
};

module.exports = {
  // Permission levels
  hasPermissionLevel,
  checkPermissionLevel,
  hasInstancePermission,
  isGlobalDev,
  isServerOwner,
  PERMISSION_LEVELS,

  // Hierarchy checks
  checkUserHierarchy,
  checkBotHierarchy,
  checkUserRoleHierarchy,
  checkBotRoleHierarchy,
  checkUserMemberHierarchy,
  checkBotMemberHierarchy,

  // Action checks
  checkSelfAction,
  checkBotAction,
  checkDiscordActionable,

  // Discord permissions
  hasDiscordPermission,
  hasMultipleDiscordPermissions,
  PermissionFlagsBits,

  // Permission references
  DISCORD_PERMISSIONS,
  PERMISSION_NAMES
};