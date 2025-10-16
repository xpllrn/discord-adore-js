const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { colors, emojis } = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { hasDiscordPermission } = require('../../utils/permissions');
const { findChannel, findRole } = require('../../handlers/finder');
const guildCache = require('../../database/cache/models/guild');

module.exports = {
  name: "ticket",
  aliases: ['tickets'],
  description: "Manage the ticket system for your server",
  usage: '{guildprefix}ticket setup - Create ticket system\n{guildprefix}ticket reset - Reset ticket system\n{guildprefix}ticket category [category] - Set ticket category\n{guildprefix}ticket add [@user] - Add user to current ticket\n{guildprefix}ticket remove [@user] - Remove user from current ticket\n{guildprefix}ticket close - Close current ticket\n{guildprefix}ticket open - Reopen current ticket\n{guildprefix}ticket rename [name] - Rename current ticket\n{guildprefix}ticket support [@role/none] - Set support role',
  permission: "Manage Guild",
  run: async(client, message, args) => {

    await ensureGuildData(message.guild.id);

    if (!args[0]) {
      return runHelpCommand(message, 'ticket');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'setup':
        return handleSetup(client, message, args);
      case 'reset':
        return handleReset(client, message, args);
      case 'category':
        return handleCategory(client, message, args);
      case 'add':
        return handleAddUser(client, message, args);
      case 'remove':
        return handleRemoveUser(client, message, args);
      case 'close':
        return handleClose(client, message, args);
      case 'open':
        return handleOpen(client, message, args);
      case 'rename':
        return handleRename(client, message, args);
      case 'support':
        return handleSupport(client, message, args);
      default:
        return runHelpCommand(message, 'ticket');
    }
  }
};

async function handleSetup(client, message, args) {
  try {
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);

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

    // Create the setup embed
    const setupEmbed = new EmbedBuilder()
      .setTitle('Create a ticket')
      .setDescription('Please select your inquiry below.\nDo **not** create a ticket and suddenly go offline.\n> Refer to [nohello.net](https://nohello.net/)')
      .setColor(colors.info)
      .setThumbnail(client.user.displayAvatarURL());

    // Create the ticket button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setEmoji(emojis.ticket)
          .setStyle(ButtonStyle.Secondary)
      );

    // Send the setup message
    const setupMessage = await message.channel.send({
      embeds: [setupEmbed],
      components: [row]
    });

    // Enable ticket system and save setup info
    await guildCache.enableTicketSystem(message.guild.id);
    await guildCache.setTicketSetup(message.guild.id, message.channel.id, setupMessage.id);

    return embeds.success(message, "Ticket system has been set up successfully! Users can now create tickets using the button above.");

  } catch (error) {
    console.error('Error setting up ticket system:', error);
    return embeds.deny(message, "An error occurred while setting up the ticket system. Please try again.");
  }
}

async function handleReset(client, message, args) {
  try {
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);

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
    await guildCache.setTicketSetup(message.guild.id, null, null);

    return embeds.success(message, "Ticket system has been reset successfully! The old setup message has been removed. Use `,ticket setup` to create a new one.");

  } catch (error) {
    console.error('Error resetting ticket system:', error);
    return embeds.deny(message, "An error occurred while resetting the ticket system. Please try again.");
  }
}

async function handleCategory(client, message, args) {
  try {
    if (!args[1]) {
      const ticketSystem = await guildCache.getTicketSystem(message.guild.id);
      if (ticketSystem.categoryId) {
        const category = message.guild.channels.cache.get(ticketSystem.categoryId);
        const categoryName = category ? category.name : 'Unknown Category';
        return embeds.info(message, `Current ticket category: **${categoryName}**\n\nUse \`,ticket category [category]\` to change it, or \`,ticket category none\` to remove it.`);
      } else {
        return embeds.info(message, "No ticket category is currently set. Tickets will be created at the top of the channel list.\n\nUse \`,ticket category [category]\` to set one.");
      }
    }

    if (args[1].toLowerCase() === 'none') {
      await guildCache.setTicketCategory(message.guild.id, null);
      return embeds.success(message, "Ticket category has been removed. New tickets will be created at the top of the channel list.");
    }

    const categoryResult = findChannel(message.guild, args.slice(1).join(' '));
    if (!categoryResult.found || !categoryResult.channel || categoryResult.channel.type !== 4) { // 4 = CategoryChannel
      return embeds.deny(message, "I couldn't find that category. Please make sure you're mentioning a valid category or providing its name/ID.");
    }

    const category = categoryResult.channel;
    await guildCache.setTicketCategory(message.guild.id, category.id);
    return embeds.success(message, `Ticket category has been set to **${category.name}**. New tickets will be created in this category.`);

  } catch (error) {
    console.error('Error handling ticket category:', error);
    return embeds.deny(message, "An error occurred while managing the ticket category. Please try again.");
  }
}

