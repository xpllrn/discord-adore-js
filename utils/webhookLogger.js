const { WebhookClient, EmbedBuilder, AuditLogEvent } = require('discord.js');
const config = require('../config/setup');
const { getService } = require('@services');

class WebhookLogger {
  constructor() {
    this.webhookClients = new Map(); // Cache webhook clients
  }

  /**
   * Get or create webhook client for a URL
   * @param {string} webhookUrl - The webhook URL
   * @returns {WebhookClient|null} - The webhook client or null if invalid
   */
  getWebhookClient(webhookUrl) {
    if (!webhookUrl) return null;

    if (this.webhookClients.has(webhookUrl)) {
      return this.webhookClients.get(webhookUrl);
    }

    try {
      const webhook = new WebhookClient({ url: webhookUrl });
      this.webhookClients.set(webhookUrl, webhook);
      return webhook;
    } catch (error) {
      // Silent fail for webhook client creation
      return null;
    }
  }

  /**
   * Get logging configurations for a guild and log type
   * @param {string} guildId - Guild ID
   * @param {string} logType - Log type (moderator, message, events, members)
   * @returns {Array} - Array of logging configurations
   */
  async getLoggingConfigs(guildId, logType) {
    try {
      const guildService = getService('guild');
      const configs = await guildService.getLoggingConfigsForType(guildId, logType);
      return configs.filter(config => config.webhookUrl);
    } catch (error) {
      // Silent fail for getting configs - return empty array
      return [];
    }
  }

  /**
   * Send a log message to all configured webhooks
   * @param {string} guildId - Guild ID
   * @param {string} logType - Log type (moderator, message, events)
   * @param {EmbedBuilder} embed - The embed to send
   * @param {Array} files - Optional array of files to send
   * @returns {Promise<void>}
   */
  async sendLog(guildId, logType, embed, files = []) {
    // Make webhook logging completely non-blocking
    setImmediate(async () => {
      try {
        const configs = await this.getLoggingConfigs(guildId, logType);
        if (configs.length === 0) return;

        const promises = configs.map(async (config) => {
          const webhook = this.getWebhookClient(config.webhookUrl);
          if (!webhook) return;

          try {
            const messageOptions = { embeds: [embed] };
            if (files && files.length > 0) {
              messageOptions.files = files;
            }
            await webhook.send(messageOptions);
          } catch (error) {
            // If webhook was deleted (404 error), try to recreate it
            if (error.code === 10015 || error.status === 404) {
              await this.handleDeletedWebhook(guildId, config, embed, files);
            }
            // Silent fail for other webhook errors - avoid infinite loops
          }
        });

        await Promise.allSettled(promises);
      } catch (error) {
        // Silent fail for logging system - avoid infinite loops
      }
    });
  }

  /**
   * Handle deleted webhook by recreating it
   * @param {string} guildId - Guild ID
   * @param {Object} config - Logging config
   * @param {EmbedBuilder} embed - The embed to send
   * @param {Array} files - Optional array of files to send
   * @returns {Promise<void>}
   */
  async handleDeletedWebhook(guildId, config, embed, files = []) {
    try {
      const { getService } = require('@services');

      // Get the Discord client from global client reference (avoid circular dependency)
      const client = global.discordClient;
      if (!client || !client.guilds) return;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(config.channelId);
      if (!channel) return;

      // Check if bot has permissions to create webhooks
      const botMember = await guild.members.fetch(client.user.id);
      const botPermissions = channel.permissionsFor(botMember);

      if (!botPermissions || !botPermissions.has(['ViewChannel', 'ManageWebhooks'])) {
        return; // Can't recreate webhook without permissions
      }

      // Create new webhook
      const newWebhook = await channel.createWebhook({
        name: 'vleed Audits',
        avatar: client.user.displayAvatarURL({ format: 'png' }),
        reason: 'Recreating deleted webhook for logging'
      });

      // Update the config with new webhook URL
      const guildService = getService('guild');
      config.webhookUrl = newWebhook.url;
      await guildService.updateLoggingConfigByChannel(guildId, config.channelId, config);

      // Clear old webhook from cache and add new one
      this.webhookClients.delete(config.webhookUrl);
      const newWebhookClient = this.getWebhookClient(newWebhook.url);

      // Try to send the original embed with the new webhook
      if (newWebhookClient) {
        const messageOptions = { embeds: [embed] };
        if (files && files.length > 0) {
          messageOptions.files = files;
        }
        await newWebhookClient.send(messageOptions);
      }

    } catch (error) {
      // Silent fail - webhook recreation failed
    }
  }

