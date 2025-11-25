const { SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureUserData } = require('../../../database');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "birthday-set",
  slashOnly: true,
  data: new SlashCommandBuilder()
    .setName('birthday-set')
    .setDescription('Set your birthday (can only be set once)')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addIntegerOption(option =>
      option
        .setName('day')
        .setDescription('Day of the month (1-31)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(31)
    )
    .addStringOption(option =>
      option
        .setName('month')
        .setDescription('Month')
        .setRequired(true)
        .addChoices(
          { name: 'January', value: '1' },
          { name: 'February', value: '2' },
          { name: 'March', value: '3' },
          { name: 'April', value: '4' },
          { name: 'May', value: '5' },
          { name: 'June', value: '6' },
          { name: 'July', value: '7' },
          { name: 'August', value: '8' },
          { name: 'September', value: '9' },
          { name: 'October', value: '10' },
          { name: 'November', value: '11' },
          { name: 'December', value: '12' }
        )
    ),
  execute: async function(interaction) {
    const userService = getService('user');

    try {
      const day = interaction.options.getInteger('day');
      const monthString = interaction.options.getString('month');
      const month = parseInt(monthString);

      // Validate day for specific month
      if ((month === 2 && day > 29) ||
        ([4, 6, 9, 11].includes(month) && day > 30)) {
        return embeds.warn(interaction, 'Invalid day for the specified month', false);
      }

      await ensureUserData(interaction.user.id);

      const existingBirthday = await userService.getBirthday(interaction.user.id);

      if (existingBirthday && existingBirthday.day && existingBirthday.month) {
        const formattedBirthday = await userService.getFormattedBirthday(interaction.user.id);
        return embeds.warn(interaction, `You already have a birthday set to **${formattedBirthday}**. Birthdays cannot be changed once set.`, false);
      }

      await userService.setBirthday(interaction.user.id, day, month);
      const formattedBirthday = await userService.getFormattedBirthday(interaction.user.id);
      return embeds.success(interaction, `Set your birthday to **${formattedBirthday}**`, false);
    } catch (error) {
      logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });
      return embeds.deny(interaction, 'An error occurred while processing your request', false);
    }
  }
};
