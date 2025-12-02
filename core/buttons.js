const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { embeds } = require('./embeds');
const { colors, emojis } = require('../config/setup');

/**
 * Creates pagination buttons for lists
 * @param {Object} message - Discord message OR Interaction object
 * @param {Array} items - Array of items to paginate
 * @param {Function} formatPage - Function to format each page (receives items, currentPage, totalPages)
 * @param {Number} itemsPerPage - Number of items per page (default: 10)
 * @param {String} title - Title for the embed
 * @param {Number} flags - Optional MessageFlags (e.g., MessageFlags.IsComponentsV2)
 * @returns {Promise} - Promise that resolves when pagination is complete
 */
async function createPagination(message, items, formatPage, itemsPerPage = 10, title = 'List', flags = null) {
    // Determine if input is an interaction or message
    const isInteraction = !!message.user;
    const user = isInteraction ? message.user : message.author;

    if (items.length === 0) {
        return embeds.info(message, `There's NO items to display.`, false);
    }

    const totalPages = Math.ceil(items.length / itemsPerPage);
    let currentPage = 1;

    // Create initial embed
    const createEmbed = (page) => {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageItems = items.slice(startIndex, endIndex);

        return formatPage(pageItems, page, totalPages);
    };

    // Create buttons
    const createButtons = (page, disabled = false) => {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pagination_left')
                    .setEmoji(emojis.left)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled || page === 1),
                new ButtonBuilder()
                    .setCustomId('pagination_cancel')
                    .setEmoji(emojis.cancel)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('pagination_right')
                    .setEmoji(emojis.right)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled || page === totalPages),
                new ButtonBuilder()
                    .setCustomId('pagination_move')
                    .setEmoji(emojis.choose)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled || totalPages === 1)
            );
        return row;
    };

    // Send initial message
    const content = createEmbed(currentPage);

    // Determine if content is a container (Components V2) or embed
    const isContainer = content.constructor.name === 'ContainerBuilder';
    
    const messagePayload = {};
    
    if (isContainer) {
        // Container already has buttons inside, just send it
        messagePayload.components = [content];
    } else {
        // Embed needs external buttons
        const buttons = createButtons(currentPage);
        messagePayload.embeds = [content];
        messagePayload.components = [buttons];
    }
    
    if (flags) {
        messagePayload.flags = flags;
    }

    let sentMessage;
    if (isInteraction) {
        if (message.deferred || message.replied) {
            sentMessage = await message.editReply(messagePayload);
        } else {
            sentMessage = await message.reply({
                ...messagePayload,
                fetchReply: true,
                ephemeral: false
            });
        }
    } else {
        sentMessage = await message.channel.send(messagePayload);
    }

    // Only create collector if there are multiple pages
    if (totalPages === 1) {
        return;
    }

    // Create collector
    const collector = sentMessage.createMessageComponentCollector({
        time: 30000 // 30 seconds timeout
    });

    collector.on('collect', async (interaction) => {
        try {
            // Check if interaction is still valid
            if (!interaction.isRepliable()) {
                return;
            }

            if (interaction.user.id !== user.id) {
                const warnEmbed = new EmbedBuilder()
                    .setColor(colors.warn)
                    .setDescription(`${emojis.warn} <@${interaction.user.id}>: You are **NOT** the author of this embed`);

                return interaction.reply({
                    embeds: [warnEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.customId === 'pagination_left') {
                currentPage = Math.max(1, currentPage - 1);

                const newContent = createEmbed(currentPage);
                const isNewContainer = newContent.constructor.name === 'ContainerBuilder';
                
                const updatePayload = {};
                if (isNewContainer) {
                    updatePayload.components = [newContent];
                } else {
                    const newButtons = createButtons(currentPage);
                    updatePayload.embeds = [newContent];
                    updatePayload.components = [newButtons];
                }
                if (flags) {
                    updatePayload.flags = flags;
                }

                try {
                    await interaction.update(updatePayload);
                } catch (error) {
                    if (error.code === 10062) {
                        await sentMessage.edit(updatePayload);
                    } else {
                        throw error;
                    }
                }

            } else if (interaction.customId === 'pagination_right') {
                currentPage = Math.min(totalPages, currentPage + 1);

                const newContent = createEmbed(currentPage);
                const isNewContainer = newContent.constructor.name === 'ContainerBuilder';
                
                const updatePayload = {};
                if (isNewContainer) {
                    updatePayload.components = [newContent];
                } else {
                    const newButtons = createButtons(currentPage);
                    updatePayload.embeds = [newContent];
                    updatePayload.components = [newButtons];
                }
                if (flags) {
                    updatePayload.flags = flags;
                }

                try {
                    await interaction.update(updatePayload);
                } catch (error) {
                    if (error.code === 10062) {
                        await sentMessage.edit(updatePayload);
                    } else {
                        throw error;
                    }
                }

            } else if (interaction.customId === 'pagination_cancel') {
                try {
                    await interaction.deferUpdate();
                    if (isInteraction) {
                        await message.deleteReply();
                    } else {
                        await sentMessage.delete();
                    }
                } catch (error) {
                    // Ignore deletion errors
                }
                collector.stop();

            } else if (interaction.customId === 'pagination_move') {
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: ModalActionRowBuilder } = require('discord.js');
                
                // Create modal for page input
                const modal = new ModalBuilder()
                    .setCustomId('pagination_modal')
                    .setTitle('Jump to Page');

                const pageInput = new TextInputBuilder()
                    .setCustomId('page_number')
                    .setLabel(`Enter page number (1-${totalPages})`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(String(totalPages).length);

                const actionRow = new ModalActionRowBuilder().addComponents(pageInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);

                // Wait for modal submission
                try {
                    const modalSubmit = await interaction.awaitModalSubmit({
                        filter: (i) => i.customId === 'pagination_modal' && i.user.id === user.id,
                        time: 60000 // 60 seconds
                    });

                    const pageNumber = parseInt(modalSubmit.fields.getTextInputValue('page_number'));

                    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
                        await modalSubmit.reply({
                            content: `Invalid page number. Please enter a number between 1 and ${totalPages}.`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    currentPage = pageNumber;
                    const newContent = createEmbed(currentPage);
                    const isNewContainer = newContent.constructor.name === 'ContainerBuilder';
                    
                    const updatePayload = {};
                    if (isNewContainer) {
                        updatePayload.components = [newContent];
                    } else {
                        const newButtons = createButtons(currentPage);
                        updatePayload.embeds = [newContent];
                        updatePayload.components = [newButtons];
                    }
                    if (flags) {
                        updatePayload.flags = flags;
                    }

                    await modalSubmit.update(updatePayload);
                } catch (error) {
                    // Modal timed out or was cancelled
                }
            }

            // Reset collector timer
            collector.resetTimer();

        } catch (error) {
            console.error('Error handling pagination interaction:', error);
        }
    });

    collector.on('end', async () => {
        try {
            const disabledButtons = createButtons(currentPage, true);
            await sentMessage.edit({
                components: [disabledButtons]
            });
        } catch (error) {
            // Message might have been deleted
        }
    });
}

/**
 * Creates approve/decline confirmation buttons
 * @param {Object} message - Discord message OR Interaction object
 * @param {String} confirmationText - Text to display in the warning embed
 * @param {Function} onApprove - Function to execute when approved
 * @param {Function} onDecline - Function to execute when declined (optional)
 * @returns {Promise} - Promise that resolves when confirmation is complete
 */
async function createConfirmation(message, confirmationText, onApprove, onDecline = null) {
    // Determine if input is an interaction or message
    const isInteraction = !!message.user;
    const user = isInteraction ? message.user : message.author;

    // Create approve/decline buttons
    const createButtons = (disabled = false) => {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_approve')
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('confirm_decline')
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(disabled)
            );
        return row;
    };

    const buttons = createButtons();

    const confirmEmbed = new EmbedBuilder()
        .setColor(colors.warn)
        .setDescription(`${emojis.warn} <@${user.id}>: ${confirmationText}`);

    let sentMessage;
    if (isInteraction) {
        if (message.deferred || message.replied) {
            sentMessage = await message.editReply({
                embeds: [confirmEmbed],
                components: [buttons]
            });
        } else {
            sentMessage = await message.reply({
                embeds: [confirmEmbed],
                components: [buttons],
                fetchReply: true,
                ephemeral: false
            });
        }
    } else {
        sentMessage = await message.channel.send({
            embeds: [confirmEmbed],
            components: [buttons]
        });
    }

    // Create collector
    const collector = sentMessage.createMessageComponentCollector({
        time: 30000 // 30 seconds timeout
    });

    return new Promise((resolve) => {
        collector.on('collect', async (interaction) => {
            try {
                if (!interaction.isRepliable()) {
                    return;
                }

                if (interaction.user.id !== user.id) {
                    const warnEmbed = new EmbedBuilder()
                        .setColor(colors.warn)
                        .setDescription(`${emojis.warn} <@${interaction.user.id}>: You are **NOT** the author of this embed`);

                    return interaction.reply({
                        embeds: [warnEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.customId === 'confirm_approve') {
                    await interaction.deferUpdate();

                    if (onApprove) {
                        await onApprove(interaction, sentMessage);
                    }

                    collector.stop();
                    resolve('approved');

                } else if (interaction.customId === 'confirm_decline') {
                    try {
                        await interaction.deferUpdate();
                        if (isInteraction) {
                            await message.deleteReply();
                        } else {
                            await sentMessage.delete();
                            await message.delete();
                        }
                    } catch (error) {
                        // Ignore
                    }

                    if (onDecline) {
                        await onDecline(interaction);
                    }

                    collector.stop();
                    resolve('declined');
                }
            } catch (error) {
                // Ignore
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                try {
                    if (isInteraction) {
                        await message.deleteReply();
                    } else {
                        await sentMessage.delete();
                        await message.delete();
                    }
                } catch (error) {
                    // Ignore
                }
                resolve('timeout');
            }
        });
    });
}

module.exports = {
    createPagination,
    createConfirmation
};
