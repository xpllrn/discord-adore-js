const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { createPagination } = require('../../../core/buttons');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');

module.exports = {
  name: "inrole",
  aliases: ['members', 'rolemembers'],
  description: `get a list of users in a specific role`,
  usage: '{guildprefix}inrole [role]',
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'inrole');
    }

    // Use universal role finder
    const roleResult = findRole(message.guild, args.join(' '));

    if (!roleResult.found) {
      return embeds.deny(message, roleResult.error);
    }

    const role = roleResult.role;

    let members = message.guild.members.cache.filter(member => {
      return member.roles.cache.has(role.id);
    }).map(member => {
      return member.user;
    })

    if (members.length < 1) return embeds.warn(message, `**${role.name}** has no members in the role`);

    // Format page function for pagination
    const formatPage = (pageMembers, currentPage, totalPages) => {
      const startIndex = (currentPage - 1) * 10;

      const memberList = pageMembers.map((member, index) => {
        const memberNumber = (startIndex + index + 1).toString().padStart(2, '0');
        return `\`${memberNumber}\` **${member.username}** (\`${member.id}\`)`;
      }).join('\n');

      return new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle(`Members in ${role.name}`)
        .setDescription(memberList)
        .setFooter({ text: `${role.members.size} members • Page ${currentPage}/${totalPages}` });
    };

    // Use pagination system
    await createPagination(message, members, formatPage, 10, `${role.name} Members`);
  }
}