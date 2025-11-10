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

    const subcommand = args[0].toLowerCase();

    // Route to appropriate subcommand
    switch (subcommand) {
      case 'reactionrole':
      case 'rr':
        const reactionRoleCommand = require('./roles/reactionrole');
        return reactionRoleCommand.run(client, message, args.slice(1));
      
      case 'buttonrole':
      case 'br':
        const buttonRoleCommand = require('./roles/buttonrole');
        return buttonRoleCommand.run(client, message, args.slice(1));
      
      default:
        return false;
    }
  }
}