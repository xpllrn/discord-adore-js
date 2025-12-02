const { ContainerBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors, emojis } = require('../../config/setup');
const { getService } = require('@services');
const { findUser } = require('../../handlers/finder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'permissions',
  aliases: ['perms', 'userpermissions', 'userperms'],
  description: 'View Discord permissions and fake permissions for a user',
  syntax: 'permissions [user]',
  example: 'permissions @User',
  run: async (client, message, args) => {
    try {
      const guildService = getService('guild');

      // Find target member
      let targetMember = message.member;
      
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }
        
        // If it's a global user (not in guild), show error
        if (userResult.isGlobal) {
          return embeds.warn(message, 'That user is not in this server');
        }
        
        targetMember = userResult.user;
      }

      // Get Discord permissions
      const memberPermissions = targetMember.permissions;
      const allPermissions = getAllPermissions();
      
      const permissionsByCategory = {
        moderator: [],
        management: [],
        general: [],
        voice: []
      };

      for (const [category, perms] of Object.entries(allPermissions)) {
        for (const [permName, permBit] of Object.entries(perms)) {
          if (memberPermissions.has(permBit)) {
            permissionsByCategory[category].push(permName);
          }
        }
      }

      // Flatten for total count
      const hasPermissions = [
        ...permissionsByCategory.moderator,
        ...permissionsByCategory.management,
        ...permissionsByCategory.general,
        ...permissionsByCategory.voice
      ];

      // Get fake permissions
      const guildData = await guildService.ensureGuildData(message.guild.id);
      const fakePermissions = [];
      
      if (guildData.FakePermissions) {
        for (const roleId of targetMember.roles.cache.keys()) {
          if (guildData.FakePermissions[roleId]) {
            const rolePerms = guildData.FakePermissions[roleId].permissions || [];
            fakePermissions.push(...rolePerms);
          }
        }
      }

      // Remove duplicates from fake permissions
      const uniqueFakePerms = [...new Set(fakePermissions)];

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.info.replace('#', ''), 16));

      // Title with display name and profile picture
      const displayName = targetMember.displayName || targetMember.user.username;
      
      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents(
            (text) => text.setContent(`# ${displayName}'s Permissions`),
            (text) => text.setContent(`-# @${targetMember.user.username}`)
          )
          .setThumbnailAccessory((thumbnail) =>
            thumbnail
              .setURL(targetMember.user.displayAvatarURL({ size: 512, extension: 'png' }))
              .setDescription(`${targetMember.user.username}'s avatar`)
          )
      );

      // Stats section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(
          `**Roles:** ${targetMember.roles.cache.size - 1}\n` +
          `**Discord Permissions:** ${hasPermissions.length}/${Object.keys(allPermissions).length}\n` +
          `**Fake Permissions:** ${uniqueFakePerms.length}`
        )
      );

      // Discord permissions section
      container.addSeparatorComponents((separator) => separator);
      
      if (memberPermissions.has(PermissionFlagsBits.Administrator)) {
        container.addTextDisplayComponents(
          (text) => text.setContent('**Discord Permissions**'),
          (text) => text.setContent('> `Administrator` (All Permissions)')
        );
      } else if (hasPermissions.length > 0) {
        // Moderator permissions
        if (permissionsByCategory.moderator.length > 0) {
          const modPerms = permissionsByCategory.moderator.map(p => `\`${p}\``).join(', ');
          container.addTextDisplayComponents(
            (text) => text.setContent('**Moderator Permissions**'),
            (text) => text.setContent(`> ${modPerms}`)
          );
        }

        // Management permissions
        if (permissionsByCategory.management.length > 0) {
          if (permissionsByCategory.moderator.length > 0) {
            container.addSeparatorComponents((separator) => separator);
          }
          const mgmtPerms = permissionsByCategory.management.map(p => `\`${p}\``).join(', ');
          container.addTextDisplayComponents(
            (text) => text.setContent('**Management Permissions**'),
            (text) => text.setContent(`> ${mgmtPerms}`)
          );
        }

        // General permissions
        if (permissionsByCategory.general.length > 0) {
          if (permissionsByCategory.moderator.length > 0 || permissionsByCategory.management.length > 0) {
            container.addSeparatorComponents((separator) => separator);
          }
          const genPerms = permissionsByCategory.general.map(p => `\`${p}\``).join(', ');
          container.addTextDisplayComponents(
            (text) => text.setContent('**General Permissions**'),
            (text) => text.setContent(`> ${genPerms}`)
          );
        }

        // Voice permissions
        if (permissionsByCategory.voice.length > 0) {
          if (permissionsByCategory.moderator.length > 0 || permissionsByCategory.management.length > 0 || permissionsByCategory.general.length > 0) {
            container.addSeparatorComponents((separator) => separator);
          }
          const voicePerms = permissionsByCategory.voice.map(p => `\`${p}\``).join(', ');
          container.addTextDisplayComponents(
            (text) => text.setContent('**Voice Permissions**'),
            (text) => text.setContent(`> ${voicePerms}`)
          );
        }
      } else {
        container.addTextDisplayComponents(
          (text) => text.setContent('**Discord Permissions**'),
          (text) => text.setContent('> `None`')
        );
      }

      // Fake permissions section
      if (uniqueFakePerms.length > 0) {
        container.addSeparatorComponents((separator) => separator);
        const fakePermList = uniqueFakePerms.map(p => `\`${p}\``).join(', ');
        container.addTextDisplayComponents(
          (text) => text.setContent('**Fake Permissions**'),
          (text) => text.setContent(`> ${fakePermList}`),
          (text) => text.setContent('-# Fake permissions allow using bot commands without native Discord permissions.')
        );
      }

      // Send with Components V2 flag
      return message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching permissions');
    }
  }
};

