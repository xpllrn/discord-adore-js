const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'fakepermissions',
  aliases: ['fakeperms', 'fp'],
  description: 'Restrict moderators to only use bot commands for moderation',
  syntax: 'fakepermissions [subcommand] [parameters]',
  example: 'fakepermissions add @Moderator ban_members',
  isGroupCommand: true,
  run: async (client, message, args) => {
    try {
      const guildService = getService('guild');

    // Check permissions - only server owner can use
    const isOwner = message.guild.ownerId === message.author.id;

    if (!isOwner) {
      return embeds.deny(message, 'Only the **server owner** can use this command');
    }

    if (!args[0]) {
      const { runHelpCommand } = require('../../../utils/commandProcessor');
      return runHelpCommand(message, 'fakepermissions');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'add': {
        const subcommandInfo = {
          description: 'Add fake permissions to a role',
          syntax: '{guildprefix}fakepermissions add [role] [permissions]',
          aliases: [],
          example: '{guildprefix}fakepermissions add @Moderator ban_members'
        };
        return handleAdd(message, args, guildService);
      }

      case 'remove': {
        const subcommandInfo = {
          description: 'Remove fake permissions from a role',
          syntax: '{guildprefix}fakepermissions remove [role] [permissions]',
          aliases: [],
          example: '{guildprefix}fakepermissions remove @Moderator ban_members'
        };
        return handleRemove(message, args, guildService);
      }

      case 'list': {
        const subcommandInfo = {
          description: 'View fake permissions for a role',
          syntax: '{guildprefix}fakepermissions list [role]',
          aliases: [],
          example: '{guildprefix}fakepermissions list @Moderator'
        };
        return handleList(message, args, guildService);
      }

      case 'reset': {
        const subcommandInfo = {
          description: 'Reset all fake permissions',
          syntax: '{guildprefix}fakepermissions reset',
          aliases: [],
          example: '{guildprefix}fakepermissions reset'
        };
        return handleReset(message, guildService);
      }

      default: {
        const { runHelpCommand } = require('../../../utils/commandProcessor');
        return runHelpCommand(message, 'fakepermissions');
      }
    }
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};

async function handleAdd(message, args, guildService) {
  // Get role from mention or ID
  const roleArg = args[1];
  if (!roleArg) {
    return embeds.warn(message, 'Please specify a role: `,fakepermissions add @Moderator ban_members`');
  }

  const role = message.mentions.roles.first() || 
                message.guild.roles.cache.get(roleArg) ||
                message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());

  if (!role) {
    return embeds.warn(message, 'Role not found. Please mention a role or provide a valid role ID/name.');
  }

  // Get permissions from remaining args
  const permissionArgs = args.slice(2);
  if (permissionArgs.length === 0) {
    return embeds.warn(message, 'Please specify at least one permission: `,fakepermissions add @Moderator ban_members kick_members`');
  }

  // Map of permission aliases to proper names
  const permissionMap = {
    'administrator': 'administrator',
    'admin': 'administrator',
    'ban_members': 'ban_members',
    'banmembers': 'ban_members',
    'ban': 'ban_members',
    'kick_members': 'kick_members',
    'kickmembers': 'kick_members',
    'kick': 'kick_members',
    'moderate_members': 'moderate_members',
    'moderatemembers': 'moderate_members',
    'timeout': 'moderate_members',
    'manage_guild': 'manage_guild',
    'manageguild': 'manage_guild',
    'manageserver': 'manage_guild',
    'manage_channels': 'manage_channels',
    'managechannels': 'manage_channels',
    'channels': 'manage_channels',
    'manage_roles': 'manage_roles',
    'manageroles': 'manage_roles',
    'roles': 'manage_roles',
    'manage_webhooks': 'manage_webhooks',
    'managewebhooks': 'manage_webhooks',
    'webhooks': 'manage_webhooks',
    'manage_expressions': 'manage_expressions',
    'manageexpressions': 'manage_expressions',
    'manageguildexpressions': 'manage_expressions',
    'expressions': 'manage_expressions',
    'emojis': 'manage_expressions',
    'manage_nicknames': 'manage_nicknames',
    'managenicknames': 'manage_nicknames',
    'nicknames': 'manage_nicknames',
    'change_nickname': 'change_nickname',
    'changenickname': 'change_nickname',
    'manage_messages': 'manage_messages',
    'managemessages': 'manage_messages',
    'messages': 'manage_messages'
  };

  const validPermissions = [
    'administrator',
    'ban_members',
    'kick_members',
    'manage_channels',
    'manage_expressions',
    'manage_guild',
    'manage_messages',
    'manage_roles',
    'manage_webhooks',
    'moderate_members',
    'change_nickname',
    'manage_nicknames'
  ];

  // Parse and validate permissions
  const permissions = [];
  const invalidPerms = [];

  for (const permArg of permissionArgs) {
    const perm = permissionMap[permArg.toLowerCase()] || 
                 permArg.charAt(0).toUpperCase() + permArg.slice(1);
    
    if (validPermissions.includes(perm)) {
      permissions.push(perm);
    } else {
      invalidPerms.push(permArg);
    }
  }

  if (invalidPerms.length > 0) {
    return embeds.warn(
      message,
      `Invalid permissions: ${invalidPerms.map(p => `\`${p}\``).join(', ')}\n\nValid permissions:\n${validPermissions.map(p => `\`${p}\``).join(', ')}`
    );
  }

  if (permissions.length === 0) {
    return embeds.warn(message, 'No valid permissions provided');
  }

  // Get current fake permissions
  const guildData = await guildService.ensureGuildData(message.guild.id);
  if (!guildData.FakePermissions) {
    guildData.FakePermissions = {};
  }

  if (!guildData.FakePermissions[role.id]) {
    guildData.FakePermissions[role.id] = {
      roleId: role.id,
      roleName: role.name,
      permissions: []
    };
  }

  // Add new permissions (avoid duplicates)
  const existingPerms = guildData.FakePermissions[role.id].permissions || [];
  const newPerms = permissions.filter(p => !existingPerms.includes(p));
  const alreadyAdded = permissions.filter(p => existingPerms.includes(p));

  if (newPerms.length === 0) {
    return embeds.warn(
      message,
      `All specified permissions are already added to **${role.name}**:\n${alreadyAdded.map(p => `\`${p}\``).join(', ')}`
    );
  }

  guildData.FakePermissions[role.id].permissions = [...existingPerms, ...newPerms];
  guildData.FakePermissions[role.id].roleName = role.name; // Update role name in case it changed

  await guildService.set(message.guild.id, guildData);

  let responseMsg = `Added fake permissions to **${role.name}**:\n${newPerms.map(p => `\`${p}\``).join(', ')}`;
  
  if (alreadyAdded.length > 0) {
    responseMsg += `\n\n> Already added: ${alreadyAdded.map(p => `\`${p}\``).join(', ')}`;
  }

  responseMsg += '\n\n-# Members with this role can now use bot commands for these permissions, but cannot use native Discord features.';

  return embeds.success(message, responseMsg);
}

async function handleRemove(message, args, guildService) {
  // Get role from mention or ID
  const roleArg = args[1];
  if (!roleArg) {
    return embeds.warn(message, 'Please specify a role: `,fakepermissions remove @Moderator ban_members`');
  }

  const role = message.mentions.roles.first() || 
                message.guild.roles.cache.get(roleArg) ||
                message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());

  if (!role) {
    return embeds.warn(message, 'Role not found. Please mention a role or provide a valid role ID/name.');
  }

  // Get permissions from remaining args
  const permissionArgs = args.slice(2);
  if (permissionArgs.length === 0) {
    return embeds.warn(message, 'Please specify at least one permission: `,fakepermissions remove @Moderator ban_members`');
  }

  // Map of permission aliases to proper names
  const permissionMap = {
    'administrator': 'administrator',
    'admin': 'administrator',
    'ban_members': 'ban_members',
    'banmembers': 'ban_members',
    'ban': 'ban_members',
    'kick_members': 'kick_members',
    'kickmembers': 'kick_members',
    'kick': 'kick_members',
    'moderate_members': 'moderate_members',
    'moderatemembers': 'moderate_members',
    'timeout': 'moderate_members',
    'manage_guild': 'manage_guild',
    'manageguild': 'manage_guild',
    'manageserver': 'manage_guild',
    'manage_channels': 'manage_channels',
    'managechannels': 'manage_channels',
    'channels': 'manage_channels',
    'manage_roles': 'manage_roles',
    'manageroles': 'manage_roles',
    'roles': 'manage_roles',
    'manage_webhooks': 'manage_webhooks',
    'managewebhooks': 'manage_webhooks',
    'webhooks': 'manage_webhooks',
    'manage_expressions': 'manage_expressions',
    'manageexpressions': 'manage_expressions',
    'manageguildexpressions': 'manage_expressions',
    'expressions': 'manage_expressions',
    'emojis': 'manage_expressions',
    'manage_nicknames': 'manage_nicknames',
    'managenicknames': 'manage_nicknames',
    'nicknames': 'manage_nicknames',
    'change_nickname': 'change_nickname',
    'changenickname': 'change_nickname',
    'manage_messages': 'manage_messages',
    'managemessages': 'manage_messages',
    'messages': 'manage_messages'
  };

  // Parse permissions
  const permissions = permissionArgs.map(p => 
    permissionMap[p.toLowerCase()] || p.charAt(0).toUpperCase() + p.slice(1)
  );

  // Get current fake permissions
  const guildData = await guildService.ensureGuildData(message.guild.id);
  if (!guildData.FakePermissions || !guildData.FakePermissions[role.id]) {
    return embeds.warn(message, `**${role.name}** has no fake permissions configured`);
  }

  const existingPerms = guildData.FakePermissions[role.id].permissions || [];
  const toRemove = permissions.filter(p => existingPerms.includes(p));
  const notFound = permissions.filter(p => !existingPerms.includes(p));

  if (toRemove.length === 0) {
    return embeds.warn(
      message,
      `None of the specified permissions are assigned to **${role.name}**:\n${notFound.map(p => `\`${p}\``).join(', ')}`
    );
  }

  // Remove permissions
  guildData.FakePermissions[role.id].permissions = existingPerms.filter(p => !toRemove.includes(p));

  // Remove role entry if no permissions left
  if (guildData.FakePermissions[role.id].permissions.length === 0) {
    delete guildData.FakePermissions[role.id];
  }

  await guildService.set(message.guild.id, guildData);

  let responseMsg = `Removed fake permissions from **${role.name}**:\n${toRemove.map(p => `\`${p}\``).join(', ')}`;
  
  if (notFound.length > 0) {
    responseMsg += `\n\n> Not found: ${notFound.map(p => `\`${p}\``).join(', ')}`;
  }

  return embeds.success(message, responseMsg);
}

async function handleList(message, args, guildService) {
  // Get role from mention or ID
  const roleArg = args[1];
  if (!roleArg) {
    return embeds.warn(message, 'Please specify a role: `,fakepermissions list @Moderator`');
  }

  const role = message.mentions.roles.first() || 
                message.guild.roles.cache.get(roleArg) ||
                message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());

  if (!role) {
    return embeds.warn(message, 'Role not found. Please mention a role or provide a valid role ID/name.');
  }

  // Get fake permissions
  const guildData = await guildService.ensureGuildData(message.guild.id);
  if (!guildData.FakePermissions || !guildData.FakePermissions[role.id]) {
    return embeds.warn(message, `**${role.name}** has no fake permissions configured`);
  }

  const fakePerms = guildData.FakePermissions[role.id];
  const permissions = fakePerms.permissions || [];

  if (permissions.length === 0) {
    return embeds.warn(message, `**${role.name}** has no fake permissions configured`);
  }

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setAuthor({
      name: `${message.guild.name} Fake Permissions`,
      iconURL: message.guild.iconURL({ dynamic: true })
    })
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `**Role:** ${role}\n` +
      `**Permissions:** ${permissions.length}\n\n` +
      `-# Members with this role can use bot commands for these permissions, but cannot use native Discord features.`
    )
    .addFields({
      name: '**Fake Permissions**',
      value: permissions.map(p => `\`${p}\``).join(', '),
      inline: false
    })
    .setFooter({
      text: `Requested by ${message.author.tag}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  return message.channel.send({ embeds: [embed] });
}

async function handleReset(message, guildService) {
  const guildData = await guildService.ensureGuildData(message.guild.id);
  
  if (!guildData.FakePermissions || Object.keys(guildData.FakePermissions).length === 0) {
    return embeds.warn(message, 'No fake permissions are configured in this server');
  }

  const roleCount = Object.keys(guildData.FakePermissions).length;
  
  guildData.FakePermissions = {};
  await guildService.set(message.guild.id, guildData);

  return embeds.success(message, `Reset all fake permissions for **${roleCount}** role(s)`);
}
