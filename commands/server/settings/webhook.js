const { EmbedBuilder, PermissionFlagsBits, WebhookClient } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');

const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "webhook",
  description: "Manage webhooks for the server",
  syntax: 'webhook [subcommand] (parameters)',
  example: 'webhook create MyBot',
  permission: "manage_webhooks",
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');
    const subcommand = args[0]?.toLowerCase();

    // If no subcommand provided, show help
    if (!subcommand) {
      return false;
    }

    switch (subcommand) {
      case 'create': {
        const subcommandInfo = {
          name: 'create',
          description: 'Create a new webhook in the current channel',
          syntax: '{guildprefix}webhook create [name]',
          aliases: [],
          parameters: ['name'],
          example: '{guildprefix}webhook create MyBot'
        };
        return await handleCreate(client, message, args.slice(1), guildService);
      }
      case 'delete':
      case 'remove': {
        const subcommandInfo = {
          name: 'delete',
          description: 'Delete a webhook by ID, name, or short ID',
          syntax: '{guildprefix}webhook delete [webhook_id/name/short_id]',
          aliases: ['remove'],
          parameters: ['webhook_identifier'],
          example: '{guildprefix}webhook delete abc1'
        };
        return await handleDelete(client, message, args.slice(1), guildService);
      }
      case 'send': {
        const subcommandInfo = {
          name: 'send',
          description: 'Send a message through a webhook',
          syntax: '{guildprefix}webhook send [webhook_id] [message]',
          aliases: [],
          parameters: ['webhook_id', 'message'],
          example: '{guildprefix}webhook send abc1 Hello world!'
        };
        return await handleSend(client, message, args.slice(1), guildService);
      }
      case 'edit': {
        const subcommandInfo = {
          name: 'edit',
          description: 'Edit a webhook message',
          syntax: '{guildprefix}webhook edit [message_link] [new_message]',
          aliases: [],
          parameters: ['message_link', 'new_message'],
          example: '{guildprefix}webhook edit https://discord.com/... New content'
        };
        return await handleEdit(client, message, args.slice(1), guildService);
      }
      case 'rename': {
        const subcommandInfo = {
          name: 'rename',
          description: 'Rename a webhook',
          syntax: '{guildprefix}webhook rename [webhook_id] [new_name]',
          aliases: [],
          parameters: ['webhook_id', 'new_name'],
          example: '{guildprefix}webhook rename abc1 NewName'
        };
        return await handleRename(client, message, args.slice(1), guildService);
      }
      case 'avatar': {
        const subcommandInfo = {
          name: 'avatar',
          description: 'Set a webhook\'s avatar',
          syntax: '{guildprefix}webhook avatar [webhook_id] [image_url]',
          aliases: [],
          parameters: ['webhook_id', 'image_url'],
          example: '{guildprefix}webhook avatar abc1 https://example.com/image.png'
        };
        return await handleAvatar(client, message, args.slice(1), guildService);
      }
      case 'list': {
        const subcommandInfo = {
          name: 'list',
          description: 'List all webhooks in the server',
          syntax: '{guildprefix}webhook list',
          aliases: [],
          parameters: [],
          example: '{guildprefix}webhook list'
        };
        return await handleList(client, message, args.slice(1), guildService);
      }
      default:
        return false;
    }
  }
};

// Create webhook
async function handleCreate(client, message, args, guildService) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **name** for the webhook');
  }

  const webhookName = args.join(' ');
  if (webhookName.length > 80) {
    return embeds.warn(message, 'Webhook name must be **80 characters or less**');
  }

  try {
    // Check if webhook name already exists
    const existingWebhook = await guildService.getWebhookByName(message.guild.id, webhookName);
    if (existingWebhook) {
      return embeds.warn(message, `A webhook with the name **${webhookName}** already exists`);
    }

    // Create the Discord webhook
    const webhook = await message.channel.createWebhook({
      name: webhookName,
      reason: `Webhook created by ${message.author.tag}`
    });

    // Save to database
    const webhookData = await guildService.createWebhook(
      message.guild.id,
      webhookName,
      webhook.id,
      webhook.token,
      message.channel.id,
      message.author.id
    );

    return embeds.success(message, `Created webhook **\`${webhookData.shortId}\`** for ${message.channel}!`);

  } catch (error) {
    logger.webhook.error(error, message);
    if (error.code === 50013) {
      return embeds.warn(message, 'I don\'t have permission to create webhooks in this channel');
    }
    return embeds.deny(message, 'Failed to create webhook. Please check my permissions.');
  }
}

