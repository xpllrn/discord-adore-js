const { EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensureGuildData } = require('../../database');
const { colors, emojis } = require('../../config/setup');
const { getService } = require('@services');
const { embeds } = require('../../core/embeds');
const voiceManagerButtons = require('./voiceManagerButtons');

/**
 * Safely respond to an interaction, handling expired/invalid interactions
 * @param {Interaction} interaction - The interaction to respond to
 * @param {Object} options - Response options
 * @param {string} method - Method to use ('reply', 'update', 'editReply', 'followUp')
 * @returns {Promise<boolean>} - Whether the response was successful
 */
async function safeInteractionResponse(interaction, options, method = 'reply') {
  try {
    // Check if interaction is still valid
    if (!interaction.isRepliable()) {
      // Silent fail for non-repliable interactions
      return false;
    }

    // Check if interaction is expired
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 14 * 60 * 1000) { // 14 minutes
      console.warn('Interaction expired, cannot respond:', interaction.customId);
      return false;
    }

    // Check interaction state and use appropriate method
    if (method === 'reply' && (interaction.replied || interaction.deferred)) {
      console.warn('Interaction already replied/deferred, using editReply instead');
      method = 'editReply';
    }

    switch (method) {
      case 'reply':
        await interaction.reply(options);
        break;
      case 'update':
        await interaction.update(options);
        break;
      case 'editReply':
        await interaction.editReply(options);
        break;
      case 'followUp':
        await interaction.followUp(options);
        break;
      default:
        await interaction.reply(options);
    }

    return true;
  } catch (error) {
    // Handle specific Discord API errors
    if (error.code === 10062) { // Unknown interaction
      // Silent fail for expired interactions
    } else if (error.code === 40060) { // Interaction has already been acknowledged
      // Silent fail for already acknowledged interactions
    } else {
      // Send error to webhook for other interaction errors
      if (interaction.client?.errorLogger) {
        interaction.client.errorLogger.log(error, 'Interaction Response', {
          command: 'Interaction Response',
          args: `CustomId: ${interaction.customId || 'Unknown'}`,
          user: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel
        });
      }
    }
    return false;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // Check if interaction has already been handled
      if (interaction.replied || interaction.deferred) {
        // Silent fail for already handled interactions
        return;
      }

      // Check if interaction is expired (older than 14 minutes to be safe)
      const interactionAge = Date.now() - interaction.createdTimestamp;
      if (interactionAge > 14 * 60 * 1000) { // 14 minutes in milliseconds
        // Silent fail for expired interactions
        return;
      }

      // Handle slash command interactions
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.slashCommands.get(interaction.commandName);

        if (!command) {
          console.error(`No slash command matching ${interaction.commandName} was found.`);
          return;
        }

        try {
          // Check if user is blacklisted (skip for blacklist command itself)
          if (command.data?.name !== 'blacklist') {
            const systemService = getService('system');
            const isBlacklisted = await systemService.isUserBlacklisted(interaction.user.id);
            if (isBlacklisted) {
              return interaction.reply({ content: '🤡', ephemeral: true });
            }
          }

          // Check permission level for slash commands (premium_user, premium_server, dev)
          if (command.permission) {
            const { hasPermissionLevel, PERMISSION_LEVELS } = require('../../utils/permissions');
            // Create a fake message object for permission checking
            const fakeMessage = {
              author: interaction.user,
              member: interaction.member,
              guild: interaction.guild,
              channel: interaction.channel
            };
            
            const hasPermission = await hasPermissionLevel(fakeMessage, command.permission);
            if (!hasPermission) {
              const permLevel = PERMISSION_LEVELS[command.permission];
              const errorMsg = permLevel?.message || 'You do not have permission to use this command!';
              return interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
            }
          }

          await command.execute(interaction);
        } catch (error) {
          console.error(`Error executing slash command ${interaction.commandName}:`, error);
          
          if (interaction.client?.errorLogger) {
            interaction.client.errorLogger.log(error, 'Slash Command Execution', {
              command: interaction.commandName,
              user: interaction.user,
              guild: interaction.guild,
              channel: interaction.channel
            });
          }

          const errorMessage = {
            content: '❌ There was an error while executing this command!'
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage).catch(() => {});
          } else {
            await interaction.reply(errorMessage).catch(() => {});
          }
        }
        return;
      }

      // Handle button interactions
      if (interaction.isButton()) {
        // Handle voice manager buttons, logic is in ./voiceManagerButtons.js
        const vmButtonIds = [
          '6800f9e6e8394c5cfd7b8c7f684b6cd2', 'bc719b5197e94fb68e1db816f8fb00e6',
          '8a7385beb791449f9a7893ed5536e7e3', '4da0c243b63143d4a574d30c806e962b',
          '0c34acff106f453d84e4ba7122f868a5', '2c8e65c78329459ee077b3c0e853e4a2',
          'f33fa78ce7964964cd5c155b5a15ebb7', 'd0f359515fe244b0ad8824fb3c066d4b',
          '7f5598b8836e442ccd33a88afc00865c', '48e538acf6e741aadc391f9d36977473'
        ];
        
        if (interaction.customId.startsWith('vm_') || vmButtonIds.includes(interaction.customId)) {
          return voiceManagerButtons.handleVMButton(interaction);
        }

        if (interaction.customId.startsWith('panel_')) {
          const commandParts = interaction.customId.split('_').slice(1);
          const commandName = commandParts.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          return interaction.reply({
            content: `✅ You have used the ${commandName} command.`
          });
        }

        // Handle ticket creation button
        if (interaction.customId === 'create_ticket') {
          return handleCreateTicket(interaction);
        }

        // Handle ticket close button
        if (interaction.customId.startsWith('ticket_close_')) {
          return handleTicketClose(interaction);
        }

        // Handle ticket delete button
        if (interaction.customId.startsWith('ticket_delete_')) {
          return handleTicketDelete(interaction);
        }

        // Handle delete confirmation buttons
        if (interaction.customId.startsWith('confirm_delete_')) {
          return handleConfirmDelete(interaction);
        }

        if (interaction.customId.startsWith('cancel_delete_')) {
          return handleCancelDelete(interaction);
        }

        // Handle booster role share buttons
        if (interaction.customId.startsWith('br_accept_') || interaction.customId.startsWith('br_decline_')) {
          return handleBoosterRoleShare(interaction);
        }

        // Handle boost tracking buttons
        if (interaction.customId === 'boosters_new_refresh' || interaction.customId === 'boosters_lost_refresh') {
          // These are handled by their respective command collectors
          return;
        }

        // Handle welcome buttons
        if (interaction.customId.startsWith('welcome_')) {
          return handleWelcomeButton(interaction);
        }

        // Handle button role interactions
        if (interaction.customId.startsWith('buttonrole_')) {
          return handleButtonRole(interaction);
        }

        // Handle confession buttons
        if (interaction.customId === 'confession_submit') {
          return handleConfessionSubmit(interaction);
        }

        if (interaction.customId === 'confession_reply' || interaction.customId.startsWith('confession_reply_')) {
          return handleConfessionReply(interaction);
        }
      }

      // Handle select menu interactions
      if (interaction.isStringSelectMenu()) {
        // Add other select menu handlers here if needed
      }

      // Handle modal interactions
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'vm_rename_modal') {
          return handleVMRenameModal(interaction);
        }

        if (interaction.customId === 'confession_modal') {
          return handleConfessionModal(interaction);
        }

        if (interaction.customId === 'confession_reply_modal') {
          return handleConfessionReplyModal(interaction);
        }
      }
    } catch (error) {
      // Send error to webhook instead of console
      if (interaction.client?.errorLogger) {
        interaction.client.errorLogger.log(error, 'Interaction Create', {
          command: 'Interaction Create',
          args: `CustomId: ${interaction.customId || 'Unknown'}`,
          user: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel
        });
      }

      // Try to respond with an error message using safe response
      await safeInteractionResponse(interaction, {
        content: '❌ An error occurred while processing your interaction. Please try again.'
      });
    }
  },
};

