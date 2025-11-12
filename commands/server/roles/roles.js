const { EmbedBuilder } = require('discord.js');
const { createPagination } = require('../../../core/buttons');
const { colors } = require('../../../config/setup');

module.exports = {
  name: "roles",
  description: `View all roles in the server`,
  aliases: [],
  run: async (client, message, args) => {
    
    // List all roles in the server with pagination
    const roles = message.guild.roles.cache
      .filter(role => role.id !== message.guild.id) // Exclude @everyone
      .sort((a, b) => b.position - a.position) // Sort by position (highest first)
      .map(role => role);

    if (roles.length === 0) {
      const { embeds } = require('../../../core/embeds');
      return embeds.info(message, 'This server has no roles.');
    }

    // Format page function for pagination
    const formatPage = (pageRoles, currentPage, totalPages) => {
      const description = pageRoles.map((role, index) => {
        const globalIndex = (currentPage - 1) * 10 + index + 1;
        const paddedIndex = String(globalIndex).padStart(2, '0');
        return `\`${paddedIndex}\` ${role}`;
      }).join('\n');

      return new EmbedBuilder()
        .setColor(colors.main)
        .setAuthor({ 
          name: `${message.guild.name} Roles`, 
          iconURL: message.guild.iconURL({ dynamic: true }) 
        })
        .setDescription(description)
        .setFooter({ text: `Page ${currentPage}/${totalPages} • ${roles.length} roles` });
    };

    return createPagination(message, roles, formatPage, 10, 'Server Roles');
  }
}
