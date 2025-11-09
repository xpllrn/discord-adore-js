const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
const { ActivityType } = require('discord.js');

module.exports = {
  name: 'presenceUpdate',
  async execute(oldPresence, newPresence, client) {
    // Skip if no presence or guild
    if (!newPresence || !newPresence.guild || !newPresence.member) return;

    // Skip bots
    if (newPresence.member.user.bot) return;

    // Skip if invisible or offline
    if (newPresence?.status === "invisible" || newPresence?.status === "offline" ||
        oldPresence?.status === "invisible" || oldPresence?.status === "offline") return;

    try {
      await processVanityStatusDetection(newPresence);
    } catch (error) {
      // Silent fail for vanity detection
    }
  },
};

async function processVanityStatusDetection(newPresence) {
  // Get guild data to check for vanity configuration
  const guildData = await ensureGuildData(newPresence.guild.id);
  const { getService } = require('@services');
  const guildService = getService('guild');

  // Check if vanity is configured
  if (!guildData.Vanity || !guildData.VanityRoles || guildData.VanityRoles.length === 0) {
    return; // No vanity configured
  }

  // Check if vanity is disabled due to permission issues
  const isDisabled = await guildService.isVanityDisabled(newPresence.guild.id);
  if (isDisabled) {
    return; // Skip if vanity is disabled
  }

  const member = newPresence.member;
  const vanityText = guildData.Vanity;
  const vanityRoles = guildData.VanityRoles;

  // Check if user has vanity in their custom status
  let hasVanityInStatus = false;

  if (newPresence.activities && newPresence.activities[0]?.type === ActivityType.Custom) {
    const customStatus = newPresence.activities[0]?.state;
    if (customStatus) {
      // Check if vanity text is anywhere in the custom status
      hasVanityInStatus = customStatus.toLowerCase().includes(vanityText.toLowerCase());
    }
  }

  // Check if member currently has any vanity roles
  const hasVanityRole = member.roles.cache.hasAny(...vanityRoles);

  if (hasVanityInStatus && !hasVanityRole) {
    // Add vanity roles
    try {
      // Check if bot has permission to manage roles
      if (!newPresence.guild.members.me.permissions.has('ManageRoles')) {
        await guildService.disableVanity(newPresence.guild.id, 'Bot missing Manage Roles permission');
        return;
      }

      // Check if any vanity roles are above bot's highest role
      const botHighestRole = newPresence.guild.members.me.roles.highest;
      const invalidRoles = [];

      for (const roleId of vanityRoles) {
        const role = newPresence.guild.roles.cache.get(roleId);
        if (role && role.position >= botHighestRole.position) {
          invalidRoles.push(role.name);
        }
      }

      if (invalidRoles.length > 0) {
        await guildService.disableVanity(newPresence.guild.id,
          `Vanity roles above bot's role hierarchy: ${invalidRoles.join(', ')}`);
        return;
      }

      await member.roles.add(vanityRoles, 'added vanity role(s)');

      // Send vanity message
      if (guildData.VanityMessage && guildData.VanityLogChannel) {
        const logChannel = newPresence.guild.channels.cache.get(guildData.VanityLogChannel);
        if (logChannel) {
          try {
            EmbedVariableProcessor.process(logChannel, guildData.VanityMessage, {
              user: member.user,
              guild: newPresence.guild,
              channel: logChannel,
              vanity: guildData.Vanity,
              roles: vanityRoles.map(roleId => {
                const role = newPresence.guild.roles.cache.get(roleId);
                return role ? role.name : 'Unknown Role';
              }).join(', '),
              source: 'custom status'
            });
          } catch (error) {
            // Fallback message
            logChannel.send(`${member.user} has vanity in their status`);
          }
        }
      }
    } catch (error) {
      // If role assignment fails due to permissions, disable vanity
      if (error.code === 50013) { // Missing Permissions
        await guildService.disableVanity(newPresence.guild.id, 'Permission error during role assignment');
      }
    }

  } else if (!hasVanityInStatus && hasVanityRole) {
    // Remove vanity roles silently (no notification)
    try {
      // Check if bot has permission to manage roles
      if (!newPresence.guild.members.me.permissions.has('ManageRoles')) {
        await guildService.disableVanity(newPresence.guild.id, 'Bot missing Manage Roles permission');
        return;
      }

      await member.roles.remove(vanityRoles, 'removed vanity role(s)');
    } catch (error) {
      // If role removal fails due to permissions, disable vanity
      if (error.code === 50013) { // Missing Permissions
        await guildService.disableVanity(newPresence.guild.id, 'Permission error during role removal');
      }
    }
  }
}
