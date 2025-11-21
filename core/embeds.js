const { EmbedBuilder } = require('discord.js');
const { colors, emojis } = require('../config/setup');

// Pre-built embed system with user's preferred format
// Supports both prefix commands (messages) and slash commands (interactions)
const embeds = {
    success: (context, text) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} <@${user.id}>: ${text}`)

        if (isInteraction) {
            return context.reply({ embeds: [embed], ephemeral: true });
        } else {
            return context.channel.send({ embeds: [embed] });
        }
    },

    deny: (context, text) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.error} <@${user.id}>: ${text}`)

        if (isInteraction) {
            return context.reply({ embeds: [embed], ephemeral: true });
        } else {
            return context.channel.send({ embeds: [embed] });
        }
    },

    warn: (context, text) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.warn)
            .setDescription(`${emojis.warn} <@${user.id}>: ${text}`)

        if (isInteraction) {
            return context.reply({ embeds: [embed], ephemeral: true });
        } else {
            return context.channel.send({ embeds: [embed] });
        }
    },

    info: (context, text) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`<@${user.id}>: ${text}`)

        if (isInteraction) {
            return context.reply({ embeds: [embed], ephemeral: true });
        } else {
            return context.channel.send({ embeds: [embed] });
        }
    },

    cooldown: (context, text) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.cooldown)
            .setDescription(`${emojis.cooldown} <@${user.id}>: ${text}`)

        if (isInteraction) {
            return context.reply({ embeds: [embed], ephemeral: true });
        } else {
            return context.channel.send({ embeds: [embed] });
        }
    },

    loading: (context, text) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor('#7985cd')
            .setDescription(`${emojis.loading} <@${user.id}>: ${text}`)

        if (isInteraction) {
            return context.reply({ embeds: [embed] });
        } else {
            return context.channel.send({ embeds: [embed] });
        }
    },

    // Helper functions to create embed objects without sending them (for editing)
    createSuccess: (context, text) => {
        const user = context.user || context.author;
        return new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} <@${user.id}>: ${text}`)
    },

    createDeny: (context, text) => {
        const user = context.user || context.author;
        return new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.error} <@${user.id}>: ${text}`)
    },

    createWarn: (context, text) => {
        const user = context.user || context.author;
        return new EmbedBuilder()
            .setColor(colors.warn)
            .setDescription(`${emojis.warn} <@${user.id}>: ${text}`)
    },

    createInfo: (context, text) => {
        const user = context.user || context.author;
        return new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`<@${user.id}>: ${text}`)
    },

    createLoading: (context, text) => {
        const user = context.user || context.author;
        return new EmbedBuilder()
            .setColor('#7985cd')
            .setDescription(`${emojis.loading} <@${user.id}>: ${text}`)
    }
}

module.exports = { embeds };
