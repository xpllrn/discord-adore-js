const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { colors, emojis } = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { hasDiscordPermission } = require('../../utils/permissions');
const { findChannel, findRole } = require('../../handlers/finder');
const { getService } = require('@services');
const logger = require('../../utils/logger');

// Cooldown map for ticket message command (1 minute)
const ticketMessageCooldowns = new Map();

module.exports = {
  name: "ticket",
  aliases: ['tickets'],
  description: "Manage the ticket system for your server",
  permission: "Manage Guild",
  isGroupCommand: true,
  run: async(client, message, args) => {

    await ensureGuildData(message.guild.id);

    if (!args[0]) {
      return runHelpCommand(message, 'ticket');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'setup': {
        const subcommandInfo = {
          description: 'Create ticket system',
          usage: '{guildprefix}ticket setup',
          aliases: [],
          parameters: [],
          example: '{guildprefix}ticket setup'
        };
        return handleSetup(client, message, args);
      }
      case 'reset': {
        const subcommandInfo = {
          description: 'Reset ticket system',
          usage: '{guildprefix}ticket reset',
          aliases: [],
          parameters: [],
          example: '{guildprefix}ticket reset'
        };
        return handleReset(client, message, args);
      }
      case 'category': {
        const subcommandInfo = {
          description: 'Set ticket category',
          usage: '{guildprefix}ticket category [category]',
          aliases: [],
          parameters: ['category'],
          example: '{guildprefix}ticket category Support'
        };
        return handleCategory(client, message, args);
      }
      case 'add': {
        const subcommandInfo = {
          description: 'Add user to current ticket',
          usage: '{guildprefix}ticket add [@user]',
          aliases: [],
          parameters: ['user'],
          example: '{guildprefix}ticket add @vwsn'
        };
        return handleAddUser(client, message, args);
      }
      case 'remove': {
        const subcommandInfo = {
          description: 'Remove user from current ticket',
          usage: '{guildprefix}ticket remove [@user]',
          aliases: [],
          parameters: ['user'],
          example: '{guildprefix}ticket remove @vwsn'
        };
        return handleRemoveUser(client, message, args);
      }
      case 'close': {
        const subcommandInfo = {
          description: 'Close current ticket',
          usage: '{guildprefix}ticket close',
          aliases: [],
          parameters: [],
          example: '{guildprefix}ticket close'
        };
        return handleClose(client, message, args);
      }
      case 'open': {
        const subcommandInfo = {
          description: 'Reopen current ticket',
          usage: '{guildprefix}ticket open',
          aliases: [],
          parameters: [],
          example: '{guildprefix}ticket open'
        };
        return handleOpen(client, message, args);
      }
      case 'rename': {
        const subcommandInfo = {
          description: 'Rename current ticket',
          usage: '{guildprefix}ticket rename [name]',
          aliases: [],
          parameters: ['name'],
          example: '{guildprefix}ticket rename Bug Report'
        };
        return handleRename(client, message, args);
      }
      case 'support': {
        const subcommandInfo = {
          description: 'Set support role',
          usage: '{guildprefix}ticket support [@role/none]',
          aliases: [],
          parameters: ['role'],
          example: '{guildprefix}ticket support @Support'
        };
        return handleSupport(client, message, args);
      }
      case 'message': {
        const subcommandInfo = {
          description: 'Set custom ticket setup message',
          usage: '{guildprefix}ticket message [custom message/remove/none]',
          aliases: [],
          parameters: ['message'],
          example: '{guildprefix}ticket message {embed}$v{title: Support Tickets}$v{description: Need help? Create a ticket below!}'
        };
        return handleMessage(client, message, args);
      }

      case 'variables': {
        const subcommandInfo = {
          description: 'Show available variables for ticket messages',
          usage: '{guildprefix}ticket variables',
          aliases: [],
          parameters: [],
          example: '{guildprefix}ticket variables'
        };
        return handleVariables(client, message, args);
      }
      default:
        return runHelpCommand(message, 'ticket');
    }
  }
};