async function handleCreateTicket(interaction) {
  try {
    // Ticket creation uses ephemeral for privacy - only the user sees the confirmation
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const user = interaction.user;

    // Ensure guild data exists
    await ensureGuildData(guild.id);

    // Get ticket system configuration using service layer
    const guildService = getService('guild');
    const ticketSystem = await guildService.getTicketSystem(guild.id);

    if (!ticketSystem.enabled) {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: user.id },
        guild: { id: guild.id },
        channel: {
          send: async (options) => {
            return await interaction.editReply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'The ticket system is not enabled on this server.');
    }

    // Check if user already has an open ticket
    const existingTickets = await guildService.getUserTickets(guild.id, user.id);
    if (existingTickets.length > 0) {
      const ticketChannel = guild.channels.cache.get(existingTickets[0].channelId);
      if (ticketChannel) {
        // Create a fake message object for embeds.deny
        const fakeMessage = {
          author: { id: user.id },
          guild: { id: guild.id },
          channel: {
            send: async (options) => {
              return await interaction.editReply(options);
            }
          }
        };

        return embeds.deny(fakeMessage, `You already have an open ticket: ${ticketChannel}\n\nPlease use your existing ticket or close it before creating a new one.`);
      } else {
        // Clean up orphaned ticket data
        await guildService.removeTicket(guild.id, existingTickets[0].channelId);
      }
    }

    // Create the ticket channel
    const ticketNumber = ticketSystem.ticketCounter + 1;
    const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    // Set up channel permissions
    const channelPermissions = [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id, // Ticket creator
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: interaction.client.user.id, // Bot
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    // Add support role permissions if configured
    if (ticketSystem.supportRoleId) {
      const supportRole = guild.roles.cache.get(ticketSystem.supportRoleId);
      if (supportRole) {
        channelPermissions.push({
          id: supportRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }
    }

    // Create the channel
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketSystem.categoryId,
      permissionOverwrites: channelPermissions,
      topic: `Ticket #${ticketNumber} - Created by ${user.tag}`,
    });

    // Create ticket in database
    await guildService.createTicket(guild.id, user.id, ticketChannel.id);

    // Create welcome embed for the ticket
    const welcomeEmbed = new EmbedBuilder()
      .setDescription(
        `-# Thank you for creating a ticket, we will be with you shortly.\n` +
        `> Please describe your **issue or question** in detail while we wait for staff to assist you with it and avoid pinging them.`
      )
      .setColor(colors.info);

    // Create ticket management buttons
    const ticketButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketChannel.id}`)
          .setLabel('Close')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`ticket_delete_${ticketChannel.id}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger)
      );

    // Send welcome message with user mention outside embed
    await ticketChannel.send({
      content: `${user}${ticketSystem.supportRoleId ? ` <@&${ticketSystem.supportRoleId}>` : ''}`,
      embeds: [welcomeEmbed],
      components: [ticketButtons]
    });

    // Reply to the interaction with success message
    // Create a fake message object for embeds.success
    const fakeMessage = {
      author: { id: user.id },
      guild: { id: guild.id },
      channel: {
        send: async (options) => {
          return await interaction.editReply(options);
        }
      }
    };

    return embeds.success(fakeMessage, `Your ticket has been created: ${ticketChannel}`);

  } catch (error) {
    console.error('Error creating ticket:', error);

    // Create a fake message object for embeds.deny
    const fakeMessage = {
      author: { id: interaction.user.id },
      guild: { id: interaction.guild.id },
      channel: {
        send: async (options) => {
          return await interaction.editReply(options);
        }
      }
    };

    try {
      return embeds.deny(fakeMessage, 'An error occurred while creating your ticket. Please try again or contact an administrator.');
    } catch (replyError) {
      // If we can't edit the reply, try to follow up
      try {
        const fakeFollowMessage = {
          author: { id: interaction.user.id },
          guild: { id: interaction.guild.id },
          channel: {
            send: async (options) => {
              options.flags = MessageFlags.Ephemeral;
              return await interaction.followUp(options);
            }
          }
        };
        return embeds.deny(fakeFollowMessage, 'An error occurred while creating your ticket. Please try again or contact an administrator.');
      } catch (followUpError) {
        // Silent fail for follow-up error message
      }
    }
  }
}

