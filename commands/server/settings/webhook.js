const { EmbedBuilder, PermissionFlagsBits, WebhookClient } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');
const logger = require('../../../utils/logger');

async function findWebhookByIdentifier(guildService, guildId, identifier) {
  let webhook = null;
  if (/^[a-z0-9]{4}$/i.test(identifier)) {
    webhook = await guildService.getWebhookByShortId(guildId, identifier.toLowerCase());
  }
  if (!webhook) {
    webhook = await guildService.getWebhookByName(guildId, identifier);
  }
  if (!webhook && /^\d{17,19}$/.test(identifier)) {
    webhook = await guildService.getWebhook(identifier);
    if (webhook && webhook.guildId !== guildId) webhook = null;
  }
  return webhook;
}

function isValidImageUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const pathname = parsedUrl.pathname.toLowerCase();
    return validExtensions.some(ext => pathname.endsWith(ext)) || parsedUrl.hostname.includes('discord') || parsedUrl.hostname.includes('cdn.');
  } catch { return false; }
}

function extractMessageIdFromLink(link) {
  const regex = /discord\.com\/channels\/\d+\/\d+\/(\d+)/;
  const match = link.match(regex);
  return match ? match[1] : null;
}

module.exports = {
  name: "webhook",
  description: "Manage webhooks for the server",
  syntax: 'webhook [subcommand] (parameters)',
  example: 'webhook create MyBot',
  permission: "manage_webhooks",
  isGroupCommand: true,

  subcommands: {
    create: {
      name: 'create',
      aliases: [],
      description: 'Create a new webhook in the current channel',
      syntax: '{guildprefix}webhook create [name]',
      parameters: ['name'],
      example: '{guildprefix}webhook create MyBot',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return embeds.warn(message, 'Please provide a **name** for the webhook');

        const webhookName = args.join(' ');
        if (webhookName.length > 80) return embeds.warn(message, 'Webhook name must be **80 characters or less**');

        try {
          const existingWebhook = await guildService.getWebhookByName(message.guild.id, webhookName);
          if (existingWebhook) return embeds.warn(message, `A webhook with the name **${webhookName}** already exists`);

          const webhook = await message.channel.createWebhook({ name: webhookName, reason: `Webhook created by ${message.author.tag}` });
          const webhookData = await guildService.createWebhook(message.guild.id, webhookName, webhook.id, webhook.token, message.channel.id, message.author.id);

          return embeds.success(message, `Created webhook **\`${webhookData.shortId}\`** for ${message.channel}!`);
        } catch (error) {
          logger.webhook.error(error, message);
          if (error.code === 50013) return embeds.warn(message, 'I don\'t have permission to create webhooks in this channel');
          return embeds.deny(message, 'Failed to create webhook. Please check my permissions.');
        }
      }
    },

    delete: {
      name: 'delete',
      aliases: ['remove'],
      description: 'Delete a webhook by ID, name, or short ID',
      syntax: '{guildprefix}webhook delete [webhook_id/name/short_id]',
      parameters: ['webhook_identifier'],
      example: '{guildprefix}webhook delete abc1',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return embeds.warn(message, 'Please provide a **webhook short ID**, **name**, or **webhook ID** to delete');

        const identifier = args.join(' ');

        try {
          const webhook = await findWebhookByIdentifier(guildService, message.guild.id, identifier);
          if (!webhook) return embeds.warn(message, `Webhook **${identifier}** not found`);

          await createConfirmation(
            message,
            `Are you sure you want to **delete** webhook **\`${webhook.shortId}\`** (${webhook.name})?`,
            async (interaction) => {
              try {
                try {
                  const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
                  await webhookClient.destroy();
                } catch (discordError) { }

                await guildService.deleteWebhook(message.guild.id, webhook.webhookId);
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
    },

    send: {
      name: 'send',
      aliases: [],
      description: 'Send a message through a webhook',
      syntax: '{guildprefix}webhook send [webhook_id] [message]',
      parameters: ['webhook_id', 'message'],
      example: '{guildprefix}webhook send abc1 Hello world!',

      handler: async (client, message, args, guildService) => {
        if (args.length < 2) return runHelpCommand(message, 'webhook');

        const webhookIdentifier = args[0];
        const messageContent = args.slice(1).join(' ');

        if (!messageContent) return embeds.warn(message, 'Please provide a **message** or **embed code**');

        try {
          const webhook = await findWebhookByIdentifier(guildService, message.guild.id, webhookIdentifier);
          if (!webhook) return embeds.warn(message, `Webhook **${webhookIdentifier}** not found`);

          const webhookChannel = {
            send: async (options) => {
              const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
              return await webhookClient.send(options);
            }
          };

          await EmbedVariableProcessor.process(webhookChannel, messageContent, { user: message.author, guild: message.guild, channel: message.channel });
          await guildService.updateWebhookLastUsed(message.guild.id, webhook.webhookId);

          return embeds.success(message, `Message sent via webhook **\`${webhook.shortId}\`** (${webhook.name})!`);
        } catch (error) {
          logger.webhook.error(error, message);
          if (error.code === 10015) return embeds.warn(message, 'No **webhooks** have been created');
          return embeds.deny(message, 'Failed to send webhook message. Please try again.');
        }
      }
    },

    edit: {
      name: 'edit',
      aliases: [],
      description: 'Edit a webhook message',
      syntax: '{guildprefix}webhook edit [message_link] [new_message]',
      parameters: ['message_link', 'new_message'],
      example: '{guildprefix}webhook edit https://discord.com/... New content',

      handler: async (client, message, args, guildService) => {
        if (args.length < 2) return runHelpCommand(message, 'webhook');

        const messageLink = args[0];
        const newContent = args.slice(1).join(' ');

        if (!newContent) return embeds.warn(message, 'Please provide a **new message**');

        try {
          const messageId = extractMessageIdFromLink(messageLink);
          if (!messageId) return embeds.warn(message, 'Invalid message link format');

          const guildWebhooks = await guildService.getGuildWebhooks(message.guild.id);

          let targetWebhook = null;
          for (const webhook of guildWebhooks) {
            try {
              const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
              await webhookClient.fetchMessage(messageId);
              targetWebhook = webhook;
              break;
            } catch (error) { continue; }
          }

          if (!targetWebhook) return embeds.warn(message, 'Could not find a webhook that sent this message');

          const webhookClient = new WebhookClient({ id: targetWebhook.webhookId, token: targetWebhook.webhookToken });
          await webhookClient.editMessage(messageId, { content: newContent });
          await guildService.updateWebhookLastUsed(message.guild.id, targetWebhook.webhookId);

          return embeds.success(message, `Message edited via webhook **\`${targetWebhook.shortId}\`** (${targetWebhook.name})!`);
        } catch (error) {
          logger.webhook.error(error, message);
          if (error.code === 10008) return embeds.warn(message, 'Message not found or not sent by a webhook');
          return embeds.deny(message, 'Failed to edit webhook message. Please try again.');
        }
      }
    },

    rename: {
      name: 'rename',
      aliases: [],
      description: 'Rename a webhook',
      syntax: '{guildprefix}webhook rename [webhook_id] [new_name]',
      parameters: ['webhook_id', 'new_name'],
      example: '{guildprefix}webhook rename abc1 NewName',

      handler: async (client, message, args, guildService) => {
        if (args.length < 2) return runHelpCommand(message, 'webhook');

        const identifier = args[0];
        const newName = args.slice(1).join(' ');

        if (newName.length > 80) return embeds.warn(message, 'Webhook name must be **80 characters or less**');

        try {
          const webhook = await findWebhookByIdentifier(guildService, message.guild.id, identifier);
          if (!webhook) return embeds.warn(message, `Webhook **${identifier}** not found`);

          const nameExists = await guildService.webhookNameExists(message.guild.id, newName, webhook.webhookId);
          if (nameExists) return embeds.warn(message, `A webhook with the name **${newName}** already exists`);

          const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
          await webhookClient.edit({ name: newName });

          const guildData = await guildService.ensureGuildData(message.guild.id);
          const webhookIndex = guildData.Webhooks.findIndex(w => w.webhookId === webhook.webhookId);
          if (webhookIndex !== -1) {
            guildData.Webhooks[webhookIndex].name = newName;
            await guildService.set(message.guild.id, guildData);
          }

          return embeds.success(message, `Renamed webhook **\`${webhook.shortId}\`** to **${newName}**!`);
        } catch (error) {
          logger.webhook.error(error, message);
          if (error.code === 10015) return embeds.warn(message, 'Webhook not found or has been deleted');
          if (error.code === 50013) return embeds.warn(message, 'I don\'t have permission to edit this webhook');
          return embeds.deny(message, 'Failed to rename webhook. Please try again.');
        }
      }
    },

    avatar: {
      name: 'avatar',
      aliases: [],
      description: 'Set a webhook\'s avatar',
      syntax: '{guildprefix}webhook avatar [webhook_id] [image_url]',
      parameters: ['webhook_id', 'image_url'],
      example: '{guildprefix}webhook avatar abc1 https://example.com/image.png',

      handler: async (client, message, args, guildService) => {
        if (args.length < 1) return runHelpCommand(message, 'webhook');

        const identifier = args[0];
        let avatarUrl = args[1];

        if (!avatarUrl && message.attachments.size > 0) {
          const attachment = message.attachments.first();
          if (attachment.contentType && attachment.contentType.startsWith('image/')) {
            avatarUrl = attachment.url;
          } else {
            return embeds.warn(message, 'Please provide a valid image attachment or URL');
          }
        }

        if (!avatarUrl) return embeds.warn(message, 'Please provide an **image URL** or attach an image file');

        try {
          const webhook = await findWebhookByIdentifier(guildService, message.guild.id, identifier);
          if (!webhook) return embeds.warn(message, `Webhook **${identifier}** not found`);

          if (!isValidImageUrl(avatarUrl)) return embeds.warn(message, 'Please provide a valid image URL');

          const webhookClient = new WebhookClient({ id: webhook.webhookId, token: webhook.webhookToken });
          await webhookClient.edit({ avatar: avatarUrl });
          await guildService.updateWebhookLastUsed(message.guild.id, webhook.webhookId);

          return embeds.success(message, `Updated avatar for webhook **\`${webhook.shortId}\`** (${webhook.name})!`);
        } catch (error) {
          logger.webhook.error(error, message);
          if (error.code === 10015) return embeds.warn(message, 'No **webhooks** have been created');
          if (error.code === 50013) return embeds.warn(message, 'I don\'t have permission to edit this webhook');
          if (error.code === 50035) return embeds.warn(message, 'Invalid image format or URL.');
          return embeds.deny(message, 'Failed to update webhook avatar. Please try again.');
        }
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all webhooks in the server',
      syntax: '{guildprefix}webhook list',
      parameters: [],
      example: '{guildprefix}webhook list',

      handler: async (client, message, args, guildService) => {
        try {
          const webhooks = await guildService.getGuildWebhooks(message.guild.id);

          if (webhooks.length === 0) return embeds.info(message, 'No **webhooks** have been created');

          const embed = new EmbedBuilder()
            .setColor(config.colors.embed)
            .setTitle(`${message.guild.name} Webhooks`)
            .setTimestamp();

          let description = '';
          for (const webhook of webhooks) {
            const channel = message.guild.channels.cache.get(webhook.channelId);
            const channelMention = channel ? channel.toString() : `#deleted-channel`;

            let userDisplay = 'Unknown User';
            try {
              const user = await message.client.users.fetch(webhook.createdBy);
              userDisplay = user.username;
            } catch (error) {
              userDisplay = `<@${webhook.createdBy}>`;
            }

            description += `\`${webhook.shortId}\` **\`${webhook.name}\`** for ${channelMention}, by **${userDisplay}**\n`;
          }

          embed.setDescription(description);
          embed.setFooter({ text: `${webhooks.length} webhook${webhooks.length === 1 ? '' : 's'} total` });

          return message.channel.send({ embeds: [embed] });
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to list webhooks. Please try again.');
        }
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'webhook');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'webhook');
  }
};
