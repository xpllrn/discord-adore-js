const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors } = require('../../config/setup');
const { getService } = require('@services');

module.exports = {
  name: 'antinuke',
  aliases: ['an'],
  description: 'Antinuke protection system',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const antinukeService = getService('antinuke');
    const guildService = getService('guild');

    // Check permissions - only server owner or antinuke admins can use
    const isOwner = message.guild.ownerId === message.author.id;
    const isAdmin = await antinukeService.isAdmin(message.guild.id, message.author.id);

    if (!isOwner && !isAdmin) {
      return embeds.deny(message, 'Only the **server owner** or **antinuke admins** can use this command');
    }

    if (!args[0]) {
      const { runHelpCommand } = require('../../utils/commandProcessor');
      return runHelpCommand(message, 'antinuke');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'whitelist': {
        const subcommandInfo = {
          description: 'Whitelist a member or bot from triggering antinuke',
          usage: '{guildprefix}antinuke whitelist [@user|@bot]',
          aliases: [],
          example: '{guildprefix}antinuke whitelist @user'
        };
        return handleWhitelist(message, args, antinukeService);
      }
      
      case 'role': {
        const subcommandInfo = {
          description: 'Prevent mass role delete',
          usage: '{guildprefix}antinuke role <on|off> [--threshold 1-10] [--do strip|kick|ban]',
          aliases: [],
          example: '{guildprefix}antinuke role on --threshold 5 --do kick'
        };
        return handleModuleToggle(message, args, antinukeService, 'role');
      }
      
      case 'kick': {
        const subcommandInfo = {
          description: 'Prevent mass member kick',
          usage: '{guildprefix}antinuke kick <on|off> [--threshold 1-10] [--do strip|kick|ban]',
          aliases: [],
          example: '{guildprefix}antinuke kick on --threshold 3 --do ban'
        };
        return handleModuleToggle(message, args, antinukeService, 'kick');
      }
      
      case 'ban': {
        const subcommandInfo = {
          description: 'Prevent mass member ban',
          usage: '{guildprefix}antinuke ban <on|off> [--threshold 1-10] [--do strip|kick|ban]',
          aliases: [],
          example: '{guildprefix}antinuke ban on --threshold 3 --do ban'
        };
        return handleModuleToggle(message, args, antinukeService, 'ban');
      }
      
      case 'channel': {
        const subcommandInfo = {
          description: 'Prevent mass channel create and delete',
          usage: '{guildprefix}antinuke channel <on|off> [--threshold 1-10] [--do strip|kick|ban]',
          aliases: [],
          example: '{guildprefix}antinuke channel on --threshold 5 --do kick'
        };
        return handleModuleToggle(message, args, antinukeService, 'channel');
      }
      
      case 'webhook': {
        const subcommandInfo = {
          description: 'Prevent mass webhook creation',
          usage: '{guildprefix}antinuke webhook <on|off> [--threshold 1-10] [--do strip|kick|ban]',
          aliases: [],
          example: '{guildprefix}antinuke webhook on --threshold 3 --do ban'
        };
        return handleModuleToggle(message, args, antinukeService, 'webhook');
      }
      
      case 'botadd': {
        const subcommandInfo = {
          description: 'Prevent new bot additions',
          usage: '{guildprefix}antinuke botadd <on|off> [--do strip|kick|ban]',
          aliases: [],
          example: '{guildprefix}antinuke botadd on --do ban'
        };
        return handleModuleToggle(message, args, antinukeService, 'botadd');
      }
      
      case 'config': {
        const subcommandInfo = {
          description: 'View server configuration for Antinuke',
          usage: '{guildprefix}antinuke config',
          aliases: [],
          example: '{guildprefix}antinuke config'
        };
        return handleConfig(message, antinukeService);
      }
      
      case 'permissions': {
        const subcommandInfo = {
          description: 'Watch dangerous permissions (auto-watches 9 permissions)',
          usage: '{guildprefix}antinuke permissions <on|off> [--do strip|kick|ban]',
          aliases: [],
          example: '{guildprefix}antinuke permissions on --do kick'
        };
        return handlePermissions(message, args, antinukeService);
      }
      
      case 'list': {
        const subcommandInfo = {
          description: 'View all whitelisted members & bots',
          usage: '{guildprefix}antinuke list',
          aliases: [],
          example: '{guildprefix}antinuke list'
        };
        return handleList(message, antinukeService);
      }
      
      case 'admin': {
        const subcommandInfo = {
          description: 'Give a user permissions to edit antinuke settings',
          usage: '{guildprefix}antinuke admin [@user]',
          aliases: [],
          example: '{guildprefix}antinuke admin @user'
        };
        return handleAdmin(message, args, antinukeService, isOwner);
      }
      
      case 'admins': {
        const subcommandInfo = {
          description: 'View all antinuke admins',
          usage: '{guildprefix}antinuke admins',
          aliases: [],
          example: '{guildprefix}antinuke admins'
        };
        return handleAdmins(message, antinukeService);
      }
      
      default: {
        const { runHelpCommand } = require('../../utils/commandProcessor');
        return runHelpCommand(message, 'antinuke');
      }
    }
  }
};

