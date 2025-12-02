const { ContainerBuilder, MessageFlags } = require('discord.js');
const { colors } = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');
const { embeds } = require('../../../core/embeds');
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
        return embeds.warn(message, 'Please provide a role mention, ID, or name.');
      }

      const roleInput = args.join(' ');
      const roleResult = findRole(message.guild, roleInput);

      if (!roleResult.found) {
        return embeds.warn(message, roleResult.error);
      }

      const role = roleResult.role;

      // Calculate created timestamp
      const createdTimestamp = Math.floor(role.createdTimestamp / 1000);

      // Role members count
      const memberCount = role.members.size;

      // Role color
      const roleColor = role.hexColor;

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
(text) => text.setContent(`> **Role ID**: \`${role.id}\`\n> **Members**: ${memberCount} • **Color**: \`${roleColor}\``)
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
