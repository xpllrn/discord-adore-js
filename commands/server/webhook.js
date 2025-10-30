const { EmbedBuilder, PermissionFlagsBits, WebhookClient } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasDiscordPermission } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { getService } = require('@services');

module.exports = {
  name: "webhook",
  description: "Manage webhooks for the server",
  isGroupCommand: true,
  run: async (client, message, args) => {
    const webhookService = getService('webhook');
    const subcommand = args[0]?.toLowerCase();

    // If no subcommand provided, show help
    if (!subcommand) {
      return runHelpCommand(message, 'webhook');
    }

    // All webhook commands require Manage Webhooks permission
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageWebhooks, 'Manage Webhooks')) return;

    switch (subcommand) {
      case 'create':
        return await handleCreate(client, message, args.slice(1), webhookService);
      case 'delete':
      case 'remove':
        return await handleDelete(client, message, args.slice(1), webhookService);
      case 'send':
        return await handleSend(client, message, args.slice(1), webhookService);
      case 'edit':
        return await handleEdit(client, message, args.slice(1), webhookService);
      case 'rename':
        return await handleRename(client, message, args.slice(1), webhookService);
      case 'avatar':
        return await handleAvatar(client, message, args.slice(1), webhookService);
      case 'list':
        return await handleList(client, message, args.slice(1), webhookService);
      default:
        return runHelpCommand(message, 'webhook');
    }
  }
};

// Create webhook
async function handleCreate(client, message, args, webhookService) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **name** for the webhook');
  }

  const webhookName = args.join(' ');
  if (webhookName.length > 80) {
    return embeds.warn(message, 'Webhook name must be **80 characters or less**');
  }

  try {
    // Check if webhook name already exists
    const existingWebhook = await webhookService.getWebhookByName(message.guild.id, webhookName);
    if (existingWebhook) {
      return embeds.warn(message, `A webhook with the name **${webhookName}** already exists`);
    }

    // Create the Discord webhook
    const webhook = await message.channel.createWebhook({
      name: webhookName,
      reason: `Webhook created by ${message.author.tag}`
    });

    // Save to database
    const webhookData = await webhookService.createWebhook(
      message.guild.id,
      webhookName,
      webhook.id,
      webhook.token,
      message.channel.id,
      message.author.id
    );

    return embeds.success(message, `Created webhook **\`${webhookData.shortId}\`** for ${message.channel}!`);

  } catch (error) {
    console.error('Error creating webhook:', error);
    if (error.code === 50013) {
      return embeds.warn(message, 'I don\'t have permission to create webhooks in this channel');
    }
    return embeds.deny(message, 'Failed to create webhook. Please check my permissions.');
  }
}

// Helper function to find webhook by identifier (short ID, name, or full ID)
async function findWebhookByIdentifier(webhookService, guildId, identifier) {
  let webhook = null;

  // Try short ID first (4 characters, alphanumeric)
  if (/^[a-z0-9]{4}$/i.test(identifier)) {
    webhook = await webhookService.getWebhookByShortId(guildId, identifier.toLowerCase());
  }

  // If not found, try by name
  if (!webhook) {
    webhook = await webhookService.getWebhookByName(guildId, identifier);
  }

  // If still not found, try by full Discord ID
  if (!webhook && /^\d{17,19}$/.test(identifier)) {
    webhook = await webhookService.getWebhook(identifier);
    if (webhook && webhook.guildId !== guildId) {
      webhook = null; // Security check - webhook exists but not in this guild
    }
  }

  return webhook;
}

// Delete webhook
async function handleDelete(client, message, args, webhookService) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **webhook short ID**, **name**, or **webhook ID** to delete');
  }

  const identifier = args.join(' ');

  try {
    const webhook = await findWebhookByIdentifier(webhookService, message.guild.id, identifier);

    if (!webhook) {
      return embeds.warn(message, `Webhook **${identifier}** not found`);
    }

    // Try to delete the Discord webhook
    try {
      const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
      await webhookClient.destroy();
    } catch (discordError) {
      // Webhook might already be deleted on Discord, continue with database cleanup
      console.log('Discord webhook already deleted or inaccessible:', discordError.message);
    }

    // Remove from database
    await webhookService.deleteWebhook(webhook.webhookId);

    return embeds.success(message, `Deleted webhook **\`${webhook.shortId}\`** (${webhook.name})!`);

  } catch (error) {
    console.error('Error deleting webhook:', error);
    return embeds.deny(message, 'Failed to delete webhook. Please try again.');
  }
}