// Helper function to find webhook by identifier (short ID, name, or full ID)
async function findWebhookByIdentifier(guildService, guildId, identifier) {
  let webhook = null;

  // Try short ID first (4 characters, alphanumeric)
  if (/^[a-z0-9]{4}$/i.test(identifier)) {
    webhook = await guildService.getWebhookByShortId(guildId, identifier.toLowerCase());
  }

  // If not found, try by name
  if (!webhook) {
    webhook = await guildService.getWebhookByName(guildId, identifier);
  }

  // If still not found, try by full Discord ID
  if (!webhook && /^\d{17,19}$/.test(identifier)) {
    webhook = await guildService.getWebhook(identifier);
    if (webhook && webhook.guildId !== guildId) {
      webhook = null; // Security check - webhook exists but not in this guild
    }
  }

  return webhook;
}

// Delete webhook
async function handleDelete(client, message, args, guildService) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **webhook short ID**, **name**, or **webhook ID** to delete');
  }

  const identifier = args.join(' ');

  try {
    const webhook = await findWebhookByIdentifier(guildService, message.guild.id, identifier);

    if (!webhook) {
      return embeds.warn(message, `Webhook **${identifier}** not found`);
    }

    // Show confirmation dialog
    await createConfirmation(
      message,
      `Are you sure you want to **delete** webhook **\`${webhook.shortId}\`** (${webhook.name})? This action cannot be undone.`,
      async (interaction) => {
        try {
          // Try to delete the Discord webhook
          try {
            const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
            await webhookClient.destroy();
          } catch (discordError) {
            // Webhook might already be deleted on Discord, continue with database cleanup
            console.log('Discord webhook already deleted or inaccessible:', discordError.message);
          }

          // Remove from database
          await guildService.deleteWebhook(message.guild.id, webhook.webhookId);

          // Edit the confirmation embed to show success message
          const successEmbed = embeds.createSuccess(message, `Deleted webhook **\`${webhook.shortId}\`** (${webhook.name})!`);
          await interaction.editReply({ embeds: [successEmbed], components: [] });

        } catch (error) {
          logger.webhook.error(error, message);
          const errorEmbed = embeds.createDeny(message, 'Failed to delete webhook. Please try again.');
          await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
      }
    );

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to find webhook. Please try again.');
  }
}

// Send message via webhook
async function handleSend(client, message, args, guildService) {
  const { runHelpCommand } = require('../../../utils/commandProcessor');
  
  if (args.length < 2) {
    return runHelpCommand(message, 'webhook');
  }

  const webhookIdentifier = args[0];
  const messageContent = args.slice(1).join(' ');

  if (!messageContent) {
    return embeds.warn(message, 'Please provide a **message** or **embed code**');
  }

  try {
    const webhook = await findWebhookByIdentifier(guildService, message.guild.id, webhookIdentifier);
    if (!webhook) {
      return embeds.warn(message, `Webhook **${webhookIdentifier}** not found`);
    }

    // Create a temporary channel-like object for the webhook
    const webhookChannel = {
      send: async (options) => {
        const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
        return await webhookClient.send(options);
      }
    };

    // Use EmbedVariableProcessor to handle both embed and text messages
    await EmbedVariableProcessor.process(webhookChannel, messageContent, {
      user: message.author,
      guild: message.guild,
      channel: message.channel
    });

    await guildService.updateWebhookLastUsed(message.guild.id, webhook.webhookId);

    return embeds.success(message, `Message sent via webhook **\`${webhook.shortId}\`** (${webhook.name})!`);

  } catch (error) {
    logger.webhook.error(error, message);
    if (error.code === 10015) {
      return embeds.warn(message, 'No **webhooks** have been created');
    }
    return embeds.deny(message, 'Failed to send webhook message. Please try again.');
  }
}

