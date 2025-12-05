const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
const config = require('../../../config/setup');

// Default messages using container system
const DEFAULT_THANKYOU_MESSAGE = `{container}$v{message: {user.mention}}$v{text: thank you for bumping **{guild.name}**:nextline: please bump again {bumpreminder.next_bump} }`;
const DEFAULT_REMINDER_MESSAGE = `{container}$v{message: {bumpreminder.last_user_bump}}$v{text: it's been **2 hours** since the last bump, could you /bump the server?}`;

module.exports = {
  name: 'bumpreminder',
  aliases: ['bprm'],
  description: 'Set up automatic bump reminders for Disboard',
  syntax: 'bumpreminder [subcommand] (parameters)',
  example: 'bumpreminder lock',
  permission: 'manage_guild',
  isGroupCommand: true,

  subcommands: {
    lock: {
      name: 'lock',
      aliases: ['disable', 'off'],
      description: 'Disable the bump reminder system',
      syntax: '{guildprefix}bumpreminder lock',
      parameters: [],
      example: '{guildprefix}bumpreminder lock',

      handler: async (client, message, args, guildService) => {
        const bumpReminder = await guildService.getBumpReminder(message.guild.id);
        
        if (!bumpReminder.enabled) {
          return embeds.warn(message, 'Bump reminder system is already **disabled**');
        }

        await guildService.updateBumpReminder(message.guild.id, { enabled: false });
        return embeds.success(message, 'Disabled bumpreminder system - use `;bumpreminder unlock` to enable');
      }
    },

    unlock: {
      name: 'unlock',
      aliases: ['enable', 'on'],
      description: 'Enable the bump reminder system',
      syntax: '{guildprefix}bumpreminder unlock',
      parameters: [],
      example: '{guildprefix}bumpreminder unlock',

      handler: async (client, message, args, guildService) => {
        const bumpReminder = await guildService.getBumpReminder(message.guild.id);
        
        if (bumpReminder.enabled) {
          return embeds.warn(message, 'Bump reminder system is already **enabled**');
        }

        await guildService.updateBumpReminder(message.guild.id, { enabled: true });
        return embeds.success(message, 'Enabled bumpreminder system - use `;bumpreminder lock` to disable');
      }
    },

    channel: {
      name: 'channel',
      aliases: ['ch'],
      description: 'Set the channel for bump reminders',
      syntax: '{guildprefix}bumpreminder channel [#channel]',
      parameters: ['channel'],
      example: '{guildprefix}bumpreminder channel #bumps',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'bumpreminder');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.deny(message, channelResult.error);
        }

        const channel = channelResult.channel;
        await guildService.updateBumpReminder(message.guild.id, { channelId: channel.id });
        return embeds.success(message, `Set bump reminder channel to ${channel}`);
      }
    },

    thankyou: {
      name: 'thankyou',
      aliases: ['thanks', 'ty'],
      description: 'Set or view the thank you message sent after a bump',
      syntax: '{guildprefix}bumpreminder thankyou [message/view]',
      parameters: ['message or view'],
      example: '{guildprefix}bumpreminder thankyou view',

      handler: async (client, message, args, guildService) => {
        const input = args.join(' ').trim();
        
        if (!input) return runHelpCommand(message, 'bumpreminder');

        // Check if viewing
        if (input.toLowerCase() === 'view') {
          const bumpReminder = await guildService.getBumpReminder(message.guild.id);
          const thankYouMessage = bumpReminder.thankYouMessage || DEFAULT_THANKYOU_MESSAGE;
          
          // Calculate next bump timestamp (2 hours from now for preview)
          const nextBumpTimestamp = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);
          
          // Process and send preview
          EmbedVariableProcessor.process(message.channel, thankYouMessage, {
            user: message.author,
            guild: message.guild,
            channel: message.channel,
            bumpreminder: {
              last_user_bump: `<@${message.author.id}>`,
              next_bump: `<t:${nextBumpTimestamp}:R>`
            }
          }, message);
          return;
        }

        // Setting new message
        await guildService.updateBumpReminder(message.guild.id, { thankYouMessage: input });
        return embeds.success(message, 'Updated the **thank you** message for bump reminders');
      }
    },

    message: {
      name: 'message',
      aliases: ['msg', 'reminder'],
      description: 'Set or view the reminder message sent after 2 hours',
      syntax: '{guildprefix}bumpreminder message [message/view]',
      parameters: ['message or view'],
      example: '{guildprefix}bumpreminder message view',

      handler: async (client, message, args, guildService) => {
        const input = args.join(' ').trim();
        
        if (!input) return runHelpCommand(message, 'bumpreminder');

        // Check if viewing
        if (input.toLowerCase() === 'view') {
          const bumpReminder = await guildService.getBumpReminder(message.guild.id);
          const reminderMessage = bumpReminder.reminderMessage || DEFAULT_REMINDER_MESSAGE;
          
          // Process and send preview
          EmbedVariableProcessor.process(message.channel, reminderMessage, {
            user: message.author,
            guild: message.guild,
            channel: message.channel,
            bumpreminder: {
              last_user_bump: `<@${message.author.id}>`,
              next_bump: `<t:${Math.floor(Date.now() / 1000)}:R>`
            }
          }, message);
          return;
        }

        // Setting new message
        await guildService.updateBumpReminder(message.guild.id, { reminderMessage: input });
        return embeds.success(message, 'Updated the **reminder** message for bump reminders');
      }
    },

    config: {
      name: 'config',
      aliases: ['settings', 'status'],
      description: 'View current bump reminder configuration',
      syntax: '{guildprefix}bumpreminder config',
      parameters: [],
      example: '{guildprefix}bumpreminder config',

      handler: async (client, message, args, guildService) => {
        const bumpReminder = await guildService.getBumpReminder(message.guild.id);
        
        const status = bumpReminder.enabled ? '`Enabled`' : '`Disabled`';
        const channel = bumpReminder.channelId 
          ? `<#${bumpReminder.channelId}>` 
          : '`Not set`';
        const lastBumper = bumpReminder.lastBumperId 
          ? `<@${bumpReminder.lastBumperId}>` 
          : '`None`';
        const lastBump = bumpReminder.lastBumpTime 
          ? `<t:${Math.floor(bumpReminder.lastBumpTime / 1000)}:R>` 
          : '`Never`';
        const nextBump = bumpReminder.lastBumpTime 
          ? `<t:${Math.floor((bumpReminder.lastBumpTime + 2 * 60 * 60 * 1000) / 1000)}:R>` 
          : '`N/A`';
        const thankYouMsg = bumpReminder.thankYouMessage ? '`Custom`' : '`Default`';
        const reminderMsg = bumpReminder.reminderMessage ? '`Custom`' : '`Default`';

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setAuthor({
            name: 'Bump Reminder Configuration',
            iconURL: message.guild.iconURL({ dynamic: true })
          })
          .setDescription(
            `**Status:** ${status}\n` +
            `**Channel:** ${channel}\n` +
            `**Last Bumper:** ${lastBumper}\n` +
            `**Last Bump:** ${lastBump}\n` +
            `**Next Bump:** ${nextBump}\n` +
            `**Thank You Message:** ${thankYouMsg}\n` +
            `**Reminder Message:** ${reminderMsg}`
          )
          .setFooter({ text: 'Use ;bumpreminder thankyou view or ;bumpreminder message view to preview messages' });

        return message.channel.send({ embeds: [embed] });
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset bump reminder to default settings',
      syntax: '{guildprefix}bumpreminder reset',
      parameters: [],
      example: '{guildprefix}bumpreminder reset',

      handler: async (client, message, args, guildService) => {
        await guildService.updateBumpReminder(message.guild.id, {
          thankYouMessage: null,
          reminderMessage: null
        });
        return embeds.success(message, 'Reset bump reminder messages to **default**');
      }
    },

    variables: {
      name: 'variables',
      aliases: ['vars'],
      description: 'Shows available variables for bump reminder messages',
      syntax: '{guildprefix}bumpreminder variables',
      parameters: [],
      example: '{guildprefix}bumpreminder variables',

      handler: async (client, message, args, guildService) => {
        const nextBumpTimestamp = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);
        
        const embed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle('Bump Reminder Variables')
          .setDescription(
            `**Bump Reminder Specific:**\n` +
            `\`{bumpreminder.last_user_bump}\` — <@${message.author.id}>\n` +
            `\`{bumpreminder.next_bump}\` — <t:${nextBumpTimestamp}:R>\n\n` +
            `**User Variables:**\n` +
            `\`{user.mention}\` — <@${message.author.id}>\n` +
            `\`{user.name}\` — ${message.author.username}\n` +
            `\`{user.id}\` — ${message.author.id}\n\n` +
            `**Server Variables:**\n` +
            `\`{guild.name}\` — ${message.guild.name}\n` +
            `\`{guild.count}\` — ${message.guild.memberCount}\n` +
            `\`{guild.icon}\` — Server icon URL`
          );

        return message.channel.send({ embeds: [embed] });
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Server')) return;
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'bumpreminder');

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'bumpreminder');
  }
};

// Export default messages for use in event handler
module.exports.DEFAULT_THANKYOU_MESSAGE = DEFAULT_THANKYOU_MESSAGE;
module.exports.DEFAULT_REMINDER_MESSAGE = DEFAULT_REMINDER_MESSAGE;
