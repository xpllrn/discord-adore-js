const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { embeds } = require('./embeds');
const { colors, emojis } = require('../config/setup');

/**
 * Creates pagination buttons for lists
 * @param {Object} message - Discord message object
 * @param {Array} items - Array of items to paginate
 * @param {Function} formatPage - Function to format each page (receives items, currentPage, totalPages)
 * @param {Number} itemsPerPage - Number of items per page (default: 10)
 * @param {String} title - Title for the embed
 * @returns {Promise} - Promise that resolves when pagination is complete
 */
async function createPagination(message, items, formatPage, itemsPerPage = 10, title = 'List') {
    if (items.length === 0) {
        return embeds.info.send(message, `There's NO items to display.`);
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
    const embed = createEmbed(currentPage);
    const buttons = createButtons(currentPage);
    const sentMessage = await message.channel.send({
        embeds: [embed],
        components: [buttons]
    });

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

            if (interaction.user.id !== message.author.id) {
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

                const newEmbed = createEmbed(currentPage);
                const newButtons = createButtons(currentPage);

                try {
                    await interaction.update({
                        embeds: [newEmbed],
                        components: [newButtons]
                    });
                } catch (error) {
                    if (error.code === 10062) {

                        await sentMessage.edit({ embeds: [newEmbed], components: [newButtons] });
                    } else {
                        throw error;
                    }
                }

            } else if (interaction.customId === 'pagination_right') {
                currentPage = Math.min(totalPages, currentPage + 1);

                const newEmbed = createEmbed(currentPage);
                const newButtons = createButtons(currentPage);

                try {
                    await interaction.update({
                        embeds: [newEmbed],
                        components: [newButtons]
                    });
                } catch (error) {
                    if (error.code === 10062) {

                        await sentMessage.edit({ embeds: [newEmbed], components: [newButtons] });
                    } else {
                        throw error;
                    }
                }

            } else if (interaction.customId === 'pagination_cancel') {
                const disabledButtons = createButtons(currentPage, true);
                try {
                    await interaction.update({
                        components: [disabledButtons]
                    });
                } catch (error) {
                    if (error.code === 10062) {

                        await sentMessage.edit({ components: [disabledButtons] });
                    } else {
                        throw error;
                    }
                }
                collector.stop();

            } else if (interaction.customId === 'pagination_move') {
                const infoEmbed = new EmbedBuilder()
                    .setColor(colors.info)
                    .setDescription(`<@${interaction.user.id}>: Choose a page between **1** - **${totalPages}**`);

                await interaction.reply({
                    embeds: [infoEmbed],
                    flags: MessageFlags.Ephemeral
                });

                // Create message collector for page number
                const messageCollector = message.channel.createMessageCollector({
                    filter: (msg) => msg.author.id === message.author.id,
                    time: 10000, // 10 seconds
                    max: 1
                });

                messageCollector.on('collect', async (msg) => {
                    const pageNumber = parseInt(msg.content);

                    // Delete the user's message first
                    try {
                        await msg.delete();
                    } catch (error) {
                        // Ignore if we can't delete the message
                    }

                    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
                        // Silently ignore invalid page numbers
                        return;
                    }

                    currentPage = pageNumber;
                    const newEmbed = createEmbed(currentPage);
                    const newButtons = createButtons(currentPage);

                    await sentMessage.edit({
                        embeds: [newEmbed],
                        components: [newButtons]
                    });
                });

                messageCollector.on('end', async () => {
                    // Delete the "choose page" message after timeout or collection
                    try {
                        await interaction.deleteReply();
                    } catch (error) {
                        // Ignore if we can't delete the reply
                    }
                });
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
 * @param {Object} message - Discord message object
 * @param {String} confirmationText - Text to display in the warning embed
 * @param {Function} onApprove - Function to execute when approved
 * @param {Function} onDecline - Function to execute when declined (optional)
 * @returns {Promise} - Promise that resolves when confirmation is complete
 */
async function createConfirmation(message, confirmationText, onApprove, onDecline = null) {
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
        .setDescription(`${emojis.warn} <@${message.author.id}>: ${confirmationText}`);

    const sentMessage = await message.channel.send({
        embeds: [confirmEmbed],
        components: [buttons]
    });

    // Create collector
    const collector = sentMessage.createMessageComponentCollector({
        time: 30000 // 30 seconds timeout
    });

    return new Promise((resolve) => {
        collector.on('collect', async (interaction) => {
            try {
                // Check if interaction is still valid
                if (!interaction.isRepliable()) {
                    return;
                }

                // Check if the user is the author of the command
                if (interaction.user.id !== message.author.id) {
                    const warnEmbed = new EmbedBuilder()
                        .setColor(colors.warn)
                        .setDescription(`${emojis.warn} <@${interaction.user.id}>: You are **NOT** the author of this embed`);

                    return interaction.reply({
                        embeds: [warnEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.customId === 'confirm_approve') {
                    // Execute approve function and pass interaction for editing
                    if (onApprove) {
                        await onApprove(interaction, sentMessage);
                    }

                    collector.stop();
                    resolve('approved');

                } else if (interaction.customId === 'confirm_decline') {
                    // Delete both the original command message and confirmation message
                    try {
                        await interaction.deferUpdate();
                        await sentMessage.delete();
                        await message.delete();
                    } catch (error) {
                        if (error.code === 10062) {

                            try {
                                await sentMessage.delete();
                                await message.delete();
                            } catch (deleteError) {
                                // Ignore deletion errors
                            }
                        }
                        // Ignore other deletion errors
                    }

                    // Execute decline function if provided
                    if (onDecline) {
                        await onDecline(interaction);
                    }

                    collector.stop();
                    resolve('declined');
                }
            } catch (error) {

            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                try {
                    // Delete both the original command message and confirmation message on timeout
                    await sentMessage.delete();
                    await message.delete();
                } catch (error) {
                    // Ignore deletion errors
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
