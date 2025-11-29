const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const { colors } = require('../../../config/setup');
const logger = require('../../../utils/logger');

// Shared logic for AFK command
async function handleAFKShared(context, reason) {
  const userService = getService('user');
  const isInteraction = !!context.user;
  const user = isInteraction ? context.user : context.author;
  const content = reason || "AFK";

  try {
    // Check if user is already AFK using service layer
    const existingAFK = await userService.getAFKStatus(user.id);

    if (existingAFK) {
      // User is already AFK, remove AFK status
      await userService.removeAFKStatus(user.id);

      return embeds.success(context, 'Your **AFK** status has been removed', false);
    } else {
      // Set user as AFK using service layer
      await userService.setAFKStatus(user.id, content);

      const embed = new EmbedBuilder()
        .setColor(colors.success)
        .setDescription(`<@${user.id}>: You're now **AFK** with the status: **${content}**`);

      if (isInteraction) {
        return context.reply({ embeds: [embed] });
      } else {
        return context.channel.send({ embeds: [embed] });
      }
    }

  } catch (error) {
    logger.webhook.error(error, context);
    return embeds.deny(context, 'An error occurred while setting your AFK status', false);
  }
}

module.exports = {
  name: "afk",
  description: `Set an AFK status for when you are mentioned`,
  syntax: 'afk (reason)',
  example: 'afk sleeping',
  
  run: async (client, message, args) => {
    const reason = args.join(" ");
    return await handleAFKShared(message, reason);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set or remove your AFK status')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for being AFK')
        .setRequired(false)
    ),

  async execute(interaction) {
    const reason = interaction.options.getString('reason');
    return await handleAFKShared(interaction, reason);
  }
}
