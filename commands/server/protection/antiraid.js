const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors, emojis } = require('../../../config/setup');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'antiraid',
  description: 'Anti-raid protection system',
  syntax: 'antiraid [subcommand] (parameters)',
  example: 'antiraid newaccount on --threshold 7 --do ban',
  isGroupCommand: true,

  subcommands: {
    avatar: {
      name: 'avatar',
      aliases: [],
      description: 'Kick members without profile pictures',
      syntax: '{guildprefix}antiraid avatar [state] (punishment)',
      parameters: ['state', 'punishment (optional)'],
      example: '{guildprefix}antiraid avatar on --do kick',

      handler: async (client, message, args, guildService) => {
        const action = args[0]?.toLowerCase();

        if (!action || !['on', 'off'].includes(action)) {
          return embeds.warn(message, 'Please specify `on` or `off`: `,antiraid avatar on --do kick`');
        }

        const enabled = action === 'on';

        let punishment = 'kick';
        const doIndex = args.findIndex(arg => arg === '--do');
        if (doIndex !== -1 && args[doIndex + 1]) {
          const punishmentArg = args[doIndex + 1].toLowerCase();
          if (['kick', 'ban'].includes(punishmentArg)) {
            punishment = punishmentArg;
          } else {
            return embeds.warn(message, 'Punishment must be `kick` or `ban`');
          }
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.Antiraid) {
          guildData.Antiraid = {
            enabled: false,
            avatar: { enabled: false, punishment: 'kick' },
            newaccount: { enabled: false, threshold: 7, punishment: 'kick' },
            massjoin: { enabled: false, threshold: 5, punishment: 'ban', timeWindow: 30 },
            whitelist: []
          };
        }

        guildData.Antiraid.avatar.enabled = enabled;
        guildData.Antiraid.avatar.punishment = punishment;

        if (enabled && !guildData.Antiraid.enabled) {
          guildData.Antiraid.enabled = true;
        }

        await guildService.set(message.guild.id, guildData);

        if (enabled) {
          return embeds.success(
            message,
            `Enabled **avatar** protection\n> Punishment: **${punishment}**\n\n-# Members without profile pictures will be ${punishment}ed upon joining.`
          );
        } else {
          return embeds.success(message, 'Disabled **avatar** protection');
        }
      }
    },

    newaccount: {
      name: 'newaccount',
      aliases: [],
      description: 'Kick/ban new accounts',
      syntax: '{guildprefix}antiraid newaccount [state] (threshold) (punishment)',
      parameters: ['state', 'threshold (optional)', 'punishment (optional)'],
      example: '{guildprefix}antiraid newaccount on --threshold 7 --do ban',

      handler: async (client, message, args, guildService) => {
        const action = args[0]?.toLowerCase();

        if (!action || !['on', 'off'].includes(action)) {
          return embeds.warn(message, 'Please specify `on` or `off`: `,antiraid newaccount on --threshold 7 --do ban`');
        }

        const enabled = action === 'on';

        let threshold = 7;
        let punishment = 'kick';

        const thresholdIndex = args.findIndex(arg => arg === '--threshold');
        if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
          const thresholdValue = parseInt(args[thresholdIndex + 1]);
          if (thresholdValue >= 1 && thresholdValue <= 365) {
            threshold = thresholdValue;
          } else {
            return embeds.warn(message, 'Threshold must be between 1 and 365 days');
          }
        }

        const doIndex = args.findIndex(arg => arg === '--do');
        if (doIndex !== -1 && args[doIndex + 1]) {
          const punishmentArg = args[doIndex + 1].toLowerCase();
          if (['kick', 'ban'].includes(punishmentArg)) {
            punishment = punishmentArg;
          } else {
            return embeds.warn(message, 'Punishment must be `kick` or `ban`');
          }
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.Antiraid) {
          guildData.Antiraid = {
            enabled: false,
            avatar: { enabled: false, punishment: 'kick' },
            newaccount: { enabled: false, threshold: 7, punishment: 'kick' },
            massjoin: { enabled: false, threshold: 5, punishment: 'ban', timeWindow: 30 },
            whitelist: []
          };
        }

        guildData.Antiraid.newaccount.enabled = enabled;
        guildData.Antiraid.newaccount.threshold = threshold;
        guildData.Antiraid.newaccount.punishment = punishment;

        if (enabled && !guildData.Antiraid.enabled) {
          guildData.Antiraid.enabled = true;
        }

        await guildService.set(message.guild.id, guildData);

        if (enabled) {
          return embeds.success(
            message,
            `Enabled **newaccount** protection\n> Threshold: **${threshold} days**\n> Punishment: **${punishment}**\n\n-# Accounts younger than ${threshold} days will be ${punishment}ed upon joining.`
          );
        } else {
          return embeds.success(message, 'Disabled **newaccount** protection');
        }
      }
    },

    massjoin: {
      name: 'massjoin',
      aliases: [],
      description: 'Prevent mass join raids',
      syntax: '{guildprefix}antiraid massjoin [state] (threshold) (punishment)',
      parameters: ['state', 'threshold (optional)', 'punishment (optional)'],
      example: '{guildprefix}antiraid massjoin on --threshold 5 --do ban',

      handler: async (client, message, args, guildService) => {
        const action = args[0]?.toLowerCase();

        if (!action || !['on', 'off'].includes(action)) {
          return embeds.warn(message, 'Please specify `on` or `off`: `,antiraid massjoin on --threshold 5 --do ban`');
        }

        const enabled = action === 'on';

        let threshold = 5;
        let punishment = 'ban';
        const timeWindow = 30;

        const thresholdIndex = args.findIndex(arg => arg === '--threshold');
        if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
          const thresholdValue = parseInt(args[thresholdIndex + 1]);
          if (thresholdValue >= 1 && thresholdValue <= 50) {
            threshold = thresholdValue;
          } else {
            return embeds.warn(message, 'Threshold must be between 1 and 50 members');
          }
        }

        const doIndex = args.findIndex(arg => arg === '--do');
        if (doIndex !== -1 && args[doIndex + 1]) {
          const punishmentArg = args[doIndex + 1].toLowerCase();
          if (['kick', 'ban'].includes(punishmentArg)) {
            punishment = punishmentArg;
          } else {
            return embeds.warn(message, 'Punishment must be `kick` or `ban`');
          }
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.Antiraid) {
          guildData.Antiraid = {
            enabled: false,
            avatar: { enabled: false, punishment: 'kick' },
            newaccount: { enabled: false, threshold: 7, punishment: 'kick' },
            massjoin: { enabled: false, threshold: 5, punishment: 'ban', timeWindow: 30 },
            whitelist: []
          };
        }

        guildData.Antiraid.massjoin.enabled = enabled;
        guildData.Antiraid.massjoin.threshold = threshold;
        guildData.Antiraid.massjoin.punishment = punishment;
        guildData.Antiraid.massjoin.timeWindow = timeWindow;

        if (enabled && !guildData.Antiraid.enabled) {
          guildData.Antiraid.enabled = true;
        }

        await guildService.set(message.guild.id, guildData);

        if (enabled) {
          return embeds.success(
            message,
            `Enabled **massjoin** protection\n> Threshold: **${threshold} members** in **${timeWindow} seconds**\n> Punishment: **${punishment}**\n\n-# If ${threshold}+ members join within ${timeWindow} seconds, they will be ${punishment}ed.`
          );
        } else {
          return embeds.success(message, 'Disabled **massjoin** protection');
        }
      }
    },

    whitelist: {
      name: 'whitelist',
      aliases: [],
      description: 'Whitelist a member from antiraid checks',
      syntax: '{guildprefix}antiraid whitelist [user]',
      parameters: ['user'],
      example: '{guildprefix}antiraid whitelist @user',

      handler: async (client, message, args, guildService) => {
        let target = message.mentions.users.first();
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
          return embeds.warn(message, 'Please mention a user or provide their ID: `,antiraid whitelist @user` or `,antiraid whitelist 123456789`');
        }

        const finalId = target ? target.id : userId;
        const displayName = target ? target.tag : `User ID: ${userId}`;

        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.Antiraid) {
          guildData.Antiraid = {
            enabled: false,
            avatar: { enabled: false, punishment: 'kick' },
            newaccount: { enabled: false, threshold: 7, punishment: 'kick' },
            massjoin: { enabled: false, threshold: 5, punishment: 'ban', timeWindow: 30 },
            whitelist: []
          };
        }

        if (!guildData.Antiraid.whitelist) {
          guildData.Antiraid.whitelist = [];
        }

        const isWhitelisted = guildData.Antiraid.whitelist.includes(finalId);

        if (isWhitelisted) {
          guildData.Antiraid.whitelist = guildData.Antiraid.whitelist.filter(id => id !== finalId);
          await guildService.set(message.guild.id, guildData);
          return embeds.success(message, `Removed **${displayName}** from the antiraid whitelist`);
        } else {
          guildData.Antiraid.whitelist.push(finalId);
          await guildService.set(message.guild.id, guildData);
          return embeds.success(message, `Added **${displayName}** to the antiraid whitelist`);
        }
      }
    },

    view: {
      name: 'view',
      aliases: [],
      description: 'View all whitelisted members',
      syntax: '{guildprefix}antiraid view',
      parameters: [],
      example: '{guildprefix}antiraid view',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.Antiraid || !guildData.Antiraid.whitelist || guildData.Antiraid.whitelist.length === 0) {
          return embeds.warn(message, 'No users are whitelisted from antiraid checks');
        }

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setAuthor({
            name: `${message.guild.name} Antiraid Whitelist`,
            iconURL: message.guild.iconURL({ dynamic: true })
          })
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setDescription(`**Total:** ${guildData.Antiraid.whitelist.length}`)
          .addFields({
            name: '**Whitelisted Users**',
            value: guildData.Antiraid.whitelist.map(id => `<@${id}>`).join(', '),
            inline: false
          })
          .setFooter({
            text: `Requested by ${message.author.tag}`,
            iconURL: message.author.displayAvatarURL({ dynamic: true })
          })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }
    },

    config: {
      name: 'config',
      aliases: [],
      description: 'View antiraid configuration',
      syntax: '{guildprefix}antiraid config',
      parameters: [],
      example: '{guildprefix}antiraid config',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);

        if (!guildData.Antiraid) {
          guildData.Antiraid = {
            enabled: false,
            avatar: { enabled: false, punishment: 'kick' },
            newaccount: { enabled: false, threshold: 7, punishment: 'kick' },
            massjoin: { enabled: false, threshold: 5, punishment: 'ban', timeWindow: 30 },
            whitelist: []
          };
        }

        const settings = guildData.Antiraid;

        const formatModule = (module, extraInfo = '') => {
          if (!module.enabled) return emojis.error;
          const parts = [emojis.success];
          if (module.punishment) parts.push(`Do: ${module.punishment}`);
          if (extraInfo) parts.push(extraInfo);
          return parts.join(' | ');
        };

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setAuthor({
            name: `${message.guild.name} Antiraid Configuration`,
            iconURL: message.guild.iconURL({ dynamic: true })
          })
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setDescription(`**Status:** ${settings.enabled ? `**__Enabled__**` : `**__Disabled__**`}`)
          .addFields([
            {
              name: '**Protection Modules**',
              value: [
                `**Avatar Check:** ${formatModule(settings.avatar)}`,
                `**New Account Check:** ${formatModule(settings.newaccount, settings.newaccount.enabled ? `Threshold: ${settings.newaccount.threshold} days` : '')}`,
                `**Mass Join:** ${formatModule(settings.massjoin, settings.massjoin.enabled ? `Threshold: ${settings.massjoin.threshold} in ${settings.massjoin.timeWindow}s` : '')}`
              ].join('\n'),
              inline: false
            },
            {
              name: '**Statistics**',
              value: `Whitelisted: **${settings.whitelist?.length || 0}**`,
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
    }
  },

  run: async (client, message, args) => {
    try {
      const guildService = getService('guild');
      const antinukeService = getService('antinuke');

      const isOwner = message.guild.ownerId === message.author.id;
      const isAntinukeAdmin = await antinukeService.isAdmin(message.guild.id, message.author.id);

      if (!isOwner && !isAntinukeAdmin) {
        return embeds.deny(message, 'Only the **server owner** or **antinuke admins** can use this command');
      }

      if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(message, 'You need **Manage Guild** permission to use this command');
      }

      const sub = args[0]?.toLowerCase();
      if (!sub) {
        return runHelpCommand(message, 'antiraid');
      }

      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), guildService);
      }

      return runHelpCommand(message, 'antiraid');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};
