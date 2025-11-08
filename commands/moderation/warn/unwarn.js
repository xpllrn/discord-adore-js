const { checkSelfAction, checkBotAction } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');

module.exports = {
  name: "unwarn",
  description: `remove a warning from a user's moderation history`,
  syntax: 'unwarn (user) (case_id) (reason)',
  example: 'unwarn @vwsn 5 mistake',
  permission: 'Manage Messages',
  run: async(client, message, args) => {
    const moderationService = getService('moderation');

    // Check if user provided input
    if (!args[0] || !args[1]) {
      return runHelpCommand(message, 'unwarn');
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const user = userResult.user;
    const caseId = parseInt(args[1]);
    
    // Validate case ID
    if (isNaN(caseId)) {
      return embeds.deny(message, 'Please provide a valid case ID number');
    }

    let reason = args.slice(2).join(" ");
    if (!reason) reason = 'reasons';

    // Self-action check (can't unwarn yourself)
    if (!checkSelfAction(message, user.user, 'unwarn')) return;

    // Bot-action check
    if (!checkBotAction(message, user.user)) return;

    try {
      // Get the specific moderation case
      const moderationCase = await moderationService.getModerationCase(message.guild.id, caseId);
      
      if (!moderationCase) {
        return embeds.deny(message, `Case #${caseId} not found`);
      }

      // Check if the case belongs to the specified user
      if (moderationCase.userId !== user.user.id) {
        return embeds.deny(message, `Case #${caseId} does not belong to **${user.user.username}**`);
      }

      // Check if the case is actually a warning
      if (moderationCase.action !== 'warn') {
        return embeds.deny(message, `Case #${caseId} is not a warning (it's a ${moderationCase.action})`);
      }

      // Remove the warning case from the database
      await moderationService.removeModerationCase(message.guild.id, caseId);

      // Add an unwarn entry to the moderation history
      await moderationService.addModerationCase(
        message.guild.id,
        user.user.id,
        message.author.id,
        'unwarn',
        `Removed warning case #${caseId}: ${reason}`
      );

      // Send success message
      embeds.success(message, `**Warning case #${caseId}** has been removed from **${user.user.username}** for ${reason}`);

    } catch (error) {
      logger.webhook.error(error, message);
      embeds.deny(message, `An error occurred while removing the warning`);
    }
  }
};