async function handleSetup(client, message, args) {
  try {
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

    const guildService = getService('guild');
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);

    // Check if there's an existing setup and if the message still exists
    if (ticketSystem.enabled && ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
      try {
        const setupChannel = message.guild.channels.cache.get(ticketSystem.setupChannelId);
        if (setupChannel) {
          const setupMessage = await setupChannel.messages.fetch(ticketSystem.setupMessageId);
          if (setupMessage) {
            return embeds.deny(message, `Ticket system is already set up in ${setupChannel}! Use \`,ticket reset\` to recreate it or other subcommands to manage it.`);
          }
        }
      } catch (error) {
        // Message doesn't exist anymore, continue with setup
      }
    }

    // Check for custom message
    const customMessage = await guildService.getTicketCustomMessage(message.guild.id);
    
    let embed;
    let content = null;

    if (customMessage) {
      // Use custom message
      const processedMessage = await processCustomTicketMessage(customMessage, message.guild, client);
      if (processedMessage.embeds && processedMessage.embeds.length > 0) {
        embed = processedMessage.embeds[0];
      }
      if (processedMessage.content) {
        content = processedMessage.content;
      }
    } else {
      // Use default embed
      embed = new EmbedBuilder()
        .setTitle('Create a ticket')
        .setDescription('Please select your inquiry below.\nDo **not** create a ticket and suddenly go offline.\n> Refer to [nohello.net](https://nohello.net/)')
        .setColor(colors.info)
        .setThumbnail(client.user.displayAvatarURL());
    }

    // Always create the ticket button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setEmoji(emojis.ticket)
          .setStyle(ButtonStyle.Secondary)
      );

    // Prepare message options
    const messageOptions = {
      components: [row]
    };

    if (embed) {
      messageOptions.embeds = [embed];
    }
    if (content) {
      messageOptions.content = content;
    }

    // Send the setup message
    const setupMessage = await message.channel.send(messageOptions);

    // Enable ticket system and save setup info
    await guildService.enableTicketSystem(message.guild.id);
    await guildService.setTicketSetup(message.guild.id, message.channel.id, setupMessage.id);

    return embeds.success(message, "Ticket system has been set up successfully! Users can now create tickets using the button above.");

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while setting up the ticket system. Please try again.");
  }
}

async function handleReset(client, message, args) {
  try {
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

    const guildService = getService('guild');
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);

    if (!ticketSystem.enabled) {
      return embeds.deny(message, "No ticket system is currently set up. Use `,ticket setup` to create one.");
    }

    // Try to delete the old setup message if it exists
    if (ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
      try {
        const setupChannel = message.guild.channels.cache.get(ticketSystem.setupChannelId);
        if (setupChannel) {
          const setupMessage = await setupChannel.messages.fetch(ticketSystem.setupMessageId);
          if (setupMessage) {
            await setupMessage.delete();
          }
        }
      } catch (error) {
        // Message might already be deleted, continue
      }
    }

    // Reset the ticket system setup data
    await guildService.setTicketSetup(message.guild.id, null, null);

    return embeds.success(message, "Ticket system has been reset successfully! The old setup message has been removed. Use `,ticket setup` to create a new one.");

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while resetting the ticket system. Please try again.");
  }
}