// Get all Discord permissions grouped by category
function getAllPermissions() {
  const permissions = {
    moderator: {
      'Kick Members': PermissionFlagsBits.KickMembers,
      'Ban Members': PermissionFlagsBits.BanMembers,
      'Timeout Members': PermissionFlagsBits.ModerateMembers,
      'Manage Messages': PermissionFlagsBits.ManageMessages,
      'Manage Threads': PermissionFlagsBits.ManageThreads,
      'Mute Members': PermissionFlagsBits.MuteMembers,
      'Deafen Members': PermissionFlagsBits.DeafenMembers,
      'Move Members': PermissionFlagsBits.MoveMembers,
      'View Audit Log': PermissionFlagsBits.ViewAuditLog
    },
    management: {
      'Administrator': PermissionFlagsBits.Administrator,
      'Manage Server': PermissionFlagsBits.ManageGuild,
      'Manage Roles': PermissionFlagsBits.ManageRoles,
      'Manage Channels': PermissionFlagsBits.ManageChannels,
      'Manage Nicknames': PermissionFlagsBits.ManageNicknames,
      'Manage Expressions': PermissionFlagsBits.ManageGuildExpressions,
      'Manage Webhooks': PermissionFlagsBits.ManageWebhooks,
      'Manage Events': PermissionFlagsBits.ManageEvents
    },
    general: {
      'View Channels': PermissionFlagsBits.ViewChannel,
      'Send Messages': PermissionFlagsBits.SendMessages,
      'Send Messages in Threads': PermissionFlagsBits.SendMessagesInThreads,
      'Create Public Threads': PermissionFlagsBits.CreatePublicThreads,
      'Create Private Threads': PermissionFlagsBits.CreatePrivateThreads,
      'Embed Links': PermissionFlagsBits.EmbedLinks,
      'Attach Files': PermissionFlagsBits.AttachFiles,
      'Add Reactions': PermissionFlagsBits.AddReactions,
      'Use External Emojis': PermissionFlagsBits.UseExternalEmojis,
      'Use External Stickers': PermissionFlagsBits.UseExternalStickers,
      'Mention Everyone': PermissionFlagsBits.MentionEveryone,
      'Read Message History': PermissionFlagsBits.ReadMessageHistory,
      'Send TTS Messages': PermissionFlagsBits.SendTTSMessages,
      'Use Application Commands': PermissionFlagsBits.UseApplicationCommands,
      'Create Invite': PermissionFlagsBits.CreateInstantInvite,
      'Change Nickname': PermissionFlagsBits.ChangeNickname
    },
    voice: {
      'Connect': PermissionFlagsBits.Connect,
      'Speak': PermissionFlagsBits.Speak,
      'Video': PermissionFlagsBits.Stream,
      'Use Voice Activity': PermissionFlagsBits.UseVAD,
      'Priority Speaker': PermissionFlagsBits.PrioritySpeaker
    }
  };

  // Filter out undefined permissions (in case of older Discord.js versions)
  const validPermissions = { moderator: {}, management: {}, general: {}, voice: {} };
  
  for (const [category, perms] of Object.entries(permissions)) {
    for (const [name, bit] of Object.entries(perms)) {
      if (bit !== undefined) {
        validPermissions[category][name] = bit;
      }
    }
  }
  
  return validPermissions;
}

// Helper function to chunk permissions if they're too long
function chunkPermissions(permissions, maxLength) {
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const perm of permissions) {
    const permLength = perm.length + 4; // Account for backticks and comma/space
    if (currentLength + permLength > maxLength && currentChunk.length > 0) {
      chunks.push([...currentChunk]);
      currentChunk = [perm];
      currentLength = permLength;
    } else {
      currentChunk.push(perm);
      currentLength += permLength;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