async function handleAddUser(client, message, args) {
  try {
    const ticket = await guildCache.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (!args[1]) {
      return embeds.deny(message, "Please specify a user to add to this ticket. Usage: `,ticket add @user`");
    }

    // Check permissions
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);
    const isTicketOwner = ticket.userId === message.author.id;
    const hasAdminPerms = hasDiscordPermission(message.member, PermissionFlagsBits.Administrator);
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
    console.error('Error adding user to ticket:', error);
    return embeds.deny(message, "An error occurred while adding the user to this ticket. Please try again.");
  }
}

async function handleRemoveUser(client, message, args) {
  try {
    const ticket = await guildCache.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (!args[1]) {
      return embeds.deny(message, "Please specify a user to remove from this ticket. Usage: `,ticket remove @user`");
    }

    // Check permissions
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);
    const isTicketOwner = ticket.userId === message.author.id;
    const hasAdminPerms = hasDiscordPermission(message.member, PermissionFlagsBits.Administrator);
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
    console.error('Error removing user from ticket:', error);
    return embeds.deny(message, "An error occurred while removing the user from this ticket. Please try again.");
  }
}

async function handleClose(client, message, args) {
  try {
    const ticket = await guildCache.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (ticket.status === 'closed') {
      return embeds.deny(message, "This ticket is already closed. Use `,ticket open` to reopen it.");
    }

    // Check permissions
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);
    const isTicketOwner = ticket.userId === message.author.id;
    const hasAdminPerms = hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator');
    const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
      return embeds.deny(message, "You don't have permission to close this ticket.");
    }

    await guildCache.closeTicket(message.guild.id, message.channel.id, message.author.id);

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
    console.error('Error closing ticket:', error);
    return embeds.deny(message, "An error occurred while closing the ticket. Please try again.");
  }
}

async function handleOpen(client, message, args) {
  try {
    const ticket = await guildCache.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (ticket.status === 'open') {
      return embeds.deny(message, "This ticket is already open.");
    }

    // Check permissions
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);
    const hasAdminPerms = hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator');
    const hasSupportRole = ticketSystem.supportRoleId && message.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!hasAdminPerms && !hasSupportRole) {
      return embeds.deny(message, "You don't have permission to reopen this ticket.");
    }

    await guildCache.reopenTicket(message.guild.id, message.channel.id);

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
    console.error('Error reopening ticket:', error);
    return embeds.deny(message, "An error occurred while reopening the ticket. Please try again.");
  }
}

async function handleRename(client, message, args) {
  try {
    const ticket = await guildCache.getTicket(message.guild.id, message.channel.id);
    if (!ticket) {
      return embeds.deny(message, "This command can only be used in ticket channels.");
    }

    if (!args[1]) {
      return embeds.deny(message, "Please provide a new name for the ticket. Usage: `,ticket rename [new name]`");
    }

    // Check permissions
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);
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
    console.error('Error renaming ticket:', error);
    return embeds.deny(message, "An error occurred while renaming the ticket. Please try again.");
  }
}

async function handleSupport(client, message, args) {
  try {
    const ticketSystem = await guildCache.getTicketSystem(message.guild.id);

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
      await guildCache.setTicketSupportRole(message.guild.id, null);
      return embeds.success(message, "Support role has been removed. Only administrators and the ticket creator will have access to tickets.");
    }

    // Handle setting support role
    const { findRole } = require('../../handlers/finder');
    const roleResult = findRole(message.guild, args.slice(1).join(' '));
    if (!roleResult.found || !roleResult.role) {
      return embeds.deny(message, "I couldn't find that role. Please make sure you're mentioning a valid role or providing its name/ID.");
    }

    const role = roleResult.role;
    await guildCache.setTicketSupportRole(message.guild.id, role.id);
    return embeds.success(message, `**${role.name}** has been set as the support role for tickets. Members with this role will have access to all tickets.`);

  } catch (error) {
    console.error('Error managing support role:', error);
    return embeds.deny(message, "An error occurred while managing the support role. Please try again.");
  }
}