async function handleCategory(client, message, args) {
  try {
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

    const guildService = getService('guild');
    if (!args[1]) {
      const ticketSystem = await guildService.getTicketSystem(message.guild.id);
      if (ticketSystem.categoryId) {
        const category = message.guild.channels.cache.get(ticketSystem.categoryId);
        const categoryName = category ? category.name : 'Unknown Category';
        return embeds.info(message, `Current ticket category: **${categoryName}**\n\nUse \`,ticket category [category]\` to change it, or \`,ticket category none\` to remove it.`);
      } else {
        return embeds.info(message, "No ticket category is currently set. Tickets will be created at the top of the channel list.\n\nUse \`,ticket category [category]\` to set one.");
      }
    }

    if (args[1].toLowerCase() === 'none') {
      await guildService.setTicketCategory(message.guild.id, null);
      return embeds.success(message, "Ticket category has been removed. New tickets will be created at the top of the channel list.");
    }

    const categoryResult = findChannel(message.guild, args.slice(1).join(' '));
    if (!categoryResult.found || !categoryResult.channel || categoryResult.channel.type !== 4) { // 4 = CategoryChannel
      return embeds.deny(message, "I couldn't find that category. Please make sure you're mentioning a valid category or providing its name/ID.");
    }

    const category = categoryResult.channel;
    await guildService.setTicketCategory(message.guild.id, category.id);
    return embeds.success(message, `Ticket category has been set to **${category.name}**. New tickets will be created in this category.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while managing the ticket category. Please try again.");
  }
}

async function handleAddUser(client, message, args) {
  try {
    const guildService = getService('guild');
    const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (!args[1]) {
      return runHelpCommand(message, 'ticket');
    }

    // Check permissions
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);
    const isTicketOwner = ticket.userId === message.author.id;
    const hasAdminPerms = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
      return embeds.deny(message, "You don't have permission to add users to this ticket.");
    }

    const { findUser } = require('../../handlers/finder');
    const userResult = await findUser(message.guild, args.slice(1).join(' '));
    if (!userResult.found || !userResult.user) {
      return embeds.deny(message, "I couldn't find that user. Please make sure you're mentioning a valid user or providing their name/ID.");
    }

    const user = userResult.user;

    // Add user to ticket channel permissions
    await message.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });

    return embeds.success(message, `**${user.displayName}** has been added to this ticket.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while adding the user to this ticket. Please try again.");
  }
}

async function handleRemoveUser(client, message, args) {
  try {
    const guildService = getService('guild');
    const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (!args[1]) {
      return runHelpCommand(message, 'ticket');
    }

    // Check permissions
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);
    const isTicketOwner = ticket.userId === message.author.id;
    const hasAdminPerms = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
      return embeds.deny(message, "You don't have permission to remove users from this ticket.");
    }

    const { findUser } = require('../../handlers/finder');
    const userResult = await findUser(message.guild, args.slice(1).join(' '));
    if (!userResult.found || !userResult.user) {
      return embeds.deny(message, "I couldn't find that user. Please make sure you're mentioning a valid user or providing their name/ID.");
    }

    const user = userResult.user;

    // Don't allow removing the ticket creator
    if (user.id === ticket.userId) {
      return embeds.deny(message, "You cannot remove the ticket creator from their own ticket.");
    }

    // Don't allow removing the bot
    if (user.id === message.client.user.id) {
      return embeds.deny(message, "You cannot remove the bot from the ticket.");
    }

    // Remove user from ticket channel permissions
    await message.channel.permissionOverwrites.delete(user.id);

    return embeds.success(message, `**${user.displayName}** has been removed from this ticket.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while removing the user from this ticket. Please try again.");
  }
}

async function handleClose(client, message, args) {
  try {
    const guildService = getService('guild');
    const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (ticket.status === 'closed') {
      return embeds.deny(message, "This ticket is already closed. Use `,ticket open` to reopen it.");
    }

    // Check permissions
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);
    const isTicketOwner = ticket.userId === message.author.id;
    const hasAdminPerms = hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator');
    const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
      return embeds.deny(message, "You don't have permission to close this ticket.");
    }

    await guildService.closeTicket(message.guild.id, message.channel.id, message.author.id);

    // Remove ticket creator from channel completely
    await message.channel.permissionOverwrites.edit(ticket.userId, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false,
      AttachFiles: false,
      EmbedLinks: false
    });

    return embeds.success(message, `This ticket has been closed by ${message.author}. The ticket creator has been removed from the channel.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while closing the ticket. Please try again.");
  }
}

async function handleOpen(client, message, args) {
  try {
    const guildService = getService('guild');
    const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (ticket.status === 'open') {
      return embeds.deny(message, "This ticket is already open.");
    }

    // Check permissions
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);
    const hasAdminPerms = hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator');
    const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!hasAdminPerms && !hasSupportRole) {
      return embeds.deny(message, "You don't have permission to reopen this ticket.");
    }

    await guildService.reopenTicket(message.guild.id, message.channel.id);

    // Restore full channel permissions for ticket creator
    await message.channel.permissionOverwrites.edit(ticket.userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });

    return embeds.success(message, `This ticket has been reopened by ${message.author}. The ticket creator has been added back to the channel.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while reopening the ticket. Please try again.");
  }
}

async function handleRename(client, message, args) {
  try {
    const guildService = getService('guild');
    const ticket = await guildService.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (!args[1]) {
      return runHelpCommand(message, 'ticket');
    }

    // Check permissions
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);
    const isTicketOwner = ticket.userId === message.author.id;
    const hasAdminPerms = hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator');
    const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
      return embeds.deny(message, "You don't have permission to rename this ticket.");
    }

    const newName = args.slice(1).join(' ').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const finalName = `ticket-${newName}`;

    await message.channel.setName(finalName);
    return embeds.success(message, `Ticket has been renamed to **${finalName}**.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while renaming the ticket. Please try again.");
  }
}

