const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('../../../database/services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "modstats",
  aliases: ['modstatistics', 'mstats'],
  description: `view moderation statistics for the server`,
  syntax: 'modstats',
  example: 'modstats',
  permission: 'manage_messages',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

    try {
      // Get current timestamp
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = now - (14 * 24 * 60 * 60 * 1000);

      // Fetch all moderation cases for the guild
      const allCases = await guildService.getAllModerationCases(message.guild.id);

      // Initialize counters
      const stats = {
        sevenDays: { warned: 0, kicked: 0, banned: 0, unbanned: 0, timedOut: 0, jailed: 0 },
        fourteenDays: { warned: 0, kicked: 0, banned: 0, unbanned: 0, timedOut: 0, jailed: 0 },
        allTime: { warned: 0, kicked: 0, banned: 0, unbanned: 0, timedOut: 0, jailed: 0 }
      };

      // Count cases by time period
      for (const case_ of allCases) {
        const caseTime = case_.timestamp.getTime();
        const action = case_.action.toLowerCase();

        // Map actions to stat keys
        let statKey = null;
        if (action === 'warn') statKey = 'warned';
        else if (action === 'kick') statKey = 'kicked';
        else if (action === 'ban' || action === 'hardban') statKey = 'banned';
        else if (action === 'unban' || action === 'unhardban') statKey = 'unbanned';
        else if (action === 'mute') statKey = 'timedOut';
        else if (action === 'jail') statKey = 'jailed';

        if (statKey) {
          // All time
          stats.allTime[statKey]++;

          // Last 14 days
          if (caseTime >= fourteenDaysAgo) {
            stats.fourteenDays[statKey]++;
          }

          // Last 7 days
          if (caseTime >= sevenDaysAgo) {
            stats.sevenDays[statKey]++;
          }
        }
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({ 
          name: message.author.username, 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle(`Moderation Statistics for ${message.guild.name}`)
        .addFields(
          {
            name: 'Last 7 Days',
            value: [
              `> **Warned**: ${stats.sevenDays.warned}`,
              `> **Kicked**: ${stats.sevenDays.kicked}`,
              `> **Banned**: ${stats.sevenDays.banned}`,
              `> **Unbanned**: ${stats.sevenDays.unbanned}`,
              `> **Timed Out**: ${stats.sevenDays.timedOut}`,
              `> **Jailed**: ${stats.sevenDays.jailed}`
            ].join('\n'),
            inline: true
          },
          {
            name: 'Last 14 Days',
            value: [
              `> **Warned**: ${stats.fourteenDays.warned}`,
              `> **Kicked**: ${stats.fourteenDays.kicked}`,
              `> **Banned**: ${stats.fourteenDays.banned}`,
              `> **Unbanned**: ${stats.fourteenDays.unbanned}`,
              `> **Timed Out**: ${stats.fourteenDays.timedOut}`,
              `> **Jailed**: ${stats.fourteenDays.jailed}`
            ].join('\n'),
            inline: true
          },
          {
            name: 'All Time',
            value: [
              `> **Warned**: ${stats.allTime.warned}`,
              `> **Kicked**: ${stats.allTime.kicked}`,
              `> **Banned**: ${stats.allTime.banned}`,
              `> **Unbanned**: ${stats.allTime.unbanned}`,
              `> **Timed Out**: ${stats.allTime.timedOut}`,
              `> **Jailed**: ${stats.allTime.jailed}`
            ].join('\n'),
            inline: true
          }
        );

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      throw error;
    }
  }
};