  /**
   * Create a moderator action log embed
   * @param {Object} options - Log options
   * @returns {EmbedBuilder} - The log embed
   */
  createModeratorLog(options) {
    const { action, executor, target, reason, duration, until, caseNumber, guild } = options;

    const embed = new EmbedBuilder()
      .setColor(this.getActionColor(action))
      .setAuthor({
        name: this.getActionTitle(action),
        iconURL: executor?.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    // Information section with bold formatting
    let infoText = '';

    // Only show case number if it exists and is not null/undefined
    if (caseNumber && caseNumber !== 'Unknown') {
      infoText += `Case #${caseNumber}\n\n`;
    }

    infoText += `**User:** ${target?.username || 'Unknown'} (\`${target?.id || 'Unknown'}\`)\n`;
    infoText += `**Moderator:** ${executor?.username || 'Unknown'} (\`${executor?.id || 'Unknown'}\`)\n`;

    // Add until/duration for temporary actions - handle both cases properly
    if (until) {
      const untilTimestamp = Math.floor(until.getTime() / 1000);
      infoText += `**Until:** <t:${untilTimestamp}:F> (<t:${untilTimestamp}:R>)\n`;
    }

    // Only show duration if it exists and is not empty/zero
    if (duration && duration !== '0m' && duration !== '0s' && duration !== '') {
      infoText += `**Duration:** ${duration}\n`;
    }

    infoText += `**Reason:** ${reason || 'No reason provided'}`;

    embed.setDescription(infoText);

    // Footer with user ID
    embed.setFooter({
      text: `User ID: ${target?.id || 'Unknown'}`,
      iconURL: null
    });

    return embed;
  }

  /**
   * Create a message log embed
   * @param {Object} options - Log options
   * @returns {Object} - Object containing embed and optional files array
   */
  createMessageLog(options) {
    const { action, message, oldMessage, author, channel } = options;

    const embed = new EmbedBuilder()
      .setColor(action === 'delete' ? config.colors.error : config.colors.warn)
      .setAuthor({
        name: `Message ${action === 'delete' ? 'deleted' : 'edited'}`,
        iconURL: author?.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    if (action === 'edit' && message && oldMessage) {
      // Message edited format
      const editedTimestamp = Math.floor(Date.now() / 1000);
      const messageLink = `https://discord.com/channels/${message.guild?.id || '@me'}/${message.channel.id}/${message.id}`;

      embed.setDescription(`[Message](${messageLink}) from <@${author.id}> edited <t:${editedTimestamp}:R>`);

      // Before content
      const beforeContent = oldMessage.content || '*No text content*';
      embed.addFields({
        name: '**Before**',
        value: beforeContent.length > 1000 ? `\`\`\`${beforeContent.substring(0, 997)}...\`\`\`` : `\`\`\`${beforeContent}\`\`\``,
        inline: false
      });

      // After content
      const afterContent = message.content || '*No text content*';
      embed.addFields({
        name: '**After**',
        value: afterContent.length > 1000 ? `\`\`\`${afterContent.substring(0, 997)}...\`\`\`` : `\`\`\`${afterContent}\`\`\``,
        inline: false
      });

    } else if (action === 'delete' && message) {
      // Message deleted format
      embed.setDescription(`Message from <@${author.id}> deleted in <#${channel.id}>`);

      // Check if there are attachments first
      const hasAttachments = message.attachments && message.attachments.size > 0;
      const hasContent = message.content && message.content.trim();

      // Only add message content field if there's actual text content
      if (hasContent) {
        embed.addFields({
          name: '**Message Content**',
          value: message.content.length > 1000 ? message.content.substring(0, 997) + '...' : message.content,
          inline: false
        });
      }

      // Add attachment info if present
      if (hasAttachments) {
        const attachmentArray = Array.from(message.attachments.values());

        // Check if any attachment is an image
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const imageAttachments = attachmentArray.filter(att =>
          imageExtensions.some(ext => att.name.toLowerCase().endsWith(ext))
        );

        if (imageAttachments.length === 1 && attachmentArray.length === 1) {
          // Single image - show directly in embed
          embed.setImage(imageAttachments[0].url);

          // If there's no text content, add a field indicating it was an image
          if (!hasContent) {
            embed.addFields({
              name: '**Message Content**',
              value: '*Image*',
              inline: false
            });
          }
        } else if (imageAttachments.length > 1) {
          // Multiple images - prepare files for attachment and show count
          const files = [];
          try {
            for (let i = 0; i < Math.min(imageAttachments.length, 10); i++) { // Limit to 10 files
              const attachment = imageAttachments[i];
              files.push({
                attachment: attachment.url,
                name: attachment.name || `image_${i + 1}.${attachment.url.split('.').pop()}`
              });
            }

            // Store files in the result object
            this._tempFiles = files;

            embed.addFields({
              name: '**Attachments**',
              value: `${imageAttachments.length} image${imageAttachments.length > 1 ? 's' : ''} (attached)`,
              inline: false
            });

            // If there's no text content, add a field indicating the image count
            if (!hasContent) {
              embed.addFields({
                name: '**Message Content**',
                value: `*${imageAttachments.length} image${imageAttachments.length > 1 ? 's' : ''}*`,
                inline: false
              });
            }
          } catch (error) {
            // Fallback to links if file attachment fails
            const attachments = imageAttachments
              .map(att => `[${att.name}](${att.url})`)
              .join('\n');
            embed.addFields({
              name: '**Attachments**',
              value: attachments.length > 1000 ? attachments.substring(0, 997) + '...' : attachments,
              inline: false
            });

            if (!hasContent) {
              embed.addFields({
                name: '**Message Content**',
                value: `*${imageAttachments.length} image${imageAttachments.length > 1 ? 's' : ''}*`,
                inline: false
              });
            }
          }
        } else {
          // Multiple attachments with non-images or mixed - show as links
          const attachments = attachmentArray
            .map(att => `[${att.name}](${att.url})`)
            .join('\n');
          embed.addFields({
            name: '**Attachments**',
            value: attachments.length > 1000 ? attachments.substring(0, 997) + '...' : attachments,
            inline: false
          });

          // If there's no text content, add a field indicating the attachment count
          if (!hasContent) {
            embed.addFields({
              name: '**Message Content**',
              value: `*${attachmentArray.length} attachment${attachmentArray.length > 1 ? 's' : ''}*`,
              inline: false
            });
          }
        }
      } else if (!hasContent) {
        // No content and no attachments - this shouldn't happen but handle it
        embed.addFields({
          name: '**Message Content**',
          value: '*No content*',
          inline: false
        });
      }
    }

    // Footer with user ID and timestamp
    embed.setFooter({
      text: `User ID: ${author?.id}`,
      iconURL: null
    });

    // Return object with embed and optional files
    const result = { embed };
    if (this._tempFiles && this._tempFiles.length > 0) {
      result.files = this._tempFiles;
      delete this._tempFiles; // Clean up temp storage
    }

    return result;
  }

  /**
   * Create a member join/leave log embed
   * @param {Object} options - Log options
   * @returns {EmbedBuilder} - The log embed
   */
  createMemberLog(options) {
    const { action, member, guild } = options;

    // Determine color based on action
    let color;
    if (action === 'memberJoin') {
      color = member.user.bot ? config.colors.embed : config.colors.success;
    } else {
      color = config.colors.error;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${member.user.username} ${action === 'memberJoin' ? 'joined' : 'left'}`,
        iconURL: member.user.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    // Add account creation date
    const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);
    embed.addFields({
      name: '**Created**',
      value: `<t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`,
      inline: false
    });

    // Add join date for both join and leave events
    if (member.joinedTimestamp) {
      const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
      embed.addFields({
        name: '**Joined**',
        value: `<t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)`,
        inline: false
      });
    }

    // Add footer with user ID and current time
    embed.setFooter({
      text: `User ID: ${member.user.id}`,
      iconURL: guild?.iconURL({ dynamic: true })
    });

    return embed;
  }

  /**
   * Create a server event log embed
   * @param {Object} options - Log options
   * @returns {EmbedBuilder} - The log embed
   */
  createServerEventLog(options) {
    const { action, executor, target, changes, guild } = options;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: this.getEventTitle(action),
        iconURL: executor?.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    // Create description based on action type
    let description = '';

    if (action === 'roleCreate') {
      description = `Role <@&${target?.id}> created by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;

      // Add role details as inline fields
      if (target) {
        embed.addFields(
          {
            name: '**Name**',
            value: target.name || 'Unknown',
            inline: true
          },
          {
            name: '**Color**',
            value: `\`${target.hexColor || '#000000'}\``,
            inline: true
          }
        );
      }
    } else if (action === 'roleUpdate') {
      description = `Role <@&${target?.id}> updated by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'roleDelete') {
      description = `Role **@${target?.name || 'unknown'}** deleted by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;

      // Add role details as inline fields
      if (target) {
        embed.addFields(
          {
            name: '**Name**',
            value: target.name || 'Unknown',
            inline: true
          },
          {
            name: '**Color**',
            value: `\`${target.hexColor || '#000000'}\``,
            inline: true
          }
        );
      }
    } else if (action === 'channelDelete') {
      const channelType = this.getChannelTypeText(target?.type);
      description = `${channelType} **#${target?.name || 'unknown'}** deleted by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;

      // Add channel creation date if available
      if (target?.createdTimestamp) {
        const createdTimestamp = Math.floor(target.createdTimestamp / 1000);
        description += `\nChannel was created at <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`;
      }
    } else if (action === 'channelUpdate') {
      const channelType = this.getChannelTypeText(target?.type);
      description = `${channelType} <#${target?.id}> updated by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'channelCreate') {
      const channelType = this.getChannelTypeText(target?.type);
      description = `${channelType} <#${target?.id}> created by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'memberKick') {
      description = `Member ${target ? `<@${target.id}>` : '**Unknown**'} kicked by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'memberLeave') {
      description = `Member ${target ? `<@${target.id}>` : '**Unknown**'} left ${executor ? `by ${executor.id === target?.id ? 'themselves' : `<@${executor.id}>`}` : ''}`;
    } else if (action === 'inviteCreate') {
      description = `Invite created by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'inviteDelete') {
      description = `Invite deleted by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'inviteUpdate') {
      description = `Invite updated by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'webhookCreate') {
      description = `Webhook **${target?.name || 'Unknown'}** created by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'webhookDelete') {
      description = `Webhook **${target?.name || 'Unknown'}** deleted by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'webhookUpdate') {
      description = `Webhook **${target?.name || 'Unknown'}** updated by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'emojiCreate') {
      description = `Emoji **:${target?.name || 'unknown'}:** created by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'emojiDelete') {
      description = `Emoji **:${target?.name || 'unknown'}:** deleted by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'emojiUpdate') {
      description = `Emoji **:${target?.name || 'unknown'}:** updated by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'messageDelete') {
      description = `Message deleted by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else if (action === 'messageBulkDelete') {
      description = `Messages bulk deleted by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    } else {
      // Fallback for other events
      description = `${this.getEventTitle(action)} by ${executor ? `<@${executor.id}>` : '**Unknown**'}`;
    }

    embed.setDescription(description);

    // Add changes for update events
    if (changes && changes.length > 0) {
      // Format changes based on action type
      if (action === 'roleUpdate' || action === 'channelUpdate') {
        const changeText = changes.map(change => {
          // Handle special formatting for certain change types
          if (change.key === 'name') {
            return `**${change.key}:** ${change.old || 'None'} → ${change.new || 'None'}`;
          } else if (change.key === 'color') {
            return `**${change.key}:** \`${change.old || '#000000'}\` → \`${change.new || '#000000'}\``;
          } else {
            return `**${change.key}:** ${change.old || 'None'} → ${change.new || 'None'}`;
          }
        }).join('\n');

        embed.addFields({
          name: '**Changes**',
          value: changeText.length > 1024 ? changeText.substring(0, 1021) + '...' : changeText,
          inline: false
        });
      }
    }

    // Add footer with executor user ID and timestamp
    if (executor) {
      embed.setFooter({
        text: `User ID: ${executor.id}`,
        iconURL: null
      });
    }

    return embed;
  }

