const { ContainerBuilder, SectionBuilder, MessageFlags } = require('discord.js');
const { colors } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'roleinfo',
  aliases: ['ri', 'role'],
  description: 'Display detailed information about a role',
  syntax: 'roleinfo <role>',
  example: 'roleinfo @Members',
  run: async (client, message, args) => {
    try {
      // Get role from mention, ID, or name
      if (!args[0]) {
        return message.reply('Please provide a role mention, ID, or name.');
      }

      let role;
      const roleId = args[0].replace(/[<>@&]/g, '');
      role = message.guild.roles.cache.get(roleId);

      if (!role) {
        // Try to find by name
        const roleName = args.join(' ');
        role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      }

      if (!role) {
        return message.reply('Role not found.');
      }

      // Calculate created timestamp
      const createdTimestamp = Math.floor(role.createdTimestamp / 1000);

      // Role members count
      const memberCount = role.members.size;

      // Role color
      const roleColor = role.hexColor;

      // Role position
      const position = role.position;

      // Permissions
      const isAdmin = role.permissions.has('Administrator');
      const isMentionable = role.mentionable;
      const isHoisted = role.hoist;

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(role.color || parseInt(colors.info.replace('#', ''), 16));

      // Title section
      container.addTextDisplayComponents(
        (text) => text.setContent(`# ${role.name}`),
        (text) => text.setContent(`-# Role information for ${message.guild.name}`)
      );

      // Created date
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`Created: <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`)
      );

      // Information section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Information**`),
        (text) => text.setContent(`> **ID**: \`${role.id}\` • **Color**: \`${roleColor}\`\n> **Members**: ${memberCount} • **Position**: ${position}\n> **Mentionable**: ${isMentionable ? 'Yes' : 'No'} • **Hoisted**: ${isHoisted ? 'Yes' : 'No'}`)
      );

      // Footer
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`-# Guild ID: ${message.guild.id}`)
      );

      // Send with Components V2 flag
      return message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      logger.webhook.error(error, message);
      throw error;
    }
  }
};
