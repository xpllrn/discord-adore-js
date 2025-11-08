const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('../config/setup');

/**
 * Unified Logger - Handles both console and webhook logging
 * Auto-extracts context from Discord message objects
 * 
 * Usage:
 *   logger.console.log('message')
 *   logger.webhook.error(error, message)  // Auto-extracts context
 *   logger.both.error(error, message)
 */
class Logger {
  constructor() {
    this.errorWebhook = null;
    this.initializeWebhooks();
  }

  /**
   * Initialize webhook clients
   */
  initializeWebhooks() {
    if (config.logging.errorWebhookUrl) {
      try {
        this.errorWebhook = new WebhookClient({ url: config.logging.errorWebhookUrl });
      } catch (error) {
        console.warn('[LOGGER] Failed to initialize error webhook:', error.message);
      }
    }
  }

  /**
   * Extract context from message object automatically
   * @param {Object} message - Discord message object
   * @returns {Object} - Extracted context
   */
  _extractContext(message) {
    if (!message) return {};
    
    return {
      user: message.author || message.user,
      guild: message.guild,
      channel: message.channel,
      command: this._extractCommandName(),
      args: message.content ? message.content.split(' ').slice(1).join(' ') : ''
    };
  }

  /**
   * Extract command name from call stack
   * @returns {string} - Command name
   */
  _extractCommandName() {
    try {
      const stack = new Error().stack;
      const lines = stack.split('\n');
      
      // Look for command file in stack
      for (const line of lines) {
        const match = line.match(/commands\/([^/]+)\/([^/]+)\.js/);
        if (match) {
          return match[2]; // Return command name
        }
      }
      
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Console logging methods
   */
  console = {
    log: (...args) => {
      try {
        console.log(...args);
      } catch (error) {
        // Ignore broken pipe errors
      }
    },

    error: (...args) => {
      try {
        console.error(...args);
      } catch (error) {
        // Ignore broken pipe errors
      }
    },

    warn: (...args) => {
      try {
        console.warn(...args);
      } catch (error) {
        // Ignore broken pipe errors
      }
    },

    info: (...args) => {
      try {
        console.info(...args);
      } catch (error) {
        // Ignore broken pipe errors
      }
    },

    debug: (...args) => {
      try {
        console.debug(...args);
      } catch (error) {
        // Ignore broken pipe errors
      }
    }
  };

  /**
   * Webhook logging methods
   */
  webhook = {
    /**
     * Log error to webhook (auto-extracts context from message)
     * @param {Error|string} errorOrMessage - Error object or message
     * @param {Object} message - Discord message object (optional, auto-extracts context)
     */
    error: async (errorOrMessage, message = null) => {
      if (!this.errorWebhook) return;

      try {
        // Auto-extract context from message if provided
        const context = message ? this._extractContext(message) : {};
        const { user, guild, channel, command, args } = context;

        // Build command used section
        let cmdUsed = command || 'Unknown command';
        if (args) {
          cmdUsed = `${cmdUsed} ${args}`;
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

        await this.errorWebhook.send({ embeds: [embed] });
      } catch (webhookError) {
        // Silent fail to avoid infinite loops
      }
    }.bind(this),

    /**
     * Log warning to webhook (auto-extracts context)
     * @param {string} warningMessage - Warning message
     * @param {Object} message - Discord message object (optional)
     */
    warn: async (warningMessage, message = null) => {
      if (!this.errorWebhook) return;

      try {
        const context = message ? this._extractContext(message) : {};
        const { user, guild, channel, command, args } = context;

        let cmdUsed = command || 'Unknown command';
        if (args) {
          cmdUsed = `${cmdUsed} ${args}`;
        }

        let description = '**Warning detected**\n\n';
        description += `**cmd used**\n\`\`\`\n${cmdUsed}\n\`\`\`\n\n`;
        description += `**Warning details**\n\`\`\`\n${warningMessage}\n\`\`\``;

        const embed = new EmbedBuilder()
          .setColor('#fbd03b')
          .setDescription(description);

        if (user) {
          embed.setAuthor({
            name: user.id,
            iconURL: user.displayAvatarURL({ dynamic: true })
          });
        }

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

        await this.errorWebhook.send({ embeds: [embed] });
      } catch (webhookError) {
        // Silent fail
      }
    }.bind(this),

    /**
     * Log info to webhook (auto-extracts context)
     * @param {string} infoMessage - Info message
     * @param {Object} message - Discord message object (optional)
     */
    info: async (infoMessage, message = null) => {
      if (!this.errorWebhook) return;

      try {
        const context = message ? this._extractContext(message) : {};
        const { user, guild, channel, command, args } = context;

        let cmdUsed = command || 'Unknown command';
        if (args) {
          cmdUsed = `${cmdUsed} ${args}`;
        }

        let description = '**Info**\n\n';
        description += `**cmd used**\n\`\`\`\n${cmdUsed}\n\`\`\`\n\n`;
        description += `**Details**\n\`\`\`\n${infoMessage}\n\`\`\``;

        const embed = new EmbedBuilder()
          .setColor('#e1d4da')
          .setDescription(description);

        if (user) {
          embed.setAuthor({
            name: user.id,
            iconURL: user.displayAvatarURL({ dynamic: true })
          });
        }

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

        await this.errorWebhook.send({ embeds: [embed] });
      } catch (webhookError) {
        // Silent fail
      }
    }.bind(this)
  };

  /**
   * Log to both console and webhook
   */
  both = {
    /**
     * Log error to both console and webhook (auto-extracts context)
     */
    error: async (errorOrMessage, message = null) => {
      const command = this._extractCommandName();
      this.console.error(`[${command}]`, errorOrMessage);
      await this.webhook.error(errorOrMessage, message);
    }.bind(this),

    /**
     * Log warning to both console and webhook (auto-extracts context)
     */
    warn: async (warningMessage, message = null) => {
      const command = this._extractCommandName();
      this.console.warn(`[${command}]`, warningMessage);
      await this.webhook.warn(warningMessage, message);
    }.bind(this),

    /**
     * Log info to both console and webhook (auto-extracts context)
     */
    info: async (infoMessage, message = null) => {
      const command = this._extractCommandName();
      this.console.info(`[${command}]`, infoMessage);
      await this.webhook.info(infoMessage, message);
    }.bind(this),

    /**
     * Log to both console and webhook (auto-extracts context)
     */
    log: async (logMessage, message = null) => {
      const command = this._extractCommandName();
      this.console.log(`[${command}]`, logMessage);
      await this.webhook.info(logMessage, message);
    }.bind(this)
  };
}

// Export singleton instance
module.exports = new Logger();
