const { PermissionFlagsBits } = require('discord.js');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "reason",
  aliases: ['editreason', 'changereason'],
  description: `change the reason for a moderation case`,
  syntax: 'reason (caseid) [reason]',
  example: 'reason 123 updated reason',
  permission: 'manage_messages',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'reason');
    }

    try {
      let caseId;
      let newReason;

      // Check if first argument is a number (case ID)
      const firstArgAsNumber = parseInt(args[0]);
      
      if (!isNaN(firstArgAsNumber)) {
        // Case ID provided
        caseId = firstArgAsNumber;
        newReason = args.slice(1).join(' ');

        if (!newReason) {
          return embeds.warn(message, 'Please provide a new reason');
        }

        // Get the specific case
        const moderationCase = await guildService.getModerationCase(message.guild.id, caseId);

        if (!moderationCase) {
          return embeds.deny(message, `Case #${caseId} not found`);
        }

        // Update the reason
        await guildService.updateModerationCaseReason(message.guild.id, caseId, newReason);

        // React with success emote
        try {
          await message.react('✅');
        } catch (reactionError) {
          // If reaction fails, send success message instead
          return embeds.success(message, `Updated reason for case #${caseId}`);
        }

      } else {
        // No case ID - update the last moderation case by this moderator
        newReason = args.join(' ');

        // Get the last case created by this moderator
        const lastCase = await guildService.getLastModerationCaseByModerator(message.guild.id, message.author.id);

        if (!lastCase) {
          return embeds.deny(message, 'No recent moderation cases found by you');
        }

        // Update the reason
        await guildService.updateModerationCaseReason(message.guild.id, lastCase.caseId, newReason);

        // React with success emote
        try {
          await message.react('✅');
        } catch (reactionError) {
          // If reaction fails, send success message instead
          return embeds.success(message, `Updated reason for case #${lastCase.caseId}`);
        }
      }

    } catch (error) {
      throw error;
    }
  }
};
