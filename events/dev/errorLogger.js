const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('../../config/setup');

class WebhookErrorLogger {
  constructor() {
    this.webhookUrl = config.logging.errorWebhookUrl;
    this.webhook = null;
    this.initializeWebhook();
  }

  /**
   * Initialize webhook client
   */
  initializeWebhook() {
    if (!this.webhookUrl) {
      // Silent when no webhook URL - will be shown in startup validation if needed
      return;
    }

    try {
      this.webhook = new WebhookClient({ url: this.webhookUrl });
      // Silent initialization - success is implied if no errors
    } catch (error) {
      console.warn('[ERROR LOGGER] Failed to initialize webhook:', error.message);
    }
  }

  /**
   * Log via webhook
   * @param {Error|string} errorOrMessage - The error object or message
   * @param {string} context - Context where the error occurred
   * @param {Object} additionalInfo - Additional information about the error
   */
  async log(errorOrMessage, context = 'Unknown', additionalInfo = {}) {
    if (!this.webhook) {
      return;
    }

    try {
      const { user, guild, channel } = additionalInfo;
      const command = additionalInfo.command || context;

      // Build command used section
      let cmdUsed = 'Unknown command';
      if (command && additionalInfo.args) {
        cmdUsed = `${command} ${additionalInfo.args}`;
      } else if (command) {
        cmdUsed = command;
      }

      // Build description
      let description = '**New error detected**\n\n';
      description += `**cmd used**\n\`\`\`\n${cmdUsed}\n\`\`\`\n\n`;

      // Handle both Error objects and string messages
      if (errorOrMessage instanceof Error) {
        description += `**Traceback error**\n\`\`\`\n${errorOrMessage.stack || errorOrMessage.message || 'No error details available'}\n\`\`\``;
      } else {
        description += `**Error details**\n\`\`\`\n${errorOrMessage}\n\`\`\``;
      }

      const embed = new EmbedBuilder()
        .setColor('#a50000')
        .setDescription(description);

      // Set author if user info is available
      if (user) {
        embed.setAuthor({
          name: user.id,
          iconURL: user.displayAvatarURL({ dynamic: true })
        });
      }

      // Set footer with server and channel info
      let footerParts = [];
      if (guild) {
        footerParts.push(`Server ID - ${guild.id}`);
      }
      if (channel) {
        footerParts.push(`Channel ID - ${channel.id}`);
      }
      if (footerParts.length > 0) {
        embed.setFooter({ text: footerParts.join(' | ') });
      }

      await this.webhook.send({
        embeds: [embed]
      });
    } catch (webhookError) {
      // Silent fail
    }
  }


}

module.exports = WebhookErrorLogger;
