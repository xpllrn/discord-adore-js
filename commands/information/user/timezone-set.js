const { DateTime } = require('luxon');
const { SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const timezone = require('node-location-timezone');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "timezone-set",
  slashOnly: true,
  data: new SlashCommandBuilder()
    .setName('timezone-set')
    .setDescription('Set your timezone by city name')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addStringOption(option =>
      option
        .setName('city')
        .setDescription('City name (e.g., London, New York, Tokyo)')
        .setRequired(true)
    ),
  execute: async function(interaction) {
    try {
      const cityName = interaction.options.getString('city');
      const userService = getService('user');
      let timezoneId = null;
      let locationName = cityName;
      const searchTerm = cityName.toLowerCase();

      // First, try to find the best matching city by searching all locations
      const locations = timezone.getLocations();
      
      // Priority matching for common ambiguous names
      const priorityMatches = {
        'london': 'United Kingdom of Great Britain and Northern Ireland',
        'paris': 'France',
        'berlin': 'Germany',
        'moscow': 'Russian Federation'
      };

      if (priorityMatches[searchTerm]) {
        const priorityLocation = locations.find(loc => 
          loc.city && loc.city.toLowerCase() === searchTerm && 
          loc.country.name === priorityMatches[searchTerm]
        );
        if (priorityLocation) {
          timezoneId = priorityLocation.timezone;
          locationName = `${priorityLocation.city}, ${priorityLocation.country.name}`;
        }
      }

      // If no priority match, try exact city name match (first result)
      if (!timezoneId) {
        const cityMatch = locations.find(loc => 
          loc.city && loc.city.toLowerCase() === searchTerm
        );
        if (cityMatch) {
          timezoneId = cityMatch.timezone;
          locationName = `${cityMatch.city}, ${cityMatch.country.name}`;
        }
      }

      // Try common location aliases and regions
      if (!timezoneId) {
        const aliases = {
          'england': 'Europe/London',
          'uk': 'Europe/London',
          'britain': 'Europe/London',
          'great britain': 'Europe/London',
          'united kingdom': 'Europe/London',
          'maine': 'America/New_York',
          'california': 'America/Los_Angeles',
          'texas': 'America/Chicago',
          'florida': 'America/New_York',
          'new york state': 'America/New_York',
          'ontario': 'America/Toronto',
          'quebec': 'America/Montreal',
          'british columbia': 'America/Vancouver'
        };

        if (aliases[searchTerm]) {
          timezoneId = aliases[searchTerm];
          locationName = cityName;
        }
      }

      // Try by country name with fuzzy matching
      if (!timezoneId) {
        const countries = timezone.getCountries();

        const matchedCountry = countries.find(country =>
          country.name.toLowerCase() === searchTerm ||
          country.name.toLowerCase().includes(searchTerm) ||
          searchTerm.includes(country.name.toLowerCase()) ||
          (country.officialName && country.officialName.toLowerCase().includes(searchTerm))
        );

        if (matchedCountry && matchedCountry.timezones && matchedCountry.timezones.length > 0) {
          timezoneId = matchedCountry.timezones[0];
          locationName = matchedCountry.name;
        }
      }

      if (!timezoneId) {
        return embeds.warn(interaction, `**${cityName}** was not found. Please try a major city name like **Madrid**, **London**, **New York**, **Tokyo**, etc.`, false);
      }

      // Validate the timezone with Luxon
      const testTime = DateTime.now().setZone(timezoneId);
      if (!testTime.isValid) {
        return embeds.deny(interaction, `Invalid timezone data for **${cityName}**. Please try a **different** city.`, false);
      }

      // Update user timezone using service layer
      await userService.setTimezone(interaction.user.id, timezoneId);

      const timeString = testTime.toFormat('LLLL dd, hh:mm a');
      const text = `Timezone set to **${locationName}**. Your current time is **${timeString}**`;

      return embeds.success(interaction, text, false);

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while **setting** your timezone', false);
    }
  }
};
