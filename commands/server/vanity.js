const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { checkBotRoleHierarchy } = require('../../utils/permissions');
const { EmbedVariableProcessor } = require('../../utils/embedbuilder');
const config = require('../../config/setup');
const { findRole, findChannel } = require('../../handlers/finder');
const { getService } = require('@services');

module.exports = {
  name: "vanity",
  aliases: ['rep'],
  description: `add vanity role to someone for reppin your server in their custom status`,
  permission: "Manage Guild",
  isGroupCommand: true,
  run: async(client, message, args) => {

    // Show help if no subcommand provided
    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'set') {
      const subcommandInfo = {
        name: 'set',
        description: 'Set the vanity text that users need in their status',
        usage: '{guildprefix}vanity set [text]',
        aliases: [],
        parameters: ['text'],
        example: '{guildprefix}vanity set MyServer'
      };

      if (!args[1]) return false;

      if (args[1] === 'none' || args[1] === 'off') {
        if (!globaldata.Vanity) {
          return embeds.warn(message, 'No vanity exists to reset');
        }

        globaldata.Vanity = null;
        await globaldata.save();
        return embeds.success(message, 'Vanity has been reset');
      } else {
        const vanitytext = args.slice(1).join(' ');
        globaldata.Vanity = vanitytext;
        await globaldata.save();
        return embeds.success(message, `Set **${vanitytext}** as the vanity`);
      }

    } else if (args[0] === 'role') {
      const subcommandInfo = {
        name: 'role',
        description: 'Set the role given to users who rep the server',
        usage: '{guildprefix}vanity role [@role]',
        aliases: [],
        parameters: ['role'],
        example: '{guildprefix}vanity role @Rep Role'
      };

      if (!args[1]) return false;

      if (args[1] === 'none' || args[1] === 'clear') {
        if (globaldata.VanityRoles.length === 0) {
          return embeds.warn(message, 'No vanity role exists to clear');
        }

        globaldata.VanityRoles = [];
        await globaldata.save();
        return embeds.success(message, 'Vanity role has been cleared');
      } else {
        // Use role finder for role detection
        const roleName = args.slice(1).join(' ');
        const roleResult = message.mentions.roles.first() ?
          { found: true, role: message.mentions.roles.first() } :
          findRole(message.guild, roleName);

        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }

        const role = roleResult.role;

        // Check if bot can manage this role
        if (!checkBotRoleHierarchy(message, role)) {
          return;
        }

        // Additional check: ensure role is below bot's highest role
        const botHighestRole = message.guild.members.me.roles.highest;
        if (role.position >= botHighestRole.position) {
          return embeds.warn(message,
            `I cannot manage **${role.name}** because it's above my highest role (**${botHighestRole.name}**). ` +
            `Please move my role above **${role.name}** or choose a lower role.`
          );
        }

        if (globaldata.VanityRoles.includes(role.id)) {
          return embeds.warn(message, `**${role.name}** is already the vanity role`);
        }

        // Replace any existing vanity role with the new one
        globaldata.VanityRoles = [role.id];
        await globaldata.save();
        return embeds.success(message, `**${role.name}** is now the vanity role`);
      }

    } else if (args[0] === 'add') {
      const subcommandInfo = {
        name: 'add',
        description: 'Add a vanity message to be sent when someone reps',
        usage: '{guildprefix}vanity add [#channel] [message]',
        aliases: [],
        parameters: ['channel', 'message'],
        example: '{guildprefix}vanity add #general Thanks for repping {user.mention}!'
      };

      const channelInput = args[1];
      const vanitymessage = args.slice(2).join(' ');

      if (!channelInput || !vanitymessage) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const vanitychannel = channelResult.channel;

      // No validation needed - just save the message as-is
      // The EmbedVariableProcessor will handle any syntax issues when the message is actually sent

      // Check if this is an update or new addition
      const isUpdate = globaldata.VanityLogChannel && globaldata.VanityMessage;

      try {

        // Update both database and cache
        globaldata.VanityLogChannel = vanitychannel.id;
        globaldata.VanityMessage = vanitymessage;
        await globaldata.save();

        // Update cache to ensure sync
        await guildService.setVanityMessage(message.guild.id, vanitychannel.id, vanitymessage);

        const action = isUpdate ? 'Updated the' : 'Created a';
        return embeds.success(message, `${action} **vanity message** for ${vanitychannel}`);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, `Failed to set vanity message: ${error.message}`);
      }

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        name: 'remove',
        description: 'Remove the vanity message for a channel',
        usage: '{guildprefix}vanity remove [#channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}vanity remove #general'
      };

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const vanitychannel = channelResult.channel;

      if (!globaldata.VanityLogChannel || globaldata.VanityLogChannel !== vanitychannel.id) {
        return embeds.warn(message, `No **vanity message** exists for ${vanitychannel}`);
      }

      try {
        // Update both database and cache
        globaldata.VanityLogChannel = null;
        globaldata.VanityMessage = null;
        await globaldata.save();

        // Update cache to ensure sync
        await guildService.removeVanityMessage(message.guild.id);

        return embeds.success(message, `Removed the **vanity message** for ${vanitychannel}`);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, `Failed to remove vanity message: ${error.message}`);
      }

    } else if (args[0] === 'view') {
      const subcommandInfo = {
        name: 'view',
        description: 'Preview the vanity message for a channel',
        usage: '{guildprefix}vanity view [#channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}vanity view #general'
      };

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const vanitychannel = channelResult.channel;

      if (!globaldata.VanityLogChannel || globaldata.VanityLogChannel !== vanitychannel.id || !globaldata.VanityMessage) {
        return embeds.warn(message, `No **vanity message** to preview for ${vanitychannel}`);
      }

      // Use EmbedVariableProcessor to handle the vanity message with variables
      EmbedVariableProcessor.process(message.channel, globaldata.VanityMessage, {
        user: message.author,
        guild: message.guild,
        channel: vanitychannel,
        vanity: globaldata.Vanity || 'example',
        roles: 'Example Role',
        source: 'custom status'
      });

    } else if (args[0] === 'variables') {
      const subcommandInfo = {
        name: 'variables',
        description: 'Show available variables for vanity messages',
        usage: '{guildprefix}vanity variables',
        aliases: [],
        parameters: [],
        example: '{guildprefix}vanity variables'
      };

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Vanity Message Variables')
        .setDescription(`**User Variables:**\n\`{user.mention}\` — ${message.member}\n\`{user.name}\` — ${message.author.username}\n\`{user.tag}\` — ${message.author.tag}\n\`{user.id}\` — ${message.author.id}\n\n**Server Variables:**\n\`{guild.name}\` — ${message.guild.name}\n\`{guild.count}\` — ${message.guild.memberCount}\n\n**Vanity Variables:**\n\`{vanity}\` — The vanity text that was detected\n\`{roles}\` — The roles that were given\n\`{source}\` — Always "custom status"`);

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'check') {
      const subcommandInfo = {
        name: 'check',
        description: 'Check current vanity configuration',
        usage: '{guildprefix}vanity check',
        aliases: [],
        parameters: [],
        example: '{guildprefix}vanity check'
      };

      // Format vanity display
      const vanityDisplay = globaldata.Vanity || '`none`';

      // Format role display (single role)
      let roleDisplay = '';
      if (globaldata.VanityRoles && globaldata.VanityRoles.length > 0) {
        roleDisplay = `<@&${globaldata.VanityRoles[0]}>`;
      } else {
        roleDisplay = '`none`';
      }

      // Check if vanity is disabled
      const vanityDisabledInfo = await guildService.getVanityDisabledInfo(message.guild.id);

      // Add status information
      const isConfigured = globaldata.Vanity && globaldata.VanityRoles && globaldata.VanityRoles.length > 0;
      let statusDisplay;
      let embedColor;

      if (vanityDisabledInfo.disabled) {
        statusDisplay = `${config.emojis.error} **DISABLED**\n> ${vanityDisabledInfo.reason}`;
        embedColor = config.colors.error;
      } else if (isConfigured) {
        statusDisplay = `${config.emojis.success} **Active**`;
        embedColor = config.colors.success;
      } else {
        statusDisplay = `${config.emojis.error} **Inactive**`;
        embedColor = config.colors.error;
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .addFields(
          { name: '**Status**', value: `> ${statusDisplay}`, inline: vanityDisabledInfo.disabled ? false : true },
          { name: '**Vanity**', value: `> ${vanityDisplay}`, inline: true },
          { name: '**Role**', value: `> ${roleDisplay}`, inline: true }
        );

      // Add message info if configured
      if (globaldata.VanityLogChannel && globaldata.VanityMessage) {
        const vanitychannel = message.guild.channels.cache.get(globaldata.VanityLogChannel);
        if (vanitychannel) {
          embed.addFields(
            { name: '**Channel**', value: `> ${vanitychannel}`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }, // Empty field for spacing
            { name: '**Message**', value: globaldata.VanityMessage.length > 1014 ? '```msg\n' + globaldata.VanityMessage.substring(0, 1011) + '...```' : '```msg\n' + globaldata.VanityMessage + '```', inline: false }
          );
        }
      }

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'enable') {
      const subcommandInfo = {
        name: 'enable',
        description: 'Re-enable the vanity system if it was disabled',
        usage: '{guildprefix}vanity enable',
        aliases: [],
        parameters: [],
        example: '{guildprefix}vanity enable'
      };

      // Check if vanity is currently disabled
      const vanityDisabledInfo = await guildService.getVanityDisabledInfo(message.guild.id);
      if (!vanityDisabledInfo.disabled) {
        return embeds.warn(message, 'Vanity system is not disabled');
      }

      // Check if the issues that caused the disable have been resolved
      if (!message.guild.members.me.permissions.has('ManageRoles')) {
        return embeds.warn(message, 'Cannot re-enable vanity: Bot still missing **Manage Roles** permission');
      }

      // Check if vanity roles are still above bot's hierarchy
      if (globaldata.VanityRoles && globaldata.VanityRoles.length > 0) {
        const botHighestRole = message.guild.members.me.roles.highest;
        const invalidRoles = [];

        for (const roleId of globaldata.VanityRoles) {
          const role = message.guild.roles.cache.get(roleId);
          if (role && role.position >= botHighestRole.position) {
            invalidRoles.push(role.name);
          }
        }

        if (invalidRoles.length > 0) {
          return embeds.warn(message,
            `Cannot re-enable vanity: These roles are still above my highest role:\n` +
            `**${invalidRoles.join(', ')}**\n\n` +
            `Please move my role above these roles or remove them from vanity roles.`
          );
        }
      }

      // Re-enable vanity
      await guildService.enableVanity(message.guild.id);
      return embeds.success(message,
        `Successfully **re-enabled** the vanity system!\n\n` +
        `**Previous disable reason:** ${vanityDisabledInfo.reason}`
      );

    } else {
      // Invalid subcommand - show help
      return false;
    }
  }
}