// Edit webhook message
async function handleEdit(client, message, args, guildService) {
  const { runHelpCommand } = require('../../../utils/commandProcessor');
  
  if (args.length < 2) {
    return runHelpCommand(message, 'webhook');
  }

  const messageLink = args[0];
  let newContent = '';
  let embedCode = '';
  let addFlag = false;

  // Parse arguments for --add flag
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--add' && args[i + 1]) {
      addFlag = true;
      embedCode = args.slice(i + 1).join(' ');
      break;
    } else if (!addFlag) {
      newContent += args[i] + ' ';
    }
  }

  newContent = newContent.trim();

  if (!newContent && !embedCode) {
    return embeds.warn(message, 'Please provide a **new message** or **embed code**');
  }

  try {
    // Parse message link to get message ID
    const messageId = extractMessageIdFromLink(messageLink);
    if (!messageId) {
      return embeds.warn(message, 'Invalid message link format');
    }

    // Get all webhooks for the guild to find which one sent the message
    const guildWebhooks = await guildService.getGuildWebhooks(message.guild.id);

    let targetWebhook = null;
    for (const webhook of guildWebhooks) {
      try {
        const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
        // Try to fetch the message to see if this webhook sent it
        await webhookClient.fetchMessage(messageId);
        targetWebhook = webhook;
        break;
      } catch (error) {
        // This webhook didn't send the message, continue
        continue;
      }
    }

    if (!targetWebhook) {
      return embeds.warn(message, 'Could not find a webhook that sent this message');
    }

    const webhookClient = new WebhookClient({ id: targetWebhook.webhookId, token: targetWebhook.webhookToken });

    const payload = {};
    if (newContent) payload.content = newContent;

    // Parse embed code if provided
    if (embedCode) {
      try {
        const embedData = parseEmbedCode(embedCode);
        payload.embeds = [embedData];
      } catch (embedError) {
        return embeds.warn(message, `Invalid embed code: ${embedError.message}`);
      }
    }

    await webhookClient.editMessage(messageId, payload);
    await guildService.updateWebhookLastUsed(message.guild.id, targetWebhook.webhookId);

    return embeds.success(message, `Message edited via webhook **\`${targetWebhook.shortId}\`** (${targetWebhook.name})!`);

  } catch (error) {
    logger.webhook.error(error, message);
    if (error.code === 10008) {
      return embeds.warn(message, 'Message not found or not sent by a webhook');
    }
    return embeds.deny(message, 'Failed to edit webhook message. Please try again.');
  }
}

// List webhooks
async function handleList(client, message, args, guildService) {
  try {
    const webhooks = await guildService.getGuildWebhooks(message.guild.id);

    if (webhooks.length === 0) {
      return embeds.info(message, 'No **webhooks** have been created');
    }

    const config = require('../../../config/setup');
    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setTitle(`${message.guild.name} Webhooks`)
      .setTimestamp();

    let description = '';
    for (const webhook of webhooks) {
      const channel = message.guild.channels.cache.get(webhook.channelId);
      const channelMention = channel ? channel.toString() : `#deleted-channel`;

      // Get user info for display
      let userDisplay = 'Unknown User';
      try {
        const user = await message.client.users.fetch(webhook.createdBy);
        userDisplay = user.username;
      } catch (error) {
        userDisplay = `<@${webhook.createdBy}>`;
      }

      description += `\`${webhook.shortId}\` **\`${webhook.name}\`** for ${channelMention}, by to **${userDisplay}**\n`;
    }

    embed.setDescription(description);
    embed.setFooter({ text: `${webhooks.length} webhook${webhooks.length === 1 ? '' : 's'} total` });

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to list webhooks. Please try again.');
  }
}