async function handleSupport(client, message, args) {
  try {
    const guildService = getService('guild');
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);

    // If no arguments, show current support role
    if (!args[1]) {
      if (!ticketSystem.supportRoleId) {
        return embeds.info(message, "No support role is currently set. Use `,ticket support @role` to set one.");
      }

      const supportRole = message.guild.roles.cache.get(ticketSystem.supportRoleId);
      const roleName = supportRole ? supportRole.name : 'Unknown Role';

      return embeds.info(message, `Current support role: **${roleName}**\n\nMembers with this role have access to all tickets. Use \`,ticket support none\` to remove the support role.`);
    }

    // Handle removing support role
    if (args[1].toLowerCase() === 'none') {
      await guildService.setTicketSupportRole(message.guild.id, null);
      return embeds.success(message, "Support role has been removed. Only administrators and the ticket creator will have access to tickets.");
    }

    // Handle setting support role
    const { findRole } = require('../../handlers/finder');
    const roleResult = findRole(message.guild, args.slice(1).join(' '));
    if (!roleResult.found || !roleResult.role) {
      return embeds.deny(message, "I couldn't find that role. Please make sure you're mentioning a valid role or providing its name/ID.");
    }

    const role = roleResult.role;
    await guildService.setTicketSupportRole(message.guild.id, role.id);
    return embeds.success(message, `**${role.name}** has been set as the support role for tickets. Members with this role will have access to all tickets.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while managing the support role. Please try again.");
  }
}

async function handleMessage(client, message, args) {
  try {
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

    // Check cooldown (1 minute)
    const cooldownKey = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const cooldownAmount = 60 * 1000; // 1 minute in milliseconds

    if (ticketMessageCooldowns.has(cooldownKey)) {
      const expirationTime = ticketMessageCooldowns.get(cooldownKey) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = Math.ceil((expirationTime - now) / 1000);
        return embeds.deny(message, `Please wait **${timeLeft}** seconds before using this command again.`);
      }
    }

    const guildService = getService('guild');
    const ticketSystem = await guildService.getTicketSystem(message.guild.id);

    if (!args[1]) {
      const currentMessage = await guildService.getTicketCustomMessage(message.guild.id);
      if (currentMessage) {
        return embeds.info(message, `**Current custom ticket message:**\n\`\`\`\n${currentMessage}\`\`\`\n\nUse \`,ticket message [new message]\` to change it, or \`,ticket message remove\` to use the default message.`);
      } else {
        return embeds.info(message, "No custom ticket message is set. The default message will be used.\n\nUse \`,ticket message [custom message]\` to set one.");
      }
    }

    const customMessage = args.slice(1).join(' ');

    // Handle remove/none command
    if (customMessage.toLowerCase() === 'remove' || customMessage.toLowerCase() === 'none') {
      await guildService.removeTicketCustomMessage(message.guild.id);
      
      // Update the setup message if it exists
      if (ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
        await updateTicketSetupMessage(client, message.guild, ticketSystem, null);
      }
      
      // Set cooldown
      ticketMessageCooldowns.set(cooldownKey, now);

      // Clean up old cooldowns (optional optimization)
      setTimeout(() => {
        ticketMessageCooldowns.delete(cooldownKey);
      }, cooldownAmount);
      
      return embeds.success(message, "Custom ticket message has been removed. The default message will now be used.");
    }

    // Set the custom message
    await guildService.setTicketCustomMessage(message.guild.id, customMessage);

    // Update the setup message if it exists
    if (ticketSystem.setupMessageId && ticketSystem.setupChannelId) {
      await updateTicketSetupMessage(client, message.guild, ticketSystem, customMessage);
    }

    // Set cooldown
    ticketMessageCooldowns.set(cooldownKey, now);

    // Clean up old cooldowns (optional optimization)
    setTimeout(() => {
      ticketMessageCooldowns.delete(cooldownKey);
    }, cooldownAmount);

    return embeds.success(message, "Custom ticket message has been set successfully! The setup message has been updated.");

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while setting the custom ticket message. Please try again.");
  }
}

