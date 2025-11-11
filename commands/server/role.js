const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasDiscordPermission } = require('../../utils/permissions');

module.exports = {
  name: "role",
  aliases: ['roles'],
  description: `Manage reaction roles and button roles`,
  permission: 'Manage Roles',
  isGroupCommand: true,
  run: async (client, message, args) => {
    
    // Check if user has manage roles permission
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles')) {
      return;
    }

    // Check if bot has manage roles permission
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return embeds.deny(message, 'I need **Manage Roles** permission to use this command!');
    }

    if (!args[0]) {
      return false;
    }

    // Route to appropriate subcommand
    if (args[0] === 'reactionrole' || args[0] === 'rr') {
      const subcommandInfo = {
        description: 'Manage reaction roles',
        usage: '{guildprefix}role reactionrole [subcommand]',
        aliases: ['rr'],
        parameters: ['subcommand'],
        example: '{guildprefix}role reactionrole add'
      };

      const reactionRoleCommand = require('./roles/reactionrole');
      return reactionRoleCommand.run(client, message, args.slice(1));
      
    } else if (args[0] === 'buttonrole' || args[0] === 'br') {
      const subcommandInfo = {
        description: 'Manage button roles',
        usage: '{guildprefix}role buttonrole [subcommand]',
        aliases: ['br'],
        parameters: ['subcommand'],
        example: '{guildprefix}role buttonrole add'
      };

      const buttonRoleCommand = require('./roles/buttonrole');
      return buttonRoleCommand.run(client, message, args.slice(1));
      
    } else {
      return false;
    }
  }
}