  /**
   * Create a channel permissions log embed
   * @param {Object} options - Log options
   * @returns {EmbedBuilder} - The log embed
   */
  createChannelPermissionsLog(options) {
    const { action, channel, target, executor, changes } = options;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: `Channel Permissions ${action === 'create' ? 'Created' : 'Updated'}`,
        iconURL: executor?.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    if (action === 'create') {
      embed.setDescription(`${target?.name || '@everyone'} permissions for <#${channel?.id}> created by <@${executor?.id}>`);
    } else {
      embed.setDescription(`Channel permissions for <#${channel?.id}> updated by <@${executor?.id}>`);

      // Add permission changes
      if (changes && changes.length > 0) {
        const permissionText = changes.map(change =>
          `**${change.key}:** \`${change.old ? '✅' : '❌'}\` → \`${change.new ? '✅' : '❌'}\``
        ).join('\n');

        embed.addFields({
          name: '**Changes**',
          value: permissionText,
          inline: false
        });
      }
    }

    embed.setFooter({
      text: `User ID: ${executor?.id}`,
      iconURL: null
    });

    return embed;
  }

  /**
   * Create a voice state log embed
   * @param {Object} options - Log options
   * @returns {EmbedBuilder} - The log embed
   */
  createVoiceStateLog(options) {
    const { action, member, oldChannel, newChannel } = options;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: 'Voice State Updated',
        iconURL: member?.user?.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    if (action === 'join') {
      embed.setDescription(`<@${member.user.id}> joined **${newChannel?.name || 'unknown channel'}**`);
    } else if (action === 'leave') {
      embed.setDescription(`<@${member.user.id}> left **${oldChannel?.name || 'unknown channel'}**`);
    } else if (action === 'move') {
      embed.setDescription(`<@${member.user.id}> moved from **${oldChannel?.name || 'unknown'}** to **${newChannel?.name || 'unknown'}**`);

      embed.addFields(
        {
          name: '**Old Channel**',
          value: oldChannel?.name || 'Unknown',
          inline: true
        },
        {
          name: '**Current Channel**',
          value: newChannel?.name || 'Unknown',
          inline: true
        }
      );
    }

    embed.setFooter({
      text: `User ID: ${member?.user?.id}`,
      iconURL: null
    });

    return embed;
  }

