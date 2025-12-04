const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { colors, emojis } = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

// Cooldown map for ticket message command (1 minute)
const ticketMessageCooldowns = new Map();

// Helper function to process custom ticket message
async function processCustomTicketMessage(customMessage, guild, client) {
  const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');

  const processedContent = EmbedVariableProcessor.replaceVariables(customMessage, {
    guild: guild,
    server: guild
  });

  if (processedContent.trim().startsWith('{embed}')) {
    const embedContent = processedContent.replace(/^\s*{embed}\s*\$v\s*/, '');
    const embed = new EmbedBuilder().setColor(colors.info);
    let content = null;

    const parts = embedContent.split('$v');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || !trimmed.startsWith('{') || !trimmed.endsWith('}')) continue;

      const paramContent = trimmed.slice(1, -1);
      const colonIndex = paramContent.indexOf(':');
      if (colonIndex === -1) continue;

      const paramName = paramContent.substring(0, colonIndex).trim();
      const paramValue = paramContent.substring(colonIndex + 1).trim();

      switch (paramName) {
        case 'title': embed.setTitle(paramValue); break;
        case 'description': embed.setDescription(paramValue); break;
        case 'color': embed.setColor(paramValue); break;
        case 'thumbnail': embed.setThumbnail(paramValue); break;
        case 'image': embed.setImage(paramValue); break;
        case 'content':
        case 'message': content = paramValue; break;
      }
    }
    return { embeds: [embed], content };
  }
  return { content: processedContent };
}

// Helper function to update ticket setup message
async function updateTicketSetupMessage(client, guild, ticketSystem, customMessage) {
  try {
    const setupChannel = guild.channels.cache.get(ticketSystem.setupChannelId);
    if (!setupChannel) {
      const guildService = getService('guild');
      await guildService.setTicketSetup(guild.id, null, null);
      return;
    }

    let setupMessage;
    try {
      setupMessage = await setupChannel.messages.fetch(ticketSystem.setupMessageId);
    } catch (error) {
      const guildService = getService('guild');
      await guildService.setTicketSetup(guild.id, null, null);
      return;
    }
    
    if (!setupMessage) return;

    let embed;
    let content = null;

    if (customMessage) {
      const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
      if (customMessage.trim().startsWith('{embed}')) {
        const processedMessage = await processCustomTicketMessage(customMessage, guild, client);
        if (processedMessage.embeds && processedMessage.embeds.length > 0) {
          embed = processedMessage.embeds[0];
        }
        if (processedMessage.content) {
          content = processedMessage.content;
        }
      } else {
        const processedText = EmbedVariableProcessor.replaceVariables(customMessage, {
          guild: guild,
          server: guild
        });
        content = processedText;
      }
    } else {
      embed = new EmbedBuilder()
        .setTitle('Create a ticket')
        .setDescription('Please select your inquiry below.\nDo **not** create a ticket and suddenly go offline.\n> Refer to [nohello.net](https://nohello.net/)')
        .setColor(colors.info)
        .setThumbnail(client.user.displayAvatarURL());
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setEmoji(emojis.ticket)
          .setStyle(ButtonStyle.Secondary)
      );

    const messageOptions = { components: [row] };
    if (embed) messageOptions.embeds = [embed];
    if (content) messageOptions.content = content;

    await setupMessage.edit(messageOptions);
  } catch (error) {
    logger.webhook.error(error);
  }
}