async function handleWhitelist(message, args, antinukeService) {
  const target = message.mentions.users.first() || message.mentions.members.first()?.user;
  
  if (!target) {
    return embeds.warn(message, 'Please mention a user or bot to whitelist: `,antinuke whitelist @user`');
  }

  const type = target.bot ? 'bot' : 'user';
  const success = await antinukeService.addToWhitelist(
    message.guild.id,
    target.id,
    type,
    message.author.id
  );

  if (success) {
    await antinukeService.logAction(
      message.guild.id,
      'whitelist_add',
      message.author.id,
      `Added ${target.tag} to whitelist`
    );
    return embeds.success(message, `Added **${target.tag}** to the antinuke whitelist`);
  } else {
    return embeds.warn(message, `**${target.tag}** is already whitelisted`);
  }
}

async function handleModuleToggle(message, args, antinukeService, moduleName) {
  const action = args[1]?.toLowerCase();
  
  if (!action || !['on', 'off'].includes(action)) {
    return embeds.warn(message, `Please specify \`on\` or \`off\`: \`,antinuke ${moduleName} on --threshold 5 --do kick\``);
  }

  const enabled = action === 'on';

  // Parse optional parameters
  const options = {};
  
  // Check for --threshold parameter
  const thresholdIndex = args.findIndex(arg => arg === '--threshold');
  if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
    const threshold = parseInt(args[thresholdIndex + 1]);
    if (threshold >= 1 && threshold <= 10) {
      options.threshold = threshold;
    } else {
      return embeds.warn(message, 'Threshold must be between 1 and 10');
    }
  }

  // Check for --do parameter (punishment type)
  const doIndex = args.findIndex(arg => arg === '--do');
  if (doIndex !== -1 && args[doIndex + 1]) {
    const punishment = args[doIndex + 1].toLowerCase();
    if (['strip', 'kick', 'ban'].includes(punishment)) {
      options.punishment = punishment;
    } else {
      return embeds.warn(message, 'Punishment must be `strip`, `kick`, or `ban`');
    }
  }

  const success = await antinukeService.toggleModule(message.guild.id, moduleName, enabled, options);

  if (success) {
    // Build response message
    let responseMsg = `${enabled ? 'Enabled' : 'Disabled'} **${moduleName}** protection`;
    
    if (enabled) {
      const settings = await antinukeService.getSettings(message.guild.id);
      const module = settings.modules[moduleName];
      
      const details = [];
      if (module.limit !== undefined) {
        details.push(`Threshold: ${module.limit}`);
      }
      if (module.punishment) {
        details.push(`Punishment: ${module.punishment}`);
      }
      
      if (details.length > 0) {
        responseMsg += `\n> ${details.join(' | ')}`;
      }
    }

    await antinukeService.logAction(
      message.guild.id,
      `module_${enabled ? 'enable' : 'disable'}`,
      message.author.id,
      `${enabled ? 'Enabled' : 'Disabled'} ${moduleName} protection`
    );

    // Enable antinuke system if not already enabled
    const settings = await antinukeService.getSettings(message.guild.id);
    if (!settings.enabled && enabled) {
      const guildService = getService('guild');
      const guildData = await guildService.ensureGuildData(message.guild.id);
      guildData.Antinuke.enabled = true;
      await guildService.set(message.guild.id, guildData);
    }

    return embeds.success(message, responseMsg);
  } else {
    return embeds.deny(message, `Failed to toggle ${moduleName} protection`);
  }
}