  /**
   * Create a member roles log embed
   * @param {Object} options - Log options
   * @returns {EmbedBuilder} - The log embed
   */
  createMemberRolesLog(options) {
    const { action, member, role, executor } = options;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: 'Member Roles Updated',
        iconURL: executor?.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    const actionText = action === 'add' ? 'was granted' : 'was removed from';
    embed.setDescription(`<@${member.user.id}> ${actionText} <@&${role.id}> by <@${executor?.id}>`);

    embed.setFooter({
      text: `User ID: ${member?.user?.id}`,
      iconURL: null
    });

    return embed;
  }

  /**
   * Get color for moderator actions
   * @param {string} action - The action type
   * @returns {string} - Hex color
   */
  getActionColor(action) {
    const colors = {
      ban: config.colors.error,
      unban: config.colors.success,
      kick: config.colors.warn,
      timeout: config.colors.warn,
      untimeout: config.colors.success,
      warn: config.colors.warn,
      jail: config.colors.error,
      unjail: config.colors.success,
      imute: config.colors.warn,
      iunmute: config.colors.success,
      rmute: config.colors.warn,
      runmute: config.colors.success
    };
    return colors[action] || config.colors.info;
  }



  /**
   * Get title for moderator actions
   * @param {string} action - The action type
   * @returns {string} - Title
   */
  getActionTitle(action) {
    const titles = {
      ban: 'Member Banned',
      unban: 'Member Unbanned',
      kick: 'Member Kicked',
      timeout: 'Member Timed Out',
      untimeout: 'Member Timeout Removed',
      warn: 'Member Warned',
      jail: 'Member Jailed',
      unjail: 'Member Unjailed',
      imute: 'Member Image Muted',
      iunmute: 'Member Image Unmuted',
      rmute: 'Member Reaction Muted',
      runmute: 'Member Reaction Unmuted'
    };
    return titles[action] || 'Moderator Action';
  }