async function handleTicketClose(interaction) {
  try {
    await interaction.deferReply();

    const channelId = interaction.customId.split('_')[2];
    const guild = interaction.guild;
    const user = interaction.user;

    // Get ticket data using service layer
    const guildService = getService('guild');
    const ticket = await guildService.getTicket(guild.id, channelId);
    if (!ticket) {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: user.id },
        guild: { id: guild.id },
        channel: {
          send: async (options) => {
            return await interaction.editReply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'This is not a valid ticket channel.');
    }

    // Get ticket system configuration
    const ticketSystem = await guildService.getTicketSystem(guild.id);

    // Check permissions
    const isTicketOwner = ticket.userId === user.id;
    const hasAdminPerms = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasSupportRole = ticketSystem.supportRoleId && interaction.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!isTicketOwner && !hasAdminPerms && !hasSupportRole) {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: user.id },
        guild: { id: guild.id },
        channel: {
          send: async (options) => {
            return await interaction.editReply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'You don\'t have permission to close this ticket.');
    }

    if (ticket.status === 'closed') {
      // Reopen the ticket
      await guildService.reopenTicket(guild.id, channelId);

      // Add ticket creator back to channel
      await interaction.channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      });

      // Update button to show "Close"
      const updatedButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_close_${channelId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`ticket_delete_${channelId}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
        );

      // Update the original message
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const welcomeMessage = messages.find(msg => msg.embeds.length > 0 && msg.components.length > 0);
      if (welcomeMessage) {
        await welcomeMessage.edit({ components: [updatedButtons] });
      }

      // Create a fake message object for embeds.success
      const fakeMessage = {
        author: { id: user.id },
        guild: { id: guild.id },
        channel: {
          send: async (options) => {
            return await interaction.editReply(options);
          }
        }
      };

      return embeds.success(fakeMessage, 'Ticket has been reopened. The ticket creator has been added back to the channel.');

    } else {
      // Close the ticket
      await guildService.closeTicket(guild.id, channelId, user.id);

      // Remove ticket creator from channel completely
      await interaction.channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false,
        AttachFiles: false,
        EmbedLinks: false
      });

      // Update button to show "Open"
      const updatedButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_close_${channelId}`)
            .setLabel('Open')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`ticket_delete_${channelId}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
        );

      // Update the original message
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const welcomeMessage = messages.find(msg => msg.embeds.length > 0 && msg.components.length > 0);
      if (welcomeMessage) {
        await welcomeMessage.edit({ components: [updatedButtons] });
      }

      // Create a fake message object for embeds.success
      const fakeMessage = {
        author: { id: user.id },
        guild: { id: guild.id },
        channel: {
          send: async (options) => {
            return await interaction.editReply(options);
          }
        }
      };

      return embeds.success(fakeMessage, 'Ticket has been closed. The ticket creator has been removed from the channel.');
    }

  } catch (error) {
    // Send error to webhook instead of console
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Ticket Close Handler', {
        command: 'Ticket Close',
        args: `Channel: ${interaction.channel?.name || 'Unknown'}`,
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }
    try {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: interaction.user.id },
        guild: { id: interaction.guild.id },
        channel: {
          send: async (options) => {
            return await interaction.editReply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'An error occurred while managing the ticket. Please try again.');
    } catch (replyError) {
      // Silent fail for reply error
    }
  }
}

async function handleTicketDelete(interaction) {
  try {
    const channelId = interaction.customId.split('_')[2];
    const guild = interaction.guild;
    const user = interaction.user;

    // Get ticket data using service layer
    const guildService = getService('guild');
    const ticket = await guildService.getTicket(guild.id, channelId);
    if (!ticket) {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: interaction.user.id },
        guild: { id: guild.id },
        channel: {
          send: async (options) => {
            options.flags = MessageFlags.Ephemeral;
            return await interaction.reply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'This is not a valid ticket channel.');
    }

    // Get ticket system configuration
    const ticketSystem = await guildService.getTicketSystem(guild.id);

    // Check permissions (only support role or admin can delete)
    const hasAdminPerms = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasSupportRole = ticketSystem.supportRoleId && interaction.member.roles.cache.has(ticketSystem.supportRoleId);

    if (!hasAdminPerms && !hasSupportRole) {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: interaction.user.id },
        guild: { id: guild.id },
        channel: {
          send: async (options) => {
            options.flags = MessageFlags.Ephemeral;
            return await interaction.reply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'You don\'t have permission to delete this ticket. Only administrators and support staff can delete tickets.');
    }

    // Create a fake message object for embeds.warn
    const fakeMessage = {
      author: { id: interaction.user.id },
      guild: { id: guild.id },
      channel: {
        send: async (options) => {
          // Add confirmation buttons to the options
          const confirmButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`confirm_delete_${channelId}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`cancel_delete_${channelId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
            );

          options.components = [confirmButtons];
          options.flags = MessageFlags.Ephemeral;

          return await interaction.reply(options);
        }
      }
    };

    return embeds.warn(fakeMessage, 'Are you sure you want to **permanently delete** this ticket?');

  } catch (error) {
    console.error('Error handling ticket delete:', error);
    try {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: interaction.user.id },
        guild: { id: interaction.guild.id },
        channel: {
          send: async (options) => {
            options.flags = MessageFlags.Ephemeral;
            return await interaction.reply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'An error occurred while deleting the ticket. Please try again.');
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

async function handleConfirmDelete(interaction) {
  try {
    const channelId = interaction.customId.split('_')[2];

    // Respond to the interaction first before deleting the channel
    const { embeds } = require('../../core/embeds');

    const loadingEmbed = embeds.createLoading(interaction, 'Deleting ticket...');

    await interaction.update({
      content: null,
      embeds: [loadingEmbed],
      components: []
    });

    // Remove ticket from database using service layer
    const guildService = getService('guild');
    await guildService.removeTicket(interaction.guild.id, channelId);

    // Delete the channel after a short delay to ensure the response is sent
    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (deleteError) {
        console.error('Error deleting channel:', deleteError);
      }
    }, 1000);

  } catch (error) {
    // Send error to webhook instead of console
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Ticket Delete Confirm', {
        command: 'Ticket Delete Confirm',
        args: `Channel: ${interaction.channel?.name || 'Unknown'}`,
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }
    try {
      // Check if interaction has been replied to or deferred
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while deleting the ticket. Please try again.'
        });
      } else {
        // If already replied, use followUp or editReply
        await interaction.followUp({
          content: '❌ An error occurred while deleting the ticket. Please try again.'
        }).catch(() => { });
      }
    } catch (replyError) {
      // Silent fail for reply error
    }
  }
}

async function handleCancelDelete(interaction) {
  try {
    // Create a fake message object for embeds.success
    const fakeMessage = {
      author: { id: interaction.user.id },
      guild: { id: interaction.guild.id },
      channel: {
        send: async (options) => {
          options.embeds = options.embeds || [];
          options.components = [];
          return await interaction.update(options);
        }
      }
    };

    return embeds.success(fakeMessage, 'Ticket deletion cancelled.');

  } catch (error) {
    // Send error to webhook instead of console
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Ticket Delete Cancel', {
        command: 'Ticket Delete Cancel',
        args: `Channel: ${interaction.channel?.name || 'Unknown'}`,
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }
    try {
      // Create a fake message object for embeds.deny
      const fakeMessage = {
        author: { id: interaction.user.id },
        guild: { id: interaction.guild.id },
        channel: {
          send: async (options) => {
            options.flags = MessageFlags.Ephemeral;
            return await interaction.reply(options);
          }
        }
      };

      return embeds.deny(fakeMessage, 'An error occurred. Please try again.');
    } catch (replyError) {
      // Silent fail for reply error
    }
  }
}

async function handleBoosterRoleShare(interaction) {
  try {
    const isAccept = interaction.customId.startsWith('br_accept_');
    const parts = interaction.customId.split('_');
    const pendingShareId = parseInt(parts[2]);
    const targetUserId = parts[3];

    // Check if the user clicking is the target user
    if (interaction.user.id !== targetUserId) {
      const config = require('../../config/setup');
      const warnEmbed = new EmbedBuilder()
        .setColor(config.colors.warn)
        .setDescription(`${config.emojis.warn} <@${interaction.user.id}>: This button is **NOT** for you`);

      return await safeInteractionResponse(interaction, {
        embeds: [warnEmbed]
      });
    }

    // Get all booster roles and find the one with the matching pending share
    const guildService = getService('guild');
    const allBoosterRoles = await guildService.getBoosterRoles(interaction.guild.id);

    let boosterRole = null;
    let pendingShare = null;

    for (const br of allBoosterRoles) {
      if (br.pendingShares) {
        const ps = br.pendingShares.find(ps => ps.id === pendingShareId && ps.targetUserId === targetUserId);
        if (ps) {
          boosterRole = br;
          pendingShare = ps;
          break;
        }
      }
    }

    if (!boosterRole || !pendingShare) {
      const logger = require('../../utils/logger');
      logger.console.error(`Pending share not found: guildId=${interaction.guild.id}, pendingShareId=${pendingShareId}, targetUserId=${targetUserId}`);

      const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Share request not found. It may have expired or been cancelled.');
      return await safeInteractionResponse(interaction, {
        embeds: [embed]
      });
    }

    // Initialize missing properties for older booster roles
    if (!boosterRole.sharedWith) boosterRole.sharedWith = [];

    const config = require('../../config/setup');

    if (isAccept) {
      // Check if already shared with this user
      if (boosterRole.sharedWith.find(s => s.userId === interaction.user.id)) {
        const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'You already have access to this booster role.');
        return await safeInteractionResponse(interaction, {
          embeds: [embed]
        });
      }

      // Check if at sharing limit
      if (boosterRole.sharedWith.length >= 5) {
        const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'This booster role has reached the sharing limit (5 people).');
        return await safeInteractionResponse(interaction, {
          embeds: [embed]
        });
      }

      // Add the role to the user
      const discordRole = interaction.guild.roles.cache.get(boosterRole.roleId);
      if (!discordRole) {
        const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Booster role was deleted.');
        return await safeInteractionResponse(interaction, {
          embeds: [embed]
        });
      }

      try {
        await interaction.member.roles.add(discordRole);

        // Add to shared list and remove from pending shares
        boosterRole.sharedWith.push({
          userId: interaction.user.id,
          sharedAt: new Date()
        });

        // Remove the pending share
        boosterRole.pendingShares = boosterRole.pendingShares.filter(ps => ps.id !== pendingShareId);

        // Update the booster role in database
        await guildService.updateBoosterRole(interaction.guild.id, boosterRole.userId || boosterRole.ownerId, {
          sharedWith: boosterRole.sharedWith,
          pendingShares: boosterRole.pendingShares
        });

        // Update the message using prebuilt embed
        const acceptedEmbed = embeds.createSuccess(
          { author: { id: interaction.user.id } },
          `**${interaction.user.username}** accepted the booster role share for ${discordRole}!`
        );

        await interaction.update({ embeds: [acceptedEmbed], components: [] });

        // DM notifications removed per user request

      } catch (error) {
        const logger = require('../../utils/logger');
        logger.webhook.error(error, interaction.message);
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to add booster role. Please check bot permissions.');
        return await safeInteractionResponse(interaction, {
          embeds: [embed]
        });
      }

    } else {
      // Decline the share - remove from pending shares
      boosterRole.pendingShares = boosterRole.pendingShares.filter(ps => ps.id !== pendingShareId);

      // Update the booster role in database
      await guildService.updateBoosterRole(interaction.guild.id, boosterRole.userId || boosterRole.ownerId, {
        pendingShares: boosterRole.pendingShares
      });

      // Update the message using prebuilt embed
      const declinedEmbed = embeds.createWarn(
        { author: { id: interaction.user.id } },
        `**${interaction.user.username}** declined the booster role share for <@&${boosterRole.roleId}>.`
      );

      await interaction.update({ embeds: [declinedEmbed], components: [] });

      // DM notifications removed per user request
    }

  } catch (error) {
    const logger = require('../../utils/logger');
    logger.webhook.error(error, interaction.message);
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'An error occurred while processing the share request.');
    return await safeInteractionResponse(interaction, {
      embeds: [embed]
    });
  }
}

async function handleVMRenameModal(interaction) {
  try {
    const member = interaction.member;
    if (!member.voice.channel) {
      const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'You need to be in a voice channel to use this command');
      return await interaction.reply({ embeds: [embed] });
    }

    const guildService = getService('guild');
    const tempChannel = await guildService.getTempVoiceChannel(interaction.guild.id, member.voice.channel.id);
    if (!tempChannel || tempChannel.ownerId !== member.id) {
      const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'You can only rename your own voice channel');
      return await interaction.reply({ embeds: [embed] });
    }

    const newName = interaction.fields.getTextInputValue('channel_name');

    if (newName.length > 100) {
      const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Channel name must be 100 characters or less');
      return await interaction.reply({ embeds: [embed] });
    }

    try {
      await member.voice.channel.setName(newName);
      await guildService.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
        customName: newName
      });

      const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, `Voice channel name changed to: **${newName}**`);
      return await interaction.reply({ embeds: [embed] });
    } catch (error) {
      const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to change channel name. Please check my permissions.');
      return await interaction.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Error handling VM rename modal:', error);
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'An error occurred while renaming the channel.');
    return await interaction.reply({ embeds: [embed] });
  }
}

async function handleWelcomeButton(interaction) {
  try {
    // Use deferUpdate to acknowledge the interaction silently (no "thinking" message)
    await interaction.deferUpdate();

    const guild = interaction.guild;
    const user = interaction.user;
    const member = interaction.member;

    // Parse welcome message from custom ID
    const customIdParts = interaction.customId.split('_');
    let welcomeMessage = '';

    if (customIdParts.length >= 2 && customIdParts[1]) {
      try {
        welcomeMessage = Buffer.from(customIdParts[1], 'base64').toString('utf-8');
      } catch (error) {
        console.error('Error decoding welcome message:', error);
        welcomeMessage = 'Welcome to our server!';
      }
    } else {
      welcomeMessage = 'Welcome to our server!';
    }

    // Get guild service for webhook management
    const { getService } = require('@services');
    const guildService = getService('guild');
    let webhook = null;

    // First, try to find an existing webhook for this user in this channel
    const existingWebhooks = await guildService.getGuildWebhooks(guild.id);
    webhook = existingWebhooks.find(wh =>
      wh.createdBy === user.id &&
      wh.channelId === interaction.channel.id &&
      wh.name.toLowerCase() === user.username.toLowerCase()
    );



    // If no webhook found, create a new one
    if (!webhook) {
      try {
        const discordWebhook = await interaction.channel.createWebhook({
          name: user.username,
          avatar: user.displayAvatarURL({ dynamic: true }),
          reason: `Welcome button webhook created by ${user.tag}`
        });

        webhook = await guildService.createWebhook(
          guild.id,
          user.username,
          discordWebhook.id,
          discordWebhook.token,
          interaction.channel.id,
          user.id
        );
      } catch (error) {
        console.error('Error creating webhook:', error);
        const embed = embeds.createDeny(
          { author: { id: user.id } },
          'Failed to create webhook. Please check bot permissions.'
        );
        return await interaction.followUp({ embeds: [embed] });
      }
    }
    // Send welcome message using webhook
    try {
      const { WebhookClient } = require('discord.js');
      const webhookClient = new WebhookClient({
        id: webhook.webhookId,
        token: webhook.webhookToken
      });

      // Process variables in welcome message
      const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
      const processedMessage = EmbedVariableProcessor.replaceVariables(welcomeMessage, {
        user: user,
        guild: guild,
        channel: interaction.channel
      });

      await webhookClient.send({
        content: processedMessage,
        username: member.displayName || user.username,
        avatarURL: user.displayAvatarURL({ dynamic: true })
      });

      // Update webhook last used time
      await guildService.updateWebhookLastUsed(guild.id, webhook.webhookId);

      // Silent success - interaction is already acknowledged with deferUpdate
      return;

    } catch (error) {
      // If webhook failed (likely deleted from Discord), try to create a new one and retry
      if (error.code === 10015 || error.message.includes('Unknown Webhook')) {
        try {
          // Remove the invalid webhook from database
          await guildService.deleteWebhook(guild.id, webhook.webhookId);

          // Create a new webhook
          const discordWebhook = await interaction.channel.createWebhook({
            name: user.username,
            avatar: user.displayAvatarURL({ dynamic: true }),
            reason: `Welcome button webhook recreated by ${user.tag}`
          });

          const newWebhook = await guildService.createWebhook(
            guild.id,
            user.username,
            discordWebhook.id,
            discordWebhook.token,
            interaction.channel.id,
            user.id
          );

          // Retry sending with new webhook
          const { WebhookClient } = require('discord.js');
          const newWebhookClient = new WebhookClient({
            id: newWebhook.webhookId,
            token: newWebhook.webhookToken
          });

          const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
          const processedMessage = EmbedVariableProcessor.replaceVariables(welcomeMessage, {
            user: user,
            guild: guild,
            channel: interaction.channel
          });

          await newWebhookClient.send({
            content: processedMessage,
            username: member.displayName || user.username,
            avatarURL: user.displayAvatarURL({ dynamic: true })
          });

          // Update webhook last used time
          await guildService.updateWebhookLastUsed(guild.id, newWebhook.webhookId);

          // Silent success
          return;

        } catch (retryError) {
          console.error('Error recreating webhook:', retryError);
          const embed = embeds.createDeny(
            { author: { id: user.id } },
            'Failed to send welcome message. Please check bot permissions.'
          );
          return await interaction.followUp({ embeds: [embed] });
        }
      } else {
        console.error('Error sending welcome message:', error);
        const embed = embeds.createDeny(
          { author: { id: user.id } },
          'Failed to send welcome message. Please try again.'
        );
        return await interaction.followUp({ embeds: [embed] });
      }
    }

  } catch (error) {
    // Send error to webhook logger
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Welcome Button Handler', {
        command: 'Welcome Button',
        args: `CustomId: ${interaction.customId}`,
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }

    try {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'An error occurred while processing the welcome button. Please try again.'
      );
      return await interaction.followUp({ embeds: [embed] });
    } catch (replyError) {
      // Silent fail for reply error
    }
  }
}

// ===== ROLE INTERACTION HANDLERS =====

/**
 * Handle button role interactions
 * @param {ButtonInteraction} interaction - The button interaction
 */
async function handleButtonRole(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildService = getService('guild');
    const buttonRoles = await guildService.getButtonRoles(interaction.guild.id);

    // Find the button role configuration
    const buttonRole = buttonRoles.find(br => br.buttonId === interaction.customId);
    if (!buttonRole) {
      // Button is no longer configured - delete it from the message
      try {
        const targetMessage = interaction.message;
        const isV2Message = targetMessage.flags?.has('IsComponentsV2');
        
        if (isV2Message) {
          // V2 message - rebuild container without this button
          const { ContainerBuilder, ButtonBuilder: V2ButtonBuilder } = require('discord.js');
          
          let components = [...targetMessage.components];
          let containerIndex = -1;
          
          for (let i = components.length - 1; i >= 0; i--) {
            if (components[i].components && Array.isArray(components[i].components)) {
              containerIndex = i;
              break;
            }
          }
          
          if (containerIndex !== -1) {
            const existingContainer = components[containerIndex];
            const newContainer = new ContainerBuilder();
            
            if (existingContainer.data?.accent_color) {
              newContainer.setAccentColor(existingContainer.data.accent_color);
            }
            
            const allButtons = [];
            
            if (existingContainer.components && Array.isArray(existingContainer.components)) {
              for (const comp of existingContainer.components) {
                if (comp.type === 1) {
                  if (comp.components && Array.isArray(comp.components)) {
                    for (const btnData of comp.components) {
                      if (btnData.type === 2) {
                        const customId = btnData['custom_id'] || btnData.customId;
                        // Skip the button that was clicked (the unconfigured one)
                        if (customId === interaction.customId) continue;
                        
                        const btn = new V2ButtonBuilder();
                        if (customId) btn.setCustomId(customId);
                        else if (btnData.url) btn.setURL(btnData.url);
                        if (btnData.style) btn.setStyle(btnData.style);
                        if (btnData.label) btn.setLabel(btnData.label);
                        if (btnData.emoji) {
                          const emojiValue = typeof btnData.emoji === 'object' ? btnData.emoji.name : btnData.emoji;
                          if (emojiValue) btn.setEmoji(emojiValue);
                        }
                        if (btnData.disabled) btn.setDisabled(btnData.disabled);
                        allButtons.push(btn);
                      }
                    }
                  }
                  continue;
                }
                
                // Copy other component types
                try {
                  if (comp.type === 14) {
                    newContainer.addSeparatorComponents((separator) => {
                      if (comp.divider !== undefined) separator.setDivider(comp.divider);
                      if (comp.spacing !== undefined) separator.setSpacing(comp.spacing);
                      return separator;
                    });
                  } else if (comp.type === 10) {
                    newContainer.addTextDisplayComponents((text) => text.setContent(comp.content || ''));
                  } else if (comp.type === 9) {
                    newContainer.addSectionComponents((section) => {
                      if (comp.components && Array.isArray(comp.components)) {
                        const textDisplays = comp.components
                          .filter(c => c.type === 10)
                          .map(c => (text) => text.setContent(c.content || ''));
                        if (textDisplays.length > 0) {
                          section.addTextDisplayComponents(...textDisplays);
                        }
                      }
                      if (comp.accessory) {
                        if (comp.accessory.type === 11) {
                          const thumbnailUrl = comp.accessory.media?.url || comp.accessory.url;
                          if (thumbnailUrl) {
                            section.setThumbnailAccessory((thumbnail) => {
                              thumbnail.setURL(thumbnailUrl);
                              if (comp.accessory.description) thumbnail.setDescription(comp.accessory.description);
                              if (comp.accessory.spoiler !== undefined) thumbnail.setSpoiler(comp.accessory.spoiler);
                              return thumbnail;
                            });
                          }
                        } else if (comp.accessory.type === 2) {
                          section.setButtonAccessory((btn) => {
                            if (comp.accessory.custom_id) btn.setCustomId(comp.accessory.custom_id);
                            if (comp.accessory.label) btn.setLabel(comp.accessory.label);
                            if (comp.accessory.style) btn.setStyle(comp.accessory.style);
                            if (comp.accessory.emoji) btn.setEmoji(comp.accessory.emoji);
                            if (comp.accessory.url) btn.setURL(comp.accessory.url);
                            if (comp.accessory.disabled) btn.setDisabled(comp.accessory.disabled);
                            return btn;
                          });
                        }
                      }
                      return section;
                    });
                  } else if (comp.type === 12) {
                    newContainer.addMediaGalleryComponents((gallery) => {
                      if (comp.items && Array.isArray(comp.items)) {
                        const items = comp.items.map(item => (mediaItem) => {
                          const url = item.media?.url || item.url;
                          if (url) mediaItem.setURL(url);
                          if (item.description) mediaItem.setDescription(item.description);
                          if (item.spoiler !== undefined) mediaItem.setSpoiler(item.spoiler);
                          return mediaItem;
                        });
                        gallery.addItems(...items);
                      }
                      return gallery;
                    });
                  }
                } catch (err) {
                  console.error('Error copying component:', err);
                }
              }
            }
            
            // Add remaining buttons back
            for (let i = 0; i < allButtons.length; i += 5) {
              const buttonSlice = allButtons.slice(i, i + 5);
              newContainer.addActionRowComponents((actionRow) =>
                actionRow.setComponents(...buttonSlice)
              );
            }
            
            components[containerIndex] = newContainer;
            await targetMessage.edit({ 
              components: components,
              flags: MessageFlags.IsComponentsV2
            });
          }
        } else {
          // Regular message - remove the button
          let components = targetMessage.components || [];
          components = components.map(row => {
            const newComponents = row.components.filter(component => 
              component.customId !== interaction.customId
            );
            return ActionRowBuilder.from(row).setComponents(newComponents);
          }).filter(row => row.components.length > 0);

          await targetMessage.edit({ components: components });
        }
      } catch (deleteError) {
        console.error('Error deleting unconfigured button:', deleteError);
      }
      
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'This button role is no longer configured. The button has been removed.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const role = interaction.guild.roles.cache.get(buttonRole.roleId);
    if (!role) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'The role for this button no longer exists.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const member = interaction.member;
    const hasRole = member.roles.cache.has(role.id);

    try {
      if (hasRole) {
        // Remove role
        await member.roles.remove(role);
        const embed = embeds.createSuccess(
          { author: { id: interaction.user.id } },
          `Removed ${role} from you`
        );
        return await interaction.editReply({ embeds: [embed] });
      } else {
        // Add role
        await member.roles.add(role);
        const embed = embeds.createSuccess(
          { author: { id: interaction.user.id } },
          `Added ${role} to you`
        );
        return await interaction.editReply({ embeds: [embed] });
      }
    } catch (roleError) {
      console.error('Error managing role:', roleError);
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'I don\'t have permission to manage this role.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Error in button role handler:', error);
    
    try {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'An error occurred while processing the button role.'
      );
      return await interaction.editReply({ embeds: [embed] });
    } catch (replyError) {
      // Silent fail
    }
  }
}


// ===== CONFESSION SYSTEM HANDLERS =====
// NOTE: Confession system uses ephemeral messages for PRIVACY reasons.
// When users submit confessions or replies, the confirmation messages are ephemeral
// so that only the submitter can see them. This protects user anonymity.
// The actual confessions posted to the channel are NOT ephemeral (public).

/**
 * Handle confession submit button
 * @param {ButtonInteraction} interaction - The button interaction
 */
async function handleConfessionSubmit(interaction) {
  try {
    const confessionService = getService('confession');
    const config = await confessionService.getConfessionConfig(interaction.guild.id);

    if (!config.enabled || !config.channelId) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'The confession system is not enabled on this server.'
      );
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Check if user is ignored
    const isIgnored = await confessionService.isUserIgnored(interaction.guild.id, interaction.user.id);
    if (isIgnored) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'You are not allowed to submit confessions in this server.'
      );
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Show modal
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
      .setCustomId('confession_modal')
      .setTitle('Submit a Confession');

    const confessionInput = new TextInputBuilder()
      .setCustomId('confession_content')
      .setLabel('Confession Content')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter your anonymous confession here...')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2000);

    const row = new ActionRowBuilder().addComponents(confessionInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

  } catch (error) {
    console.error('Error in handleConfessionSubmit:', error);
    
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Confession Submit Handler', {
        command: 'Confession Submit',
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }

    try {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'An error occurred while opening the confession form.'
      );
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (replyError) {
      // Silent fail
    }
  }
}

/**
 * Handle confession modal submission
 * @param {ModalSubmitInteraction} interaction - The modal submit interaction
 */
async function handleConfessionModal(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const confessionService = getService('confession');
    const config = await confessionService.getConfessionConfig(interaction.guild.id);

    if (!config.enabled || !config.channelId) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'The confession system is not enabled on this server.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const confessionChannel = interaction.guild.channels.cache.get(config.channelId);
    if (!confessionChannel) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'The confession channel no longer exists.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const confessionContent = interaction.fields.getTextInputValue('confession_content');
    const confessionId = await confessionService.getNextConfessionId(interaction.guild.id);

    // Get user's top role color
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const roleColor = member.displayHexColor !== '#000000' ? member.displayHexColor : colors.embed;

    // Create confession embed
    const confessionEmbed = new EmbedBuilder()
      .setColor(roleColor)
      .setTitle(`Anonymous Confession (#${confessionId})`)
      .setDescription(confessionContent);

    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confession_submit')
          .setLabel('Submit a Confession')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📝'),
        new ButtonBuilder()
          .setCustomId('confession_reply')
          .setLabel('Reply')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💬')
      );

    // Remove buttons from previous confession if exists
    if (config.lastMessageId) {
      try {
        const lastMessage = await confessionChannel.messages.fetch(config.lastMessageId);
        if (lastMessage) {
          await lastMessage.edit({ components: [] });
        }
      } catch (error) {
        // Message might be deleted, ignore
      }
    }

    // Send confession
    const sentMessage = await confessionChannel.send({ embeds: [confessionEmbed], components: [row] });
    
    // Track this confession
    await confessionService.addConfession(interaction.guild.id, confessionId, sentMessage.id, interaction.user.id);

    // Confirm to user
    const embed = embeds.createSuccess(
      { author: { id: interaction.user.id } },
      `Your **confession** has been submitted. Confession ID: ${confessionId}`
    );
    return await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Confession Modal Handler', {
        command: 'Confession Modal',
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }

    try {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'An error occurred while submitting your confession.'
      );
      return await interaction.editReply({ embeds: [embed] });
    } catch (replyError) {
      // Silent fail
    }
  }
}

