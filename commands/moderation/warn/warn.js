const { checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');

module.exports = {
  name: "warn",
  description: `warn a user and add it to their moderation history`,
  usage: '{guildprefix}warn [user]\n{guildprefix}warn [user] [reason]\n{guildprefix}warn list [user]',
  permission: 'Manage Messages',
  run: async(client, message, args) => {
    const moderationService = getService('moderation');

    if (!args[0]) {
      return runHelpCommand(message, 'warn');
    }

    // Handle 'warn list' subcommand
    if (args[0].toLowerCase() === 'list') {
      if (!args[1]) {
        return runHelpCommand(message, 'warn');
      }

      // Use the history command to show warn-specific history
      const historyCommand = client.commands.get('history');
      if (historyCommand) {
        return historyCommand.run(client, message, [args[1], 'warn']);
      } else {
        return embeds.deny(message, 'History command not found. Please contact an administrator.');
      }
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const warnedMember = userResult.user;
    let reason = args.slice(1).join(" ");
    if (!reason) reason = 'reasons';

    // Self-action check
    if (!checkSelfAction(message, warnedMember.user, 'warn')) return;

    // Bot-action check
    if (!checkBotAction(message, warnedMember.user)) return;

    // Hierarchy checks
    if (!checkUserMemberHierarchy(message, warnedMember)) return;
    if (!checkBotMemberHierarchy(message, warnedMember)) return;

    try {
      // Add moderation case to database
      const moderationCase = await moderationService.addModerationCase(
        message.guild.id,
        warnedMember.user.id,
        message.author.id,
        'warn',
        reason
      );

      // Send success message
      embeds.success(message, `**${warnedMember.user.username}** has been **warned** for ${reason}`);

      // Log the warn action
      await logModerationAction('warn', message.author, warnedMember.user, reason, message.guild, moderationCase.caseId);

    } catch (error) {
      embeds.deny(message, `An error occurred while warning **${warnedMember.user.username}**`);
    }
  }
};

async function logModerationAction(action, executor, target, reason, guild, caseNumber = null) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: executor,
      target: target,
      reason: reason,
      caseNumber: caseNumber,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Send error to webhook instead of console
    if (guild.client?.errorLogger) {
      guild.client.errorLogger.log(error, 'Moderation Action Logging', {
        command: `${action} logging`,
        args: `Target: ${target?.tag || 'Unknown'}, Reason: ${reason}`,
        user: executor,
        guild: guild
      });
    }
  }
}