// Rename webhook
async function handleRename(client, message, args, guildService) {
  const { runHelpCommand } = require('../../../utils/commandProcessor');
  
  if (args.length < 2) {
    return runHelpCommand(message, 'webhook');
  }

  const identifier = args[0];
  const newName = args.slice(1).join(' ');

  if (newName.length > 80) {
    return embeds.warn(message, 'Webhook name must be **80 characters or less**');
  }

  try {
    const webhook = await findWebhookByIdentifier(guildService, message.guild.id, identifier);

    if (!webhook) {
      return embeds.warn(message, `Webhook **${identifier}** not found`);
    }

    // Check if new name already exists (excluding current webhook)
    const nameExists = await guildService.webhookNameExists(message.guild.id, newName, webhook.webhookId);
    if (nameExists) {
      return embeds.warn(message, `A webhook with the name **${newName}** already exists`);
    }

    // Update the Discord webhook
    const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
    await webhookClient.edit({ name: newName });

    // ⚠️ CRITICAL BUG FIX: Must update webhook within full guild data, not replace entire guild!
    // OLD BROKEN CODE: await guildService.set(webhook.webhookId, webhook);
    // This was overwriting the ENTIRE guild document with just webhook data!
    
    // Get full guild data
    const guildData = await guildService.ensureGuildData(message.guild.id);
    
    // Find and update the webhook in the array
    const webhookIndex = guildData.Webhooks.findIndex(w => w.webhookId === webhook.webhookId);
    if (webhookIndex !== -1) {
      guildData.Webhooks[webhookIndex].name = newName;
      await guildService.set(message.guild.id, guildData);
    }

    return embeds.success(message, `Renamed webhook **\`${webhook.shortId}\`** to **${newName}**!`);

  } catch (error) {
    logger.webhook.error(error, message);
    if (error.code === 10015) {
      return embeds.warn(message, 'Webhook not found or has been deleted');
    }
    if (error.code === 50013) {
      return embeds.warn(message, 'I don\'t have permission to edit this webhook');
    }
    return embeds.deny(message, 'Failed to rename webhook. Please try again.');
  }
}

// Set webhook avatar
async function handleAvatar(client, message, args, guildService) {
  const { runHelpCommand } = require('../../../utils/commandProcessor');
  
  if (args.length < 1) {
    return runHelpCommand(message, 'webhook');
  }

  const identifier = args[0];
  let avatarUrl = args[1];

  // Check for attachment if no URL provided
  if (!avatarUrl && message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (attachment.contentType && attachment.contentType.startsWith('image/')) {
      avatarUrl = attachment.url;
    } else {
      return embeds.warn(message, 'Please provide a valid image attachment or URL');
    }
  }

  if (!avatarUrl) {
    return embeds.warn(message, 'Please provide an **image URL** or attach an image file');
  }

  try {
    const webhook = await findWebhookByIdentifier(guildService, message.guild.id, identifier);

    if (!webhook) {
      return embeds.warn(message, `Webhook **${identifier}** not found`);
    }

    // Validate URL format
    if (!isValidImageUrl(avatarUrl)) {
      return embeds.warn(message, 'Please provide a valid image URL (jpg, jpeg, png, gif, webp)');
    }

    // Update the Discord webhook
    const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
    await webhookClient.edit({ avatar: avatarUrl });

    await guildService.updateWebhookLastUsed(message.guild.id, webhook.webhookId);

    return embeds.success(message, `Updated avatar for webhook **\`${webhook.shortId}\`** (${webhook.name})!`);

  } catch (error) {
    logger.webhook.error(error, message);
    if (error.code === 10015) {
      return embeds.warn(message, 'No **webhooks** have been created');
    }
    if (error.code === 50013) {
      return embeds.warn(message, 'I don\'t have permission to edit this webhook');
    }
    if (error.code === 50035) {
      return embeds.warn(message, 'Invalid image format or URL. Please use a direct image link.');
    }
    return embeds.deny(message, 'Failed to update webhook avatar. Please try again.');
  }
}

// Helper function to validate image URLs
function isValidImageUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const pathname = parsedUrl.pathname.toLowerCase();

    // Check if URL ends with valid image extension or is a Discord CDN link
    return validExtensions.some(ext => pathname.endsWith(ext)) ||
      parsedUrl.hostname.includes('discord') ||
      parsedUrl.hostname.includes('cdn.');
  } catch {
    return false;
  }
}

// Helper function to extract message ID from Discord message link
function extractMessageIdFromLink(link) {
  const regex = /discord\.com\/channels\/\d+\/\d+\/(\d+)/;
  const match = link.match(regex);
  return match ? match[1] : null;
}