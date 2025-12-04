const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors, emojis } = require('../../../config/setup');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'antinuke',
  aliases: ['an'],
  description: 'Antinuke protection system',
  syntax: 'antinuke [subcommand] (parameters)',
  example: 'antinuke role on --threshold 5 --do kick',
  isGroupCommand: true,

  subcommands: {
    whitelist: {
      name: 'whitelist',
      aliases: [],
      description: 'Whitelist a member or bot from triggering antinuke',
      syntax: '{guildprefix}antinuke whitelist [user]',
      parameters: ['user'],
      example: '{guildprefix}antinuke whitelist @user',

      handler: async (client, message, args, antinukeService) => {
        let target = message.mentions.users.first() || message.mentions.members.first()?.user;
        let userId = null;
        
        if (!target && args[0]) {
          userId = args[0].replace(/[<@!>]/g, '');
          
          if (/^\d{17,19}$/.test(userId)) {
            try {
              target = await message.client.users.fetch(userId).catch(() => null);
            } catch (error) {}
          }
        }
        
        if (!target && !userId) {
          return embeds.warn(message, 'Please mention a user or bot, or provide their ID: `,antinuke whitelist @user` or `,antinuke whitelist 123456789`');
        }

        const finalId = target ? target.id : userId;
        const type = target?.bot ? 'bot' : 'user';
        const displayName = target ? target.tag : `User ID: ${userId}`;
        
        const success = await antinukeService.addToWhitelist(
          message.guild.id,
          finalId,
          type,
          message.author.id
        );

        if (success) {
          await antinukeService.logAction(
            message.guild.id,
            'whitelist_add',
            message.author.id,
            `Added ${displayName} to whitelist`
          );
          return embeds.success(message, `Added **${displayName}** to the antinuke whitelist`);
        } else {
          return embeds.warn(message, `**${displayName}** is already whitelisted`);
        }
      }
    },

    role: {
      name: 'role',
      aliases: [],
      description: 'Prevent mass role delete',
      syntax: '{guildprefix}antinuke role [state] (threshold) (punishment)',
      parameters: ['state', 'threshold (optional)', 'punishment (optional)'],
      example: '{guildprefix}antinuke role on --threshold 5 --do kick',

      handler: async (client, message, args, antinukeService) => {
        return handleModuleToggle(message, args, antinukeService, 'role');
      }
    },

    kick: {
      name: 'kick',
      aliases: [],
      description: 'Prevent mass member kick',
      syntax: '{guildprefix}antinuke kick [state] (threshold) (punishment)',
      parameters: ['state', 'threshold (optional)', 'punishment (optional)'],
      example: '{guildprefix}antinuke kick on --threshold 3 --do ban',

      handler: async (client, message, args, antinukeService) => {
        return handleModuleToggle(message, args, antinukeService, 'kick');
      }
    },

    ban: {
      name: 'ban',
      aliases: [],
      description: 'Prevent mass member ban',
      syntax: '{guildprefix}antinuke ban [state] (threshold) (punishment)',
      parameters: ['state', 'threshold (optional)', 'punishment (optional)'],
      example: '{guildprefix}antinuke ban on --threshold 3 --do ban',

      handler: async (client, message, args, antinukeService) => {
        return handleModuleToggle(message, args, antinukeService, 'ban');
      }
    },

    channel: {
      name: 'channel',
      aliases: [],
      description: 'Prevent mass channel create and delete',
      syntax: '{guildprefix}antinuke channel [state] (threshold) (punishment)',
      parameters: ['state', 'threshold (optional)', 'punishment (optional)'],
      example: '{guildprefix}antinuke channel on --threshold 5 --do kick',

      handler: async (client, message, args, antinukeService) => {
        return handleModuleToggle(message, args, antinukeService, 'channel');
      }
    },

    webhook: {
      name: 'webhook',
      aliases: [],
      description: 'Prevent mass webhook creation',
      syntax: '{guildprefix}antinuke webhook [state] (threshold) (punishment)',
      parameters: ['state', 'threshold (optional)', 'punishment (optional)'],
      example: '{guildprefix}antinuke webhook on --threshold 3 --do ban',

      handler: async (client, message, args, antinukeService) => {
        return handleModuleToggle(message, args, antinukeService, 'webhook');
      }
    },

    botadd: {
      name: 'botadd',
      aliases: [],
      description: 'Prevent new bot additions',
      syntax: '{guildprefix}antinuke botadd [state] (punishment)',
      parameters: ['state', 'punishment (optional)'],
      example: '{guildprefix}antinuke botadd on --do ban',

      handler: async (client, message, args, antinukeService) => {
        return handleModuleToggle(message, args, antinukeService, 'botadd');
      }
    },

    config: {
      name: 'config',
      aliases: [],
      description: 'View server configuration for Antinuke',
      syntax: '{guildprefix}antinuke config',
      parameters: [],
      example: '{guildprefix}antinuke config',

      handler: async (client, message, args, antinukeService) => {
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
    },


    permissions: {
      name: 'permissions',
      aliases: [],
      description: 'Watch specific dangerous permissions',
      syntax: '{guildprefix}antinuke permissions [permission] (punishment)',
      parameters: ['permission', 'punishment (optional)'],
      example: '{guildprefix}antinuke permissions administrator --do kick',

      handler: async (client, message, args, antinukeService) => {
        const permissionArg = args[0]?.toLowerCase();

        if (!permissionArg) {
          const settings = await antinukeService.getSettings(message.guild.id);
          
          const watched = settings.modules.permissions.watched;
          if (watched.length === 0) {
            return embeds.warn(message, 'No permissions are being watched. Use `,antinuke permissions <permission>` to add one.');
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
              value: settings.modules.permissions.punishment || 'strip',
              inline: true
            })
            .setFooter({ 
              text: `Requested by ${message.author.tag}`,
              iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

          return message.channel.send({ embeds: [embed] });
        }

        const permissionMap = {
          'administrator': 'Administrator',
          'admin': 'Administrator',
          'ban_members': 'BanMembers',
          'banmembers': 'BanMembers',
          'ban': 'BanMembers',
          'kick_members': 'KickMembers',
          'kickmembers': 'KickMembers',
          'kick': 'KickMembers',
          'moderate_members': 'ModerateMembers',
          'moderatembers': 'ModerateMembers',
          'timeout': 'ModerateMembers',
          'mention_everyone': 'MentionEveryone',
          'mentioneveryone': 'MentionEveryone',
          'mention': 'MentionEveryone',
          'manage_guild': 'ManageGuild',
          'manageguild': 'ManageGuild',
          'manageserver': 'ManageGuild',
          'manage_channels': 'ManageChannels',
          'managechannels': 'ManageChannels',
          'channels': 'ManageChannels',
          'manage_roles': 'ManageRoles',
          'manageroles': 'ManageRoles',
          'roles': 'ManageRoles',
          'view_audit_log': 'ViewAuditLog',
          'viewauditlog': 'ViewAuditLog',
          'auditlog': 'ViewAuditLog',
          'manage_webhooks': 'ManageWebhooks',
          'managewebhooks': 'ManageWebhooks',
          'webhooks': 'ManageWebhooks',
          'manage_expressions': 'ManageGuildExpressions',
          'manageexpressions': 'ManageGuildExpressions',
          'manageguildexpressions': 'ManageGuildExpressions',
          'expressions': 'ManageGuildExpressions',
          'emojis': 'ManageGuildExpressions',
          'manage_nicknames': 'ManageNicknames',
          'managenicknames': 'ManageNicknames',
          'nicknames': 'ManageNicknames'
        };

        const validPermissions = [
          'Administrator', 'BanMembers', 'KickMembers', 'ModerateMembers',
          'MentionEveryone', 'ManageGuild', 'ManageChannels', 'ManageRoles',
          'ViewAuditLog', 'ManageWebhooks', 'ManageGuildExpressions', 'ManageNicknames'
        ];

        const permission = permissionMap[permissionArg] || permissionArg.charAt(0).toUpperCase() + permissionArg.slice(1);

        if (!validPermissions.includes(permission)) {
          return embeds.warn(
            message, 
            `Invalid permission. Valid permissions:\n${validPermissions.map(p => `\`${p}\``).join(', ')}`
          );
        }

        let punishment = null;
        const doIndex = args.findIndex(arg => arg === '--do');
        if (doIndex !== -1 && args[doIndex + 1]) {
          const punishmentArg = args[doIndex + 1].toLowerCase();
          if (['strip', 'kick', 'ban'].includes(punishmentArg)) {
            punishment = punishmentArg;
          } else {
            return embeds.warn(message, 'Punishment must be `strip`, `kick`, or `ban`');
          }
        }

        const guildService = getService('guild');
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.Antinuke) {
          guildData.Antinuke = antinukeService.getDefaultSettings();
        }

        if (!guildData.Antinuke.modules.permissions) {
          guildData.Antinuke.modules.permissions = {
            enabled: false,
            watched: [],
            punishment: 'strip'
          };
        }

        const watched = guildData.Antinuke.modules.permissions.watched || [];
        const isWatched = watched.includes(permission);

        if (isWatched) {
          guildData.Antinuke.modules.permissions.watched = watched.filter(p => p !== permission);
          
          if (guildData.Antinuke.modules.permissions.watched.length === 0) {
            guildData.Antinuke.modules.permissions.enabled = false;
          }

          await guildService.set(message.guild.id, guildData);

          await antinukeService.logAction(
            message.guild.id,
            'permission_watch_remove',
            message.author.id,
            `Removed ${permission} from watched permissions`
          );

          return embeds.success(message, `Stopped watching **${permission}** permission changes`);
        } else {
          guildData.Antinuke.modules.permissions.watched.push(permission);
          guildData.Antinuke.modules.permissions.enabled = true;

          if (punishment) {
            guildData.Antinuke.modules.permissions.punishment = punishment;
          } else if (!guildData.Antinuke.modules.permissions.punishment) {
            guildData.Antinuke.modules.permissions.punishment = 'strip';
          }

          if (!guildData.Antinuke.enabled) {
            guildData.Antinuke.enabled = true;
          }

          await guildService.set(message.guild.id, guildData);

          await antinukeService.logAction(
            message.guild.id,
            'permission_watch_add',
            message.author.id,
            `Added ${permission} to watched permissions`
          );

          const punishmentText = punishment || guildData.Antinuke.modules.permissions.punishment;
          return embeds.success(
            message, 
            `Now watching **${permission}** permission changes\n> Punishment: **${punishmentText}**`
          );
        }
      }
    },

    view: {
      name: 'view',
      aliases: [],
      description: 'View all whitelisted members & bots',
      syntax: '{guildprefix}antinuke view',
      parameters: [],
      example: '{guildprefix}antinuke view',

      handler: async (client, message, args, antinukeService) => {
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
    },

    admin: {
      name: 'admin',
      aliases: [],
      description: 'Give a user permissions to edit antinuke settings',
      syntax: '{guildprefix}antinuke admin [user]',
      parameters: ['user'],
      example: '{guildprefix}antinuke admin @user',

      handler: async (client, message, args, antinukeService, isOwner) => {
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
    },

    admins: {
      name: 'admins',
      aliases: [],
      description: 'View all antinuke admins',
      syntax: '{guildprefix}antinuke admins',
      parameters: [],
      example: '{guildprefix}antinuke admins',

      handler: async (client, message, args, antinukeService) => {
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
    }
  },

  run: async (client, message, args) => {
    try {
      const antinukeService = getService('antinuke');

      const isOwner = message.guild.ownerId === message.author.id;
      const isAdmin = await antinukeService.isAdmin(message.guild.id, message.author.id);

      if (!isOwner && !isAdmin) {
        return embeds.deny(message, 'Only the **server owner** or **antinuke admins** can use this command');
      }

      if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(message, 'You need **Manage Guild** permission to use this command');
      }

      const sub = args[0]?.toLowerCase();
      if (!sub) {
        return runHelpCommand(message, 'antinuke');
      }

      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), antinukeService, isOwner);
      }

      return runHelpCommand(message, 'antinuke');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};

async function handleModuleToggle(message, args, antinukeService, moduleName) {
  const action = args[0]?.toLowerCase();
  
  if (!action || !['on', 'off'].includes(action)) {
    return embeds.warn(message, `Please specify \`on\` or \`off\`: \`,antinuke ${moduleName} on --threshold 5 --do kick\``);
  }

  const enabled = action === 'on';
  const options = {};
  
  const thresholdIndex = args.findIndex(arg => arg === '--threshold');
  if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
    const threshold = parseInt(args[thresholdIndex + 1]);
    if (threshold >= 1 && threshold <= 10) {
      options.threshold = threshold;
    } else {
      return embeds.warn(message, 'Threshold must be between 1 and 10');
    }
  }

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