// Send message via webhook
async function handleSend(client, message, args, webhookService) {
  if (args.length < 2) {
    return embeds.warn(message, 'Usage: `webhook send <webhook_id> <message> [--add <embed_code>]`');
  }

  const webhookIdentifier = args[0];
  let messageContent = '';
  let embedCode = '';
  let addFlag = false;

  // Parse arguments for --add flag
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--add' && args[i + 1]) {
      addFlag = true;
      embedCode = args.slice(i + 1).join(' ');
      break;
    } else if (!addFlag) {
      messageContent += args[i] + ' ';
    }
  }

  messageContent = messageContent.trim();

  if (!messageContent && !embedCode) {
    return embeds.warn(message, 'Please provide a **message** or **embed code**');
  }

  try {
    const webhook = await findWebhookByIdentifier(webhookService, message.guild.id, webhookIdentifier);
    if (!webhook) {
      return embeds.warn(message, `Webhook **${webhookIdentifier}** not found`);
    }

    const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });

    const payload = {};
    if (messageContent) payload.content = messageContent;

    // Parse embed code if provided
    if (embedCode) {
      try {
        const embedData = parseEmbedCode(embedCode);
        payload.embeds = [embedData];
      } catch (embedError) {
        return embeds.warn(message, `Invalid embed code: ${embedError.message}`);
      }
    }

    await webhookClient.send(payload);
    await webhookService.updateLastUsed(webhook.webhookId);

    return embeds.success(message, `Message sent via webhook **\`${webhook.shortId}\`** (${webhook.name})!`);

  } catch (error) {
    console.error('Error sending webhook message:', error);
    if (error.code === 10015) {
      return embeds.warn(message, 'Webhook not found or has been deleted');
    }
    return embeds.deny(message, 'Failed to send webhook message. Please try again.');
  }
}

// Edit webhook message
async function handleEdit(client, message, args, webhookService) {
  if (args.length < 2) {
    return embeds.warn(message, 'Usage: `webhook edit <message_link> <new_message> [--add <embed_code>]`');
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
    const guildWebhooks = await webhookService.getGuildWebhooks(message.guild.id);
    
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
    await webhookService.updateLastUsed(targetWebhook.webhookId);

    return embeds.success(message, `Message edited via webhook **\`${targetWebhook.shortId}\`** (${targetWebhook.name})!`);

  } catch (error) {
    console.error('Error editing webhook message:', error);
    if (error.code === 10008) {
      return embeds.warn(message, 'Message not found or not sent by a webhook');
    }
    return embeds.deny(message, 'Failed to edit webhook message. Please try again.');
  }
}

// List webhooks
async function handleList(client, message, args, webhookService) {
  try {
    const webhooks = await webhookService.getGuildWebhooks(message.guild.id);

    if (webhooks.length === 0) {
      return embeds.info(message, 'No webhooks found in this server');
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Webhooks in ${message.guild.name}`)
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

      const lastUsed = webhook.lastUsed ? `<t:${Math.floor(webhook.lastUsed.getTime() / 1000)}:R>` : 'Never';

      description += `Webhook \`${webhook.shortId}\` **\`${webhook.name}\`** for ${channelMention}, belongs to ${userDisplay}\n`;
      description += `• Last used: ${lastUsed}\n\n`;
    }

    embed.setDescription(description);
    embed.setFooter({ text: `${webhooks.length} webhook${webhooks.length === 1 ? '' : 's'} total` });

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Error listing webhooks:', error);
    return embeds.deny(message, 'Failed to list webhooks. Please try again.');
  }
}

// Helper function to parse embed code
function parseEmbedCode(embedCode) {
  try {
    // Simple embed code parser - expects JSON format
    const embedData = JSON.parse(embedCode);
    
    // Validate required fields and limits
    if (embedData.title && embedData.title.length > 256) {
      throw new Error('Title must be 256 characters or less');
    }
    if (embedData.description && embedData.description.length > 4096) {
      throw new Error('Description must be 4096 characters or less');
    }
    if (embedData.fields && embedData.fields.length > 25) {
      throw new Error('Maximum 25 fields allowed');
    }

    return embedData;
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
}

// Rename webhook
async function handleRename(client, message, args, webhookService) {
  if (args.length < 2) {
    return embeds.warn(message, 'Usage: `webhook rename <webhook_id> <new_name>`');
  }

  const identifier = args[0];
  const newName = args.slice(1).join(' ');

  if (newName.length > 80) {
    return embeds.warn(message, 'Webhook name must be **80 characters or less**');
  }

  try {
    const webhook = await findWebhookByIdentifier(webhookService, message.guild.id, identifier);

    if (!webhook) {
      return embeds.warn(message, `Webhook **${identifier}** not found`);
    }

    // Check if new name already exists (excluding current webhook)
    const nameExists = await webhookService.webhookNameExists(message.guild.id, newName, webhook.webhookId);
    if (nameExists) {
      return embeds.warn(message, `A webhook with the name **${newName}** already exists`);
    }

    // Update the Discord webhook
    const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
    await webhookClient.edit({ name: newName });

    // Update in database
    webhook.name = newName;
    await webhookService.set(webhook.webhookId, webhook);

    return embeds.success(message, `Renamed webhook **\`${webhook.shortId}\`** to **${newName}**!`);

  } catch (error) {
    console.error('Error renaming webhook:', error);
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
async function handleAvatar(client, message, args, webhookService) {
  if (args.length < 1) {
    return embeds.warn(message, 'Usage: `webhook avatar <webhook_id> <image_url>` or attach an image');
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
    const webhook = await findWebhookByIdentifier(webhookService, message.guild.id, identifier);

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

    await webhookService.updateLastUsed(webhook.webhookId);

    return embeds.success(message, `Updated avatar for webhook **\`${webhook.shortId}\`** (${webhook.name})!`);

  } catch (error) {
    console.error('Error setting webhook avatar:', error);
    if (error.code === 10015) {
      return embeds.warn(message, 'Webhook not found or has been deleted');
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