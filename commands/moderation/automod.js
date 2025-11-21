const { PermissionFlagsBits, EmbedBuilder, AutoModerationRuleTriggerType, AutoModerationActionType } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasDiscordPermission } = require('../../utils/permissions');
const { colors, emojis } = require('../../config/setup');
const logger = require('../../utils/logger');

module.exports = {
  name: "automod",
  aliases: [],
  description: "Setup AutoMod rules to get the AutoMod badge",
  permission: "Manage Guild",
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return embeds.deny(message, 'I need **Manage Guild** permission to create AutoMod rules');
    }

    // Send loading embed
    const loadingMsg = await embeds.loading(message, 'Setting up AutoMod rules...');

    const badWords = ['fuck', 'shit', 'bitch', 'damn', 'ass', 'hell'];
    const creatorId = message.guild.ownerId;
    const rulesCreated = [];
    const rulesFailed = [];

    // Create rules one by one
    for (let i = 0; i < 6; i++) {
      try {
        const rule = await message.guild.autoModerationRules.create({
          name: `AutoMod Rule ${i + 1}`,
          creatorId: creatorId,
          enabled: true,
          eventType: 1, // MESSAGE_SEND
          triggerType: 5, // KEYWORD_PRESET
          triggerMetadata: {
            presets: [1, 2, 3], // Profanity, Sexual Content, Slurs
            keywordFilter: [badWords[i]]
          },
          actions: [
            {
              type: AutoModerationActionType.BlockMessage,
              metadata: {
                customMessage: 'This message has been blocked by AutoMod.'
              }
            }
          ]
        });

        rulesCreated.push(`Rule ${i + 1}: \`${badWords[i]}\``);

        // Update loading message
        await loadingMsg.edit({
          embeds: [embeds.createLoading(message, `Created ${i + 1}/6 AutoMod rules...`)]
        });

        // Small delay between rule creation
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.webhook.error(error, message);
        rulesFailed.push(`Rule ${i + 1}: ${error.message}`);
      }
    }

    // Final result embed
    if (rulesCreated.length === 6) {
      const successEmbed = new EmbedBuilder()
        .setColor(colors.success)
        .setTitle(`${emojis.success} AutoMod Setup Complete`)
        .setDescription(`Successfully created **6 AutoMod rules**!\n\n${rulesCreated.join('\n')}`)
        .setFooter({ text: 'Your bot should now have the AutoMod badge in 12 hours!' });

      return loadingMsg.edit({ embeds: [successEmbed] });
    } else {
      const partialEmbed = new EmbedBuilder()
        .setColor(colors.warn)
        .setTitle(`${emojis.warn} AutoMod Setup Partial`)
        .setDescription(`Created **${rulesCreated.length}/6** AutoMod rules.\n\n**Success:**\n${rulesCreated.join('\n') || 'None'}\n\n**Failed:**\n${rulesFailed.join('\n') || 'None'}`)
        .setFooter({ text: 'Some rules failed to create. Check if the server already has AutoMod rules.' });

      return loadingMsg.edit({ embeds: [partialEmbed] });
    }
  }
};