/**
 * Handle confession reply button
 * @param {ButtonInteraction} interaction - The button interaction
 */
async function handleConfessionReply(interaction) {
  try {
    const confessionService = getService('confession');
    const config = await confessionService.getConfessionConfig(interaction.guild.id);

    if (!config.enabled || !config.channelId) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'The confession system is not enabled on this server.'
      );
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Check if user is ignored
    const isIgnored = await confessionService.isUserIgnored(interaction.guild.id, interaction.user.id);
    if (isIgnored) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'You are not allowed to submit confessions in this server.'
      );
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Try to extract confession ID from the message embed
    let confessionIdFromMessage = null;
    if (interaction.message?.embeds?.[0]) {
      const embed = interaction.message.embeds[0];
      
      // First check footer for "Reply to #X" pattern - this means it's a reply
      // and we want to reply to the ORIGINAL confession, not the reply itself
      if (embed.footer?.text) {
        const footerMatch = embed.footer.text.match(/Reply to #(\d+)/);
        if (footerMatch) {
          confessionIdFromMessage = footerMatch[1];
        }
      }
      
      // If no footer (meaning it's an original confession), extract from title
      if (!confessionIdFromMessage && embed.title) {
        const titleMatch = embed.title.match(/#(\d+)\)/);
        if (titleMatch) {
          confessionIdFromMessage = titleMatch[1];
        }
      }
    }

    // Get the latest confession ID as default
    const latestConfessionId = (config.nextConfessionId - 1).toString();
    const defaultId = confessionIdFromMessage || latestConfessionId;

    // Show modal
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
      .setCustomId('confession_reply_modal')
      .setTitle('Reply to Confession');

    const replyToInput = new TextInputBuilder()
      .setCustomId('reply_to_id')
      .setLabel('Confession ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`reply to #${defaultId}`)
      .setRequired(false)
      .setMinLength(1)
      .setMaxLength(10)
      .setValue(confessionIdFromMessage || '');

    const confessionInput = new TextInputBuilder()
      .setCustomId('confession_content')
      .setLabel('Reply Content')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter your anonymous reply here...')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2000);

    const row1 = new ActionRowBuilder().addComponents(replyToInput);
    const row2 = new ActionRowBuilder().addComponents(confessionInput);
    modal.addComponents(row1, row2);

    await interaction.showModal(modal);

  } catch (error) {
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Confession Reply Handler', {
        command: 'Confession Reply',
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }

    try {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'An error occurred while opening the reply form.'
      );
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (replyError) {
      // Silent fail
    }
  }
}