async function updateTicketSetupMessage(client, guild, ticketSystem, customMessage) {
  try {
    const setupChannel = guild.channels.cache.get(ticketSystem.setupChannelId);
    if (!setupChannel) return;

    const setupMessage = await setupChannel.messages.fetch(ticketSystem.setupMessageId);
    if (!setupMessage) return;

    let embed;
    let content = null;

    if (customMessage) {
      // Use EmbedVariableProcessor to handle custom message
      const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
      
      // Check if it's an embed or text message
      if (customMessage.trim().startsWith('{embed}')) {
        // Process as embed - create a temporary channel to process the embed
        // We'll extract the embed data instead of sending it
        const processedMessage = await processCustomTicketMessage(customMessage, guild, client);
        if (processedMessage.embeds && processedMessage.embeds.length > 0) {
          embed = processedMessage.embeds[0];
        }
        if (processedMessage.content) {
          content = processedMessage.content;
        }
      } else {
        // Process as text message
        const processedText = EmbedVariableProcessor.replaceVariables(customMessage, {
          guild: guild,
          server: guild // Alias for backward compatibility
        });
        content = processedText;
      }
    } else {
      // Use default embed
      embed = new EmbedBuilder()
        .setTitle('Create a ticket')
        .setDescription('Please select your inquiry below.\nDo **not** create a ticket and suddenly go offline.\n> Refer to [nohello.net](https://nohello.net/)')
        .setColor(colors.info)
        .setThumbnail(client.user.displayAvatarURL());
    }

    // Always keep the ticket button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setEmoji(emojis.ticket)
          .setStyle(ButtonStyle.Secondary)
      );

    const messageOptions = {
      components: [row]
    };

    if (embed) {
      messageOptions.embeds = [embed];
    }
    if (content) {
      messageOptions.content = content;
    }

    await setupMessage.edit(messageOptions);

  } catch (error) {
    logger.webhook.error(error, message);
  }
}

async function processCustomTicketMessage(customMessage, guild, client) {
  // This is a helper function to process custom embed messages
  // We'll simulate the EmbedVariableProcessor without actually sending a message
  const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
  
  // Replace variables first
  const processedContent = EmbedVariableProcessor.replaceVariables(customMessage, {
    guild: guild,
    server: guild
  });

  // Parse the embed content manually since we can't use the actual processor
  if (processedContent.trim().startsWith('{embed}')) {
    const embedContent = processedContent.replace(/^\s*{embed}\s*\$v\s*/, '');
    
    // Create a basic embed and try to parse the content
    const embed = new EmbedBuilder().setColor(colors.info);
    let content = null;

    // Split by $v to get individual parameters
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
        case 'title':
          embed.setTitle(paramValue);
          break;
        case 'description':
          embed.setDescription(paramValue);
          break;
        case 'color':
          embed.setColor(paramValue);
          break;
        case 'thumbnail':
          embed.setThumbnail(paramValue);
          break;
        case 'image':
          embed.setImage(paramValue);
          break;
        case 'content':
        case 'message':
          content = paramValue;
          break;
      }
    }

    return { embeds: [embed], content };
  }

  return { content: processedContent };
}


async function handleVariables(client, message, args) {
  try {
    const embed = new EmbedBuilder()
      .setColor(colors.info)
      .setTitle('Ticket Message Variables')
      .setDescription(`\`{guild.name}\` — ${message.guild.name}\n\`{guild.membercount}\` — ${message.guild.memberCount}\n\`{guild.id}\` — ${message.guild.id}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\n**Note:** The Create Ticket button will always be added automatically, regardless of your custom message.`);

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, "An error occurred while showing ticket variables. Please try again.");
  }
}
