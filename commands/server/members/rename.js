const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "rename",
  aliases: ['nick'],
  description: `change a member's nickname`,
  syntax: 'rename (user) <nickname>',
  example: 'rename @vwsn NewName',
  run: async(client, message, args) => {

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      return embeds.deny(message, 'I need **Manage Nicknames** permission to use this command');
    }

    // Check if user provided input
    if (!args[0]) {
      return runHelpCommand(message, 'rename');
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.warn(message, userResult.error);
    }

    // For rename, we need a guild member, not a global user
    if (userResult.isGlobal) {
      return embeds.warn(message, 'User is not in this server');
    }

    const member = userResult.user;

    let nickname = args.slice(1).join(" ");

    if (!nickname) {
      nickname = null;
    }

    // Check if user is trying to rename themselves
    const isSelf = member.id === message.author.id;

    if (isSelf) {
      // Renaming self - check for ChangeNickname permission
      if (!hasDiscordPermission(message, PermissionFlagsBits.ChangeNickname, 'Change Nickname')) return;
    } else {
      // Renaming others - check for ManageNicknames permission
      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageNicknames, 'Manage Nicknames')) return;
      
      if (!checkBotAction(message, member)) return;

      // Hierarchy checks (only for renaming others)
      if (!checkUserMemberHierarchy(message, member)) return;
      if (!checkBotMemberHierarchy(message, member)) return;
    }

    try {
      await member.setNickname(nickname, `Renamed by ${message.author.tag}`);

      if (nickname) {
        embeds.success(message, `**${member.user.tag}** has been renamed to **${nickname}**`);
      } else {
        embeds.success(message, `**${member.user.tag}**'s nickname has been reset`);
      }

    } catch (error) {
      logger.both.error(error, message);
      return embeds.warn(message, 'An error occurred while trying to rename this user.');
    }
  }
}