/**
 * Handle confession reply modal submission
 * @param {ModalSubmitInteraction} interaction - The modal submit interaction
 */
async function handleConfessionReplyModal(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const confessionService = getService('confession');
    const config = await confessionService.getConfessionConfig(interaction.guild.id);

    if (!config.enabled || !config.channelId) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'The confession system is not enabled on this server.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const confessionChannel = interaction.guild.channels.cache.get(config.channelId);
    if (!confessionChannel) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'The confession channel no longer exists.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    let replyToIdInput = interaction.fields.getTextInputValue('reply_to_id').trim();
    const confessionContent = interaction.fields.getTextInputValue('confession_content');
    
    // If no confession ID provided, use the latest one
    if (!replyToIdInput) {
      replyToIdInput = (config.nextConfessionId - 1).toString();
    }
    
    const replyToId = parseInt(replyToIdInput);
    if (isNaN(replyToId) || replyToId < 1) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'Invalid confession ID provided.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Find the confession message to reply to
    const confession = await confessionService.getConfessionById(interaction.guild.id, replyToId);
    if (!confession) {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        `Confession #${replyToId} not found.`
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Determine the original confession ID (for thread creation)
    // If this confession is a reply, we need to find the original confession's thread
    let originalConfessionId = replyToId;
    let confessionMessage;
    let thread;

    if (confession.replyTo) {
      // This is a reply to another confession, so we need to find the original confession
      originalConfessionId = confession.replyTo;
      const originalConfession = await confessionService.getConfessionById(interaction.guild.id, originalConfessionId);
      
      if (!originalConfession) {
        const embed = embeds.createDeny(
          { author: { id: interaction.user.id } },
          `Could not find the original confession #${originalConfessionId}.`
        );
        return await interaction.editReply({ embeds: [embed] });
      }

      // Fetch the original confession message to get its thread
      try {
        confessionMessage = await confessionChannel.messages.fetch(originalConfession.messageId);
      } catch (error) {
        const embed = embeds.createDeny(
          { author: { id: interaction.user.id } },
          `Could not find the message for confession #${originalConfessionId}.`
        );
        return await interaction.editReply({ embeds: [embed] });
      }
    } else {
      // This is an original confession, fetch it directly
      try {
        confessionMessage = await confessionChannel.messages.fetch(confession.messageId);
      } catch (error) {
        const embed = embeds.createDeny(
          { author: { id: interaction.user.id } },
          `Could not find the message for confession #${replyToId}.`
        );
        return await interaction.editReply({ embeds: [embed] });
      }
    }

    // Create or get existing thread from the original confession
    if (confessionMessage.hasThread) {
      thread = confessionMessage.thread;
    } else {
      try {
        thread = await confessionMessage.startThread({
          name: `Confession #${originalConfessionId} Replies`,
          autoArchiveDuration: 1440 // 24 hours
        });
      } catch (error) {
        const embed = embeds.createDeny(
          { author: { id: interaction.user.id } },
          'Failed to create thread for the confession.'
        );
        return await interaction.editReply({ embeds: [embed] });
      }
    }

    // Get next confession ID for the reply
    const replyConfessionId = await confessionService.getNextConfessionId(interaction.guild.id);

    // Get user's top role color
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const roleColor = member.displayHexColor !== '#000000' ? member.displayHexColor : colors.embed;

    // Send the reply in the thread as an embed with confession ID
    // Always show the original confession ID in the footer
    const replyEmbed = new EmbedBuilder()
      .setColor(roleColor)
      .setTitle(`Anonymous Reply (#${replyConfessionId})`)
      .setDescription(confessionContent)
      .setFooter({ text: `Reply to #${originalConfessionId}` });

    const replyMessage = await thread.send({
      embeds: [replyEmbed]
    });

    // Track this reply as a confession (always link to the original confession)
    await confessionService.addConfessionReply(interaction.guild.id, replyConfessionId, originalConfessionId, replyMessage.id, interaction.user.id);

    // Confirm to user
    const embed = embeds.createSuccess(
      { author: { id: interaction.user.id } },
      `Your **reply** has been submitted to confession #${originalConfessionId}. Reply ID: **${replyConfessionId}**`
    );
    return await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    if (interaction.client?.errorLogger) {
      interaction.client.errorLogger.log(error, 'Confession Reply Modal Handler', {
        command: 'Confession Reply Modal',
        user: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel
      });
    }

    try {
      const embed = embeds.createDeny(
        { author: { id: interaction.user.id } },
        'An error occurred while submitting your reply.'
      );
      return await interaction.editReply({ embeds: [embed] });
    } catch (replyError) {
      // Silent fail
    }
  }
}
