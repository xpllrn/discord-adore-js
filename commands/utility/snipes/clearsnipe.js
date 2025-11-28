const { PermissionFlagsBits } = require("discord.js");
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { embeds: style } = require('../../../config/setup');
const snipeCache = require('../../../database/cache/snipeCache');
const logger = require('../../../utils/logger');

module.exports = {
  name: "clearsnipe",
  aliases: ['cs', 'clearsnipes'],
  description: `clear snipe data for this channel`,
  syntax: 'clearsnipe',
  example: 'clearsnipe',
  run: async(_, message) => {
    try {
      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

      const channelId = message.channel.id;

      const snipes = snipeCache.getDeletedMessages(channelId);
      const editsnipes = snipeCache.getEditedMessages(channelId);
      const reactionsnipes = snipeCache.getRemovedReactions(channelId);

      const hasSnipeData = snipes && snipes.length > 0;
      const hasEditSnipeData = editsnipes && editsnipes.length > 0;
      const hasReactionSnipeData = reactionsnipes && reactionsnipes.length > 0;

      if (!hasSnipeData && !hasEditSnipeData && !hasReactionSnipeData) {
        return embeds.warn(message, 'There is **no snipe data** to clear in this channel');
      }

      snipeCache.clearChannel(channelId);

      try {
        await message.react(style.emojis.success);
      } catch (error) {
        embeds.success(message, 'Successfully **cleared** all snipe data for this channel');
      }
    } catch (error) {
      throw error;
    }
  }
}
