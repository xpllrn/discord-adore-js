const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const config = require('../../config/setup');
const { findRole } = require('../../handlers/finder');

module.exports = {
  name: "settings",
  aliases: [],
  description: `View and manage server settings`,
  permission: 'Manage Server',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (args[0] === 'config') {
      const subcommandInfo = {
        description: 'View all server configuration settings',
        usage: '{guildprefix}settings config',
        aliases: [],
        parameters: [],
        example: '{guildprefix}settings config'
      };

      const guildData = await guildService.ensureGuildData(message.guild.id);

      // Get prefix
      const prefix = guildData.Prefix || ',';

      // Check modules status
      const antinukeEnabled = guildData.Antinuke?.enabled || false;
      const starboardEnabled = guildData.StarboardChannel ? true : false;
      const reactionRolesCount = guildData.ReactionRoles?.length || 0;
      const buttonRolesCount = guildData.ButtonRoles?.length || 0;
      const levelSystemEnabled = guildData.LevelSystem?.enabled || false;
      const ticketSystemEnabled = guildData.TicketSystem?.enabled || false;
      const voiceManagerEnabled = guildData.VoiceManager?.enabled || false;

      // Get counts
      const welcomeMessagesCount = guildData.WelcomeMessages?.length || 0;
      const goodbyeMessagesCount = guildData.LeaveMessages?.length || 0;
      const boostMessagesCount = guildData.BoostMessages?.length || 0;
      const autoRolesCount = guildData.AutoRoles?.length || 0;
      const autoReactCount = guildData.AutoReact?.length || 0;
      const autoResponderCount = guildData.AutoResponder?.length || 0;

      // Get channels and roles
      const jailRole = guildData.JailRoleID ? `<@&${guildData.JailRoleID}>` : 'N/A';
      const jailChannel = guildData.JailChannelID ? `<#${guildData.JailChannelID}>` : 'N/A';
      const starboardChannel = guildData.StarboardChannel ? `<#${guildData.StarboardChannel}>` : 'N/A';
      const baseRole = guildData.BoosterRoleSystem?.baseRoleId ? `<@&${guildData.BoosterRoleSystem.baseRoleId}>` : 'N/A';
      const levelUpChannel = guildData.LevelSystem?.levelUpChannel ? `<#${guildData.LevelSystem.levelUpChannel}>` : 'N/A';
      const ticketCategory = guildData.TicketSystem?.categoryId ? `<#${guildData.TicketSystem.categoryId}>` : 'N/A';
      const supportRole = guildData.TicketSystem?.supportRoleId ? `<@&${guildData.TicketSystem.supportRoleId}>` : 'N/A';

      // Get jail message
      const jailMessage = guildData.JailMessage || 'N/A';

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setAuthor({ 
          name: message.author.username, 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        })
        .setDescription(`**${message.guild.name} Settings**`)
        .addFields(
          {
            name: 'Prefix',
            value: `Prefix for your server is \'${prefix}\``,
            inline: false
          },
          {
            name: 'Modules',
            value: [
              `Antinuke: ${antinukeEnabled ? config.emojis.success : config.emojis.error}`,
              `Starboard: ${starboardEnabled ? config.emojis.success : config.emojis.error}`,
              `Reaction Roles: ${reactionRolesCount > 0 ? config.emojis.success : config.emojis.error}`,
              `Button Roles: ${buttonRolesCount > 0 ? config.emojis.success : config.emojis.error}`,
              `Level System: ${levelSystemEnabled ? config.emojis.success : config.emojis.error}`,
              `Ticket System: ${ticketSystemEnabled ? config.emojis.success : config.emojis.error}`,
              `Voice Manager: ${voiceManagerEnabled ? config.emojis.success : config.emojis.error}`
            ].join('\n'),
            inline: true
          },
          {
            name: 'General',
            value: [
              `Jail Message: ${jailMessage.length > 30 ? jailMessage.substring(0, 30) + '...' : jailMessage}`,
              `Welcome Messages: ${welcomeMessagesCount}`,
              `Goodbye Messages: ${goodbyeMessagesCount}`,
              `Boost Messages: ${boostMessagesCount}`,
              `Auto Roles: ${autoRolesCount}`,
              `Auto React: ${autoReactCount}`,
              `Auto Responder: ${autoResponderCount}`
            ].join('\n'),
            inline: true
          },
          {
            name: 'Channels & Roles',
            value: [
              `Jail Role: ${jailRole}`,
              `Jail Channel: ${jailChannel}`,
              `Starboard: ${starboardChannel}`,
              `Base Role: ${baseRole}`,
              `Level Up Channel: ${levelUpChannel}`,
              `Ticket Category: ${ticketCategory}`,
              `Support Role: ${supportRole}`
            ].join('\n'),
            inline: true
          }
        )
        .setFooter({ text: `Guild ID: ${message.guild.id}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'baserole') {
      const subcommandInfo = {
        description: 'set base role for booster role positioning',
        usage: '{guildprefix}settings baserole [@role]',
        aliases: [],
        parameters: ['role'],
        example: '{guildprefix}settings baserole @Booster'
      };

      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(message, 'You need **Manage Server** permission to use this command');
      }

      if (!args[1]) {
        // Show current base role
        const baseRoleId = await guildService.getBoosterRoleBaseRole(message.guild.id);
        if (!baseRoleId) {
          return embeds.info(message, 'No base role is currently set for the booster role system');
        }

        const baseRole = message.guild.roles.cache.get(baseRoleId);
        if (!baseRole) {
          // Base role was deleted, disable system
          await guildService.setBoosterRoleBaseRole(message.guild.id, null);
          return embeds.warn(message, 'The base role was deleted. Booster role system has been disabled.');
        }

        return embeds.info(message, `Current base role: ${baseRole}\n\nAll booster roles will be positioned below this role.`);
      }

      // Find the role
      const roleResult = message.mentions.roles.first() ?
        { found: true, role: message.mentions.roles.first() } :
        findRole(message.guild, args.slice(1).join(' '));

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Check if role is manageable by bot
      if (role.position >= message.guild.members.me.roles.highest.position) {
        return embeds.deny(message, `I cannot manage ${role} because it's higher than or equal to my highest role`);
      }

      // Set the base role
      await guildService.setBoosterRoleBaseRole(message.guild.id, role.id);

      return embeds.success(message, `Set ${role} as the **Base role**`);

    } else {
      return false;
    }
  }
}