module.exports = {
  name: "ticket",
  aliases: ['tickets'],
  description: "Manage the ticket system for your server",
  syntax: 'ticket [subcommand] (parameters)',
  example: 'ticket setup',
  permission: "manage_guild",
  isGroupCommand: true,

  subcommands: {
    setup: {
      name: 'setup',
      aliases: [],
      description: 'Create ticket system',
      syntax: '{guildprefix}ticket setup',
      parameters: [],
      example: '{guildprefix}ticket setup',
      handler: async (client, message, args, guildService) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);

        if (ticketSystem.enabled && ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
          try {
            const setupChannel = message.guild.channels.cache.get(ticketSystem.setupChannelId);
            if (setupChannel) {
              const setupMessage = await setupChannel.messages.fetch(ticketSystem.setupMessageId);
              if (setupMessage) {
                return embeds.deny(message, `Ticket system is already set up in ${setupChannel}! Use \`,ticket reset\` to recreate it.`);
              }
            }
          } catch (error) { /* Message doesn't exist, continue */ }
        }

        const customMessage = await guildService.getTicketCustomMessage(message.guild.id);
        let embed;
        let content = null;

        if (customMessage) {
          const processedMessage = await processCustomTicketMessage(customMessage, message.guild, client);
          if (processedMessage.embeds && processedMessage.embeds.length > 0) embed = processedMessage.embeds[0];
          if (processedMessage.content) content = processedMessage.content;
        } else {
          embed = new EmbedBuilder()
            .setTitle('Create a ticket')
            .setDescription('Please select your inquiry below.\nDo **not** create a ticket and suddenly go offline.\n> Refer to [nohello.net](https://nohello.net/)')
            .setColor(colors.info)
            .setThumbnail(client.user.displayAvatarURL());
        }

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('create_ticket')
              .setLabel('Create Ticket')
              .setEmoji(emojis.ticket)
              .setStyle(ButtonStyle.Secondary)
          );

        const messageOptions = { components: [row] };
        if (embed) messageOptions.embeds = [embed];
        if (content) messageOptions.content = content;

        const setupMessage = await message.channel.send(messageOptions);
        await guildService.enableTicketSystem(message.guild.id);
        await guildService.setTicketSetup(message.guild.id, message.channel.id, setupMessage.id);

        return embeds.success(message, "Ticket system has been set up successfully!");
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset ticket system',
      syntax: '{guildprefix}ticket reset',
      parameters: [],
      example: '{guildprefix}ticket reset',
      handler: async (client, message, args, guildService) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);
        if (!ticketSystem.enabled) {
          return embeds.deny(message, "No ticket system is currently set up. Use `,ticket setup` to create one.");
        }

        if (ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
          try {
            const setupChannel = message.guild.channels.cache.get(ticketSystem.setupChannelId);
            if (setupChannel) {
              const setupMessage = await setupChannel.messages.fetch(ticketSystem.setupMessageId);
              if (setupMessage) await setupMessage.delete();
            }
          } catch (error) { /* Message might already be deleted */ }
        }

        await guildService.setTicketSetup(message.guild.id, null, null);
        return embeds.success(message, "Ticket system has been reset successfully! Use `,ticket setup` to create a new one.");
      }
    },

    category: {
      name: 'category',
      aliases: [],
      description: 'Set ticket category',
      syntax: '{guildprefix}ticket category [category]',
      parameters: ['category'],
      example: '{guildprefix}ticket category Support',
      handler: async (client, message, args, guildService) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

        if (!args[0]) {
          const ticketSystem = await guildService.getTicketSystem(message.guild.id);
          if (ticketSystem.categoryId) {
            const category = message.guild.channels.cache.get(ticketSystem.categoryId);
            const categoryName = category ? category.name : 'Unknown Category';
            return embeds.info(message, `Current ticket category: **${categoryName}**\n\nUse \`,ticket category [category]\` to change it.`);
          }
          return embeds.info(message, "No ticket category is currently set.\n\nUse \`,ticket category [category]\` to set one.");
        }

        if (args[0].toLowerCase() === 'none') {
          await guildService.setTicketCategory(message.guild.id, null);
          return embeds.success(message, "Ticket category has been removed.");
        }

        const categoryResult = findChannel(message.guild, args.join(' '));
        if (!categoryResult.found || !categoryResult.channel || categoryResult.channel.type !== 4) {
          return embeds.deny(message, "I couldn't find that category.");
        }

        await guildService.setTicketCategory(message.guild.id, categoryResult.channel.id);
        return embeds.success(message, `Ticket category has been set to **${categoryResult.channel.name}**.`);
      }
    },

    add: {
      name: 'add',
      aliases: [],
      description: 'Add user to current ticket',
      syntax: '{guildprefix}ticket add [@user]',
      parameters: ['user'],
      example: '{guildprefix}ticket add @vwsn',
      handler: async (client, message, args, guildService) => {
        const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
        if (!ticket) return embeds.deny(message, "This command can only be used in ticket channels.");
        if (!args[0]) return runHelpCommand(message, 'ticket');

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);
        const isTicketOwner = ticket.userId === message.author.id;
        const hasAdminPerms = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

        if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
          return embeds.deny(message, "You don't have permission to add users to this ticket.");
        }

        const { findUser } = require('../../../handlers/finder');
        const userResult = await findUser(message.guild, args.join(' '));
        if (!userResult.found || !userResult.user) {
          return embeds.deny(message, "I couldn't find that user.");
        }

        await message.channel.permissionOverwrites.edit(userResult.user.id, {
          ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true
        });

        return embeds.success(message, `**${userResult.user.displayName}** has been added to this ticket.`);
      }
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove user from current ticket',
      syntax: '{guildprefix}ticket remove [@user]',
      parameters: ['user'],
      example: '{guildprefix}ticket remove @vwsn',
      handler: async (client, message, args, guildService) => {
        const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
        if (!ticket) return embeds.deny(message, "This command can only be used in ticket channels.");
        if (!args[0]) return runHelpCommand(message, 'ticket');

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);
        const isTicketOwner = ticket.userId === message.author.id;
        const hasAdminPerms = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

        if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
          return embeds.deny(message, "You don't have permission to remove users from this ticket.");
        }

        const { findUser } = require('../../../handlers/finder');
        const userResult = await findUser(message.guild, args.join(' '));
        if (!userResult.found || !userResult.user) return embeds.deny(message, "I couldn't find that user.");
        if (userResult.user.id === ticket.userId) return embeds.deny(message, "You cannot remove the ticket creator.");
        if (userResult.user.id === message.client.user.id) return embeds.deny(message, "You cannot remove the bot.");

        await message.channel.permissionOverwrites.delete(userResult.user.id);
        return embeds.success(message, `**${userResult.user.displayName}** has been removed from this ticket.`);
      }
    },

    close: {
      name: 'close',
      aliases: [],
      description: 'Close current ticket',
      syntax: '{guildprefix}ticket close',
      parameters: [],
      example: '{guildprefix}ticket close',
      handler: async (client, message, args, guildService) => {
        const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
        if (!ticket) return embeds.deny(message, "This command can only be used in ticket channels.");
        if (ticket.status === 'closed') return embeds.deny(message, "This ticket is already closed. Use `,ticket open` to reopen it.");

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);
        const isTicketOwner = ticket.userId === message.author.id;
        const hasAdminPerms = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

        if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
          return embeds.deny(message, "You don't have permission to close this ticket.");
        }

        await guildService.closeTicket(message.guild.id, message.channel.id, message.author.id);
        await message.channel.permissionOverwrites.edit(ticket.userId, {
          ViewChannel: false, SendMessages: false, ReadMessageHistory: false, AttachFiles: false, EmbedLinks: false
        });

        return embeds.success(message, `This ticket has been closed by ${message.author}.`);
      }
    },

    open: {
      name: 'open',
      aliases: [],
      description: 'Reopen current ticket',
      syntax: '{guildprefix}ticket open',
      parameters: [],
      example: '{guildprefix}ticket open',
      handler: async (client, message, args, guildService) => {
        const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
        if (!ticket) return embeds.deny(message, "This command can only be used in ticket channels.");
        if (ticket.status === 'open') return embeds.deny(message, "This ticket is already open.");

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);
        const hasAdminPerms = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

        if (!hasAdminPerms && !hasSupportRole) {
          return embeds.deny(message, "You don't have permission to reopen this ticket.");
        }

        await guildService.reopenTicket(message.guild.id, message.channel.id);
        await message.channel.permissionOverwrites.edit(ticket.userId, {
          ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true
        });

        return embeds.success(message, `This ticket has been reopened by ${message.author}.`);
      }
    },

    rename: {
      name: 'rename',
      aliases: [],
      description: 'Rename current ticket',
      syntax: '{guildprefix}ticket rename [name]',
      parameters: ['name'],
      example: '{guildprefix}ticket rename Bug Report',
      handler: async (client, message, args, guildService) => {
        const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
        if (!ticket) return embeds.deny(message, "This command can only be used in ticket channels.");
        if (!args[0]) return runHelpCommand(message, 'ticket');

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);
        const isTicketOwner = ticket.userId === message.author.id;
        const hasAdminPerms = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

        if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
          return embeds.deny(message, "You don't have permission to rename this ticket.");
        }

        const newName = args.join(' ').toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const finalName = `ticket-${newName}`;
        await message.channel.setName(finalName);
        return embeds.success(message, `Ticket has been renamed to **${finalName}**.`);
      }
    },

    support: {
      name: 'support',
      aliases: [],
      description: 'Set support role',
      syntax: '{guildprefix}ticket support [@role/none]',
      parameters: ['role'],
      example: '{guildprefix}ticket support @Support',
      handler: async (client, message, args, guildService) => {
        const ticketSystem = await guildService.getTicketSystem(message.guild.id);

        if (!args[0]) {
          if (!ticketSystem.supportRoleId) {
            return embeds.info(message, "No support role is currently set. Use `,ticket support @role` to set one.");
          }
          const supportRole = message.guild.roles.cache.get(ticketSystem.supportRoleId);
          return embeds.info(message, `Current support role: **${supportRole ? supportRole.name : 'Unknown Role'}**`);
        }

        if (args[0].toLowerCase() === 'none') {
          await guildService.setTicketSupportRole(message.guild.id, null);
          return embeds.success(message, "Support role has been removed.");
        }

        const { findRole } = require('../../../handlers/finder');
        const roleResult = findRole(message.guild, args.join(' '));
        if (!roleResult.found || !roleResult.role) return embeds.deny(message, "I couldn't find that role.");

        await guildService.setTicketSupportRole(message.guild.id, roleResult.role.id);
        return embeds.success(message, `**${roleResult.role.name}** has been set as the support role.`);
      }
    },

    message: {
      name: 'message',
      aliases: [],
      description: 'Set custom ticket setup message',
      syntax: '{guildprefix}ticket message [custom message/remove/none]',
      parameters: ['message'],
      example: '{guildprefix}ticket message {embed}$v{title: Support Tickets}$v{description: Need help? Create a ticket below!}',
      handler: async (client, message, args, guildService) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

        const cooldownKey = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();
        const cooldownAmount = 60 * 1000;

        if (ticketMessageCooldowns.has(cooldownKey)) {
          const expirationTime = ticketMessageCooldowns.get(cooldownKey) + cooldownAmount;
          if (now < expirationTime) {
            const timeLeft = Math.ceil((expirationTime - now) / 1000);
            return embeds.cooldown(message, `Please wait **${timeLeft}** seconds before using this command again.`);
          }
        }

        const ticketSystem = await guildService.getTicketSystem(message.guild.id);

        if (!args[0]) {
          const currentMessage = await guildService.getTicketCustomMessage(message.guild.id);
          if (currentMessage) {
            return embeds.info(message, `**Current custom ticket message:**\n\`\`\`\n${currentMessage}\`\`\`\n\nUse \`,ticket message remove\` to use the default message.`);
          }
          return embeds.info(message, "No custom ticket message is set.\n\nUse \`,ticket message [custom message]\` to set one.");
        }

        const customMessage = args.join(' ');

        if (customMessage.toLowerCase() === 'remove' || customMessage.toLowerCase() === 'none') {
          await guildService.removeTicketCustomMessage(message.guild.id);
          if (ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
            await updateTicketSetupMessage(client, message.guild, ticketSystem, null);
          }
          ticketMessageCooldowns.set(cooldownKey, now);
          setTimeout(() => ticketMessageCooldowns.delete(cooldownKey), cooldownAmount);
          return embeds.success(message, "Custom ticket message has been removed.");
        }

        await guildService.setTicketCustomMessage(message.guild.id, customMessage);
        if (ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
          await updateTicketSetupMessage(client, message.guild, ticketSystem, customMessage);
        }
        ticketMessageCooldowns.set(cooldownKey, now);
        setTimeout(() => ticketMessageCooldowns.delete(cooldownKey), cooldownAmount);
        return embeds.success(message, "Custom ticket message has been set successfully!");
      }
    },

    variables: {
      name: 'variables',
      aliases: [],
      description: 'Show available variables for ticket messages',
      syntax: '{guildprefix}ticket variables',
      parameters: [],
      example: '{guildprefix}ticket variables',
      handler: async (client, message, args, guildService) => {
        const embed = new EmbedBuilder()
          .setColor(colors.info)
          .setTitle('Ticket Message Variables')
          .setDescription(`\`{guild.name}\` — ${message.guild.name}\n\`{guild.membercount}\` — ${message.guild.memberCount}\n\`{guild.id}\` — ${message.guild.id}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\n**Note:** The Create Ticket button will always be added automatically.`);

        return message.channel.send({ embeds: [embed] });
      }
    }
  },

  run: async (client, message, args) => {
    await ensureGuildData(message.guild.id);
    const guildService = getService('guild');

    if (!args[0]) {
      return runHelpCommand(message, 'ticket');
    }

    const sub = args[0].toLowerCase();

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      try {
        return await subcommand.handler(client, message, args.slice(1), guildService);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, "An error occurred while executing the command. Please try again.");
      }
    }

    return runHelpCommand(message, 'ticket');
  }
};