async function handleConfig(message, antinukeService) {
  const { emojis } = require('../../config/setup');
  const settings = await antinukeService.getSettings(message.guild.id);

  const formatModule = (module) => {
    if (!module.enabled) return emojis.error;
    const parts = [emojis.success];
    if (module.limit !== undefined) parts.push(`Limit: ${module.limit}`);
    if (module.punishment) parts.push(`Do: ${module.punishment}`);
    return parts.join(' | ');
  };

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setAuthor({ 
      name: `${message.guild.name} Antinuke Configuration`,
      iconURL: message.guild.iconURL({ dynamic: true })
    })
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setDescription(`**Status:** ${settings.enabled ? `${emojis.success} Enabled` : `${emojis.error} Disabled`}`)
    .addFields([
      {
        name: '**Protection Modules**',
        value: [
          `**Role Delete:** ${formatModule(settings.modules.role)}`,
          `**Member Kick:** ${formatModule(settings.modules.kick)}`,
          `**Member Ban:** ${formatModule(settings.modules.ban)}`,
          `**Channel Actions:** ${formatModule(settings.modules.channel)}`,
          `**Webhook Creation:** ${formatModule(settings.modules.webhook)}`,
          `**Bot Addition:** ${settings.modules.botadd.enabled ? `${emojis.success} | Do: ${settings.modules.botadd.punishment}` : emojis.error}`,
          `**Permissions:** ${settings.modules.permissions.enabled ? `${emojis.success} | Do: ${settings.modules.permissions.punishment}` : emojis.error}`
        ].join('\n'),
        inline: false
      },
      {
        name: '**Watched Permissions**',
        value: settings.modules.permissions.watched.length > 0
          ? settings.modules.permissions.watched.map(p => `\`${p}\``).join(', ')
          : 'None (auto-watches when enabled)',
        inline: false
      },
      {
        name: '**Statistics**',
        value: [
          `Whitelisted: **${settings.whitelist.length}**`,
          `Admins: **${settings.admins.length}**`
        ].join('\n'),
        inline: false
      }
    ])
    .setFooter({ 
      text: `Requested by ${message.author.tag}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  return message.channel.send({ embeds: [embed] });
}

async function handlePermissions(message, args, antinukeService) {
  const action = args[1]?.toLowerCase();

  // If no action specified, show current watched permissions or enable with defaults
  if (!action) {
    const settings = await antinukeService.getSettings(message.guild.id);
    
    if (!settings.modules.permissions.enabled) {
      return embeds.warn(message, 'Permission monitoring is not enabled. Use `,antinuke permissions on` to enable with default permissions.');
    }

    const watched = settings.modules.permissions.watched;
    if (watched.length === 0) {
      return embeds.warn(message, 'No permissions are being watched');
    }

    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setAuthor({ 
        name: `${message.guild.name} Watched Permissions`,
        iconURL: message.guild.iconURL({ dynamic: true })
      })
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setDescription(watched.map(p => `\`${p}\``).join(', '))
      .addFields({
        name: '**Punishment**',
        value: settings.modules.permissions.punishment,
        inline: true
      })
      .setFooter({ 
        text: `Requested by ${message.author.tag}`,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // Handle on/off
  if (action === 'on' || action === 'off') {
    const enabled = action === 'on';
    
    // Parse optional --do parameter
    let punishment = 'strip';
    const doIndex = args.findIndex(arg => arg === '--do');
    if (doIndex !== -1 && args[doIndex + 1]) {
      const punishmentArg = args[doIndex + 1].toLowerCase();
      if (['strip', 'kick', 'ban'].includes(punishmentArg)) {
        punishment = punishmentArg;
      }
    }

    const guildService = getService('guild');
    const guildData = await guildService.ensureGuildData(message.guild.id);
    
    if (!guildData.Antinuke) {
      guildData.Antinuke = antinukeService.getDefaultSettings();
    }

    guildData.Antinuke.modules.permissions.enabled = enabled;
    guildData.Antinuke.modules.permissions.punishment = punishment;

    // Auto-add default permissions when enabling
    if (enabled && guildData.Antinuke.modules.permissions.watched.length === 0) {
      guildData.Antinuke.modules.permissions.watched = [
        'Administrator',
        'BanMembers',
        'KickMembers',
        'ModerateMembers',
        'MentionEveryone',
        'ManageGuild',
        'ManageChannels',
        'ManageRoles',
        'ManageWebhooks'
      ];
    }

    await guildService.set(message.guild.id, guildData);

    // Enable antinuke system if not already enabled
    if (!guildData.Antinuke.enabled && enabled) {
      guildData.Antinuke.enabled = true;
      await guildService.set(message.guild.id, guildData);
    }

    await antinukeService.logAction(
      message.guild.id,
      `permissions_${enabled ? 'enable' : 'disable'}`,
      message.author.id,
      `${enabled ? 'Enabled' : 'Disabled'} permission monitoring`
    );

    if (enabled) {
      const watched = guildData.Antinuke.modules.permissions.watched;
      return embeds.success(
        message,
        `Enabled permission monitoring with punishment: **${punishment}**\n> Watching: ${watched.map(p => `\`${p}\``).join(', ')}`
      );
    } else {
      return embeds.success(message, 'Disabled permission monitoring');
    }
  }

  // Handle grant/remove for individual permissions
  const permission = args[2];

  if (!['grant', 'remove'].includes(action)) {
    return embeds.warn(message, 'Please specify `on`, `off`, `grant`, or `remove`: `,antinuke permissions on --do kick`');
  }

  if (!permission) {
    return embeds.warn(message, 'Please specify a permission name: `,antinuke permissions grant Administrator`');
  }

  const validPermissions = [
    'Administrator',
    'BanMembers',
    'KickMembers',
    'ModerateMembers',
    'MentionEveryone',
    'ManageGuild',
    'ManageChannels',
    'ManageRoles',
    'ManageWebhooks'
  ];

  if (!validPermissions.includes(permission)) {
    return embeds.warn(message, `Invalid permission. Valid permissions:\n${validPermissions.map(p => `\`${p}\``).join(', ')}`);
  }

  let success;
  if (action === 'grant') {
    success = await antinukeService.addWatchedPermission(message.guild.id, permission);
    if (success) {
      await antinukeService.logAction(
        message.guild.id,
        'permission_watch_add',
        message.author.id,
        `Added ${permission} to watched permissions`
      );
      return embeds.success(message, `Now watching **${permission}** permission changes`);
    } else {
      return embeds.warn(message, `**${permission}** is already being watched`);
    }
  } else {
    success = await antinukeService.removeWatchedPermission(message.guild.id, permission);
    if (success) {
      await antinukeService.logAction(
        message.guild.id,
        'permission_watch_remove',
        message.author.id,
        `Removed ${permission} from watched permissions`
      );
      return embeds.success(message, `Stopped watching **${permission}** permission changes`);
    } else {
      return embeds.warn(message, `**${permission}** is not being watched`);
    }
  }
}

async function handleList(message, antinukeService) {
  const whitelist = await antinukeService.getWhitelist(message.guild.id);

  if (whitelist.length === 0) {
    return embeds.warn(message, 'No users or bots are whitelisted');
  }

  const users = whitelist.filter(w => w.type === 'user');
  const bots = whitelist.filter(w => w.type === 'bot');

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setAuthor({ 
      name: `${message.guild.name} Antinuke Whitelist`,
      iconURL: message.guild.iconURL({ dynamic: true })
    })
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setDescription(`**Total:** ${whitelist.length} (${users.length} users, ${bots.length} bots)`);

  if (users.length > 0) {
    embed.addFields({
      name: '**Whitelisted Users**',
      value: users.map(w => `<@${w.id}>`).join(', '),
      inline: false
    });
  }

  if (bots.length > 0) {
    embed.addFields({
      name: '**Whitelisted Bots**',
      value: bots.map(w => `<@${w.id}>`).join(', '),
      inline: false
    });
  }

  embed.setFooter({ 
    text: `Requested by ${message.author.tag}`,
    iconURL: message.author.displayAvatarURL({ dynamic: true })
  })
  .setTimestamp();

  return message.channel.send({ embeds: [embed] });
}

async function handleAdmin(message, args, antinukeService, isOwner) {
  if (!isOwner) {
    return embeds.deny(message, 'Only the server owner can add antinuke admins');
  }

  const target = message.mentions.users.first();
  
  if (!target) {
    return embeds.warn(message, 'Please mention a user to add as admin: `,antinuke admin @user`');
  }

  if (target.bot) {
    return embeds.warn(message, 'You cannot add bots as antinuke admins');
  }

  const success = await antinukeService.addAdmin(
    message.guild.id,
    target.id,
    message.author.id
  );

  if (success) {
    await antinukeService.logAction(
      message.guild.id,
      'admin_add',
      message.author.id,
      `Added ${target.tag} as antinuke admin`
    );
    return embeds.success(message, `Added **${target.tag}** as an antinuke admin`);
  } else {
    return embeds.warn(message, `**${target.tag}** is already an antinuke admin`);
  }
}

async function handleAdmins(message, antinukeService) {
  const admins = await antinukeService.getAdmins(message.guild.id);

  if (admins.length === 0) {
    return embeds.warn(message, 'No antinuke admins have been added');
  }

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setAuthor({ 
      name: `${message.guild.name} Antinuke Admins`,
      iconURL: message.guild.iconURL({ dynamic: true })
    })
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setDescription(`**Total:** ${admins.length}`)
    .addFields({
      name: '**Admins**',
      value: admins.map(a => `<@${a.userId}>`).join(', '),
      inline: false
    })
    .setFooter({ 
      text: `Requested by ${message.author.tag}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  return message.channel.send({ embeds: [embed] });
}