  /**
   * Get title for server events
   * @param {string} action - The event type
   * @returns {string} - Title
   */
  getEventTitle(action) {
    const titles = {
      channelCreate: 'Channel Created',
      channelDelete: 'Channel Deleted',
      channelUpdate: 'Channel Updated',
      channelPermissionsUpdate: 'Channel Permissions Updated',
      roleCreate: 'Role Created',
      roleDelete: 'Role Deleted',
      roleUpdate: 'Role Updated',
      guildUpdate: 'Server Updated',
      memberUpdate: 'Member Updated',
      memberJoin: 'Member Joined',
      memberLeave: 'Member Left',
      memberKick: 'Member Kicked',
      memberRoleAdd: 'Member Role Added',
      memberRoleRemove: 'Member Role Removed',
      voiceJoin: 'Voice Channel Joined',
      voiceLeave: 'Voice Channel Left',
      voiceMove: 'Voice Channel Moved',
      inviteCreate: 'Invite Created',
      inviteDelete: 'Invite Deleted',
      inviteUpdate: 'Invite Updated',
      webhookCreate: 'Webhook Created',
      webhookDelete: 'Webhook Deleted',
      webhookUpdate: 'Webhook Updated',
      emojiCreate: 'Emoji Created',
      emojiDelete: 'Emoji Deleted',
      emojiUpdate: 'Emoji Updated',
      stickerCreate: 'Sticker Created',
      stickerDelete: 'Sticker Deleted',
      stickerUpdate: 'Sticker Updated',
      messageDelete: 'Message Deleted',
      messageBulkDelete: 'Messages Bulk Deleted'
    };
    return titles[action] || 'Server Event';
  }

  /**
   * Get channel type text
   * @param {number} channelType - Discord channel type
   * @returns {string} - Channel type text
   */
  getChannelTypeText(channelType) {
    const types = {
      0: 'Text channel',
      1: 'DM channel',
      2: 'Voice channel',
      3: 'Group DM',
      4: 'Category',
      5: 'Announcement channel',
      10: 'Announcement thread',
      11: 'Public thread',
      12: 'Private thread',
      13: 'Stage channel',
      14: 'Directory',
      15: 'Forum channel',
      16: 'Media channel'
    };
    return types[channelType] || 'Channel';
  }
}

module.exports = new WebhookLogger();
