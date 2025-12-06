const { EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { colors, emojis } = require('../config/setup');

// Cache for guild embed colors (short TTL to stay fresh)
const colorCache = new Map();
const COLOR_CACHE_TTL = 60000; // 1 minute

/**
 * Get guild's custom embed color with caching
 * @param {string} guildId - Guild ID
 * @returns {Promise<string|null>} Custom color or null
 */
async function getGuildEmbedColor(guildId) {
    if (!guildId) return null;
    
    // Check cache first
    const cached = colorCache.get(guildId);
    if (cached && Date.now() - cached.timestamp < COLOR_CACHE_TTL) {
        return cached.color;
    }
    
    try {
        const { getService } = require('@services');
        const guildService = getService('guild');
        const color = await guildService.getEmbedColor(guildId);
        
        // Cache the result
        colorCache.set(guildId, { color, timestamp: Date.now() });
        return color;
    } catch (error) {
        // Silently fail and use default
        return null;
    }
}

/**
 * Clear color cache for a guild (call when color is updated)
 * @param {string} guildId - Guild ID
 */
function clearColorCache(guildId) {
    colorCache.delete(guildId);
}

// Helper to DM user when bot can't send in channel
async function dmMissingPerms(user, channel, guild) {
    try {
        const channelLink = `https://discord.com/channels/${guild.id}/${channel.id}`;
        await user.send(`${emojis.warn} Missing permissions in [#${channel.name}](${channelLink}) (${guild.name})`);
    } catch (e) {}
}

// Helper to safely send messages (handles missing permissions)
async function safeSendEmbed(channel, options, user) {
    try {
        // Check if bot has permission to send in this channel
        const botMember = channel.guild?.members?.me;
        if (botMember && !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
            // DM the user about missing permissions
            await dmMissingPerms(user, channel, channel.guild);
            return null;
        }
        return await channel.send(options);
    } catch (error) {
        // Handle Missing Permissions (50013) or Missing Access (50001)
        if (error.code === 50013 || error.code === 50001) {
            // DM the user about missing permissions
            await dmMissingPerms(user, channel, channel.guild);
            return null;
        }
        // Re-throw other errors
        throw error;
    }
}

/**
 * Get the appropriate embed color for a guild
 * Uses custom color if set, otherwise falls back to default
 * @param {Object} context - Message or interaction context
 * @param {string} defaultColor - Default color to use
 * @returns {Promise<string>} Color to use
 */
async function resolveEmbedColor(context, defaultColor) {
    const guildId = context.guild?.id || context.guildId;
    if (!guildId) return defaultColor;
    
    const customColor = await getGuildEmbedColor(guildId);
    return customColor || defaultColor;
}

// Pre-built embed system with user's preferred format
// Supports both prefix commands (messages) and slash commands (interactions)
// Note: info and embed colors can be customized per-guild (premium feature)
const embeds = {
    success: (context, text, ephemeral = true) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${emojis.success} <@${user.id}>: ${text}`)

        if (isInteraction) {
            if (context.deferred || context.replied) {
                return context.editReply({ embeds: [embed] });
            }
            const options = { embeds: [embed] };
            if (ephemeral) options.flags = MessageFlags.Ephemeral;
            return context.reply(options);
        } else {
            return safeSendEmbed(context.channel, { embeds: [embed] }, user);
        }
    },

    deny: (context, text, ephemeral = true) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${emojis.error} <@${user.id}>: ${text}`)

        if (isInteraction) {
            if (context.deferred || context.replied) {
                return context.editReply({ embeds: [embed] });
            }
            const options = { embeds: [embed] };
            if (ephemeral) options.flags = MessageFlags.Ephemeral;
            return context.reply(options);
        } else {
            return safeSendEmbed(context.channel, { embeds: [embed] }, user);
        }
    },

    warn: (context, text, ephemeral = true) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.warn)
            .setDescription(`${emojis.warn} <@${user.id}>: ${text}`)

        if (isInteraction) {
            if (context.deferred || context.replied) {
                return context.editReply({ embeds: [embed] });
            }
            const options = { embeds: [embed] };
            if (ephemeral) options.flags = MessageFlags.Ephemeral;
            return context.reply(options);
        } else {
            return safeSendEmbed(context.channel, { embeds: [embed] }, user);
        }
    },

    // Info uses guild custom color if set (premium feature)
    info: async (context, text, ephemeral = true) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;
        
        // Get custom color for this guild
        const color = await resolveEmbedColor(context, colors.info);

        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(`<@${user.id}>: ${text}`)

        if (isInteraction) {
            if (context.deferred || context.replied) {
                return context.editReply({ embeds: [embed] });
            }
            const options = { embeds: [embed] };
            if (ephemeral) options.flags = MessageFlags.Ephemeral;
            return context.reply(options);
        } else {
            return safeSendEmbed(context.channel, { embeds: [embed] }, user);
        }
    },

    cooldown: (context, text, ephemeral = true) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor(colors.cooldown)
            .setDescription(`${emojis.cooldown} <@${user.id}>: ${text}`)

        if (isInteraction) {
            if (context.deferred || context.replied) {
                return context.editReply({ embeds: [embed] });
            }
            const options = { embeds: [embed] };
            if (ephemeral) options.flags = MessageFlags.Ephemeral;
            return context.reply(options);
        } else {
            return safeSendEmbed(context.channel, { embeds: [embed] }, user);
        }
    },

    loading: (context, text, ephemeral = true) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;

        const embed = new EmbedBuilder()
            .setColor('#7985cd')
            .setDescription(`${emojis.loading} <@${user.id}>: ${text}`)

        if (isInteraction) {
            if (context.deferred || context.replied) {
                return context.editReply({ embeds: [embed] });
            }
            const options = { embeds: [embed] };
            if (ephemeral) options.flags = MessageFlags.Ephemeral;
            return context.reply(options);
        } else {
            return safeSendEmbed(context.channel, { embeds: [embed] }, user);
        }
    },

    // Custom embed with guild color (premium feature)
    // Use this for general embeds that should respect guild customization
    custom: async (context, text, ephemeral = true) => {
        const user = context.user || context.author;
        const isInteraction = !!context.user;
        
        // Get custom color for this guild
        const color = await resolveEmbedColor(context, colors.embed);

        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(`<@${user.id}>: ${text}`)

        if (isInteraction) {
            if (context.deferred || context.replied) {
                return context.editReply({ embeds: [embed] });
            }
            const options = { embeds: [embed] };
            if (ephemeral) options.flags = MessageFlags.Ephemeral;
            return context.reply(options);
        } else {
            return safeSendEmbed(context.channel, { embeds: [embed] }, user);
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

    // Async version that respects guild custom color
    createInfoAsync: async (context, text) => {
        const user = context.user || context.author;
        const color = await resolveEmbedColor(context, colors.info);
        return new EmbedBuilder()
            .setColor(color)
            .setDescription(`<@${user.id}>: ${text}`)
    },

    createLoading: (context, text) => {
        const user = context.user || context.author;
        return new EmbedBuilder()
            .setColor('#7985cd')
            .setDescription(`${emojis.loading} <@${user.id}>: ${text}`)
    },

    // Create custom colored embed (async, respects guild settings)
    createCustom: async (context, text) => {
        const user = context.user || context.author;
        const color = await resolveEmbedColor(context, colors.embed);
        return new EmbedBuilder()
            .setColor(color)
            .setDescription(`<@${user.id}>: ${text}`)
    }
}

module.exports = { 
    embeds, 
    getGuildEmbedColor, 
    clearColorCache,
    resolveEmbedColor 
};
