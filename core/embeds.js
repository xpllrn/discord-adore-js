const { EmbedBuilder } = require('discord.js');
const { colors, emojis } = require('../config/setup');

// Pre-built embed system with user's preferred format
const embeds = {
    success: (message, text) => {
        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} <@${message.author.id}>: ${text}`)
        return message.channel.send({ embeds: [embed] })
    },

    deny: (message, text) => {
        const embed = new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.error} <@${message.author.id}>: ${text}`)
        return message.channel.send({ embeds: [embed] })
    },

    warn: (message, text) => {
        const embed = new EmbedBuilder()
            .setColor(colors.warn)
            .setDescription(`${emojis.warn} <@${message.author.id}>: ${text}`)
        return message.channel.send({ embeds: [embed] })
    },

    info: (message, text) => {
        const embed = new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`<@${message.author.id}>: ${text}`)
        return message.channel.send({ embeds: [embed] })
    },

    loading: (message, text) => {
        const embed = new EmbedBuilder()
            .setColor('#7985cd')
            .setDescription(`${emojis.loading} <@${message.author.id}>: ${text}`)
        return message.channel.send({ embeds: [embed] })
    },

    // Helper functions to create embed objects without sending them (for editing)
    createSuccess: (message, text) => {
        return new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} <@${message.author.id}>: ${text}`)
    },

    createDeny: (message, text) => {
        return new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.error} <@${message.author.id}>: ${text}`)
    },

    createWarn: (message, text) => {
        return new EmbedBuilder()
            .setColor(colors.warn)
            .setDescription(`${emojis.warn} <@${message.author.id}>: ${text}`)
    },

    createInfo: (message, text) => {
        return new EmbedBuilder()
            .setColor(colors.info)
            .setDescription(`<@${message.author.id}>: ${text}`)
    },

    createLoading: (message, text) => {
        return new EmbedBuilder()
            .setColor('#7985cd')
            .setDescription(`${emojis.loading} <@${message.author.id}>: ${text}`)
    }
}

module.exports = { embeds };
