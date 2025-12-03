const { DateTime } = require('luxon');
const { SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const timezone = require('node-location-timezone');
const { embeds } = require('../../../core/embeds');
const { findUser } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "timezone",
  aliases: ['tz'],
  description: "View or set timezone information",
  syntax: 'timezone (subcommand)',
  example: 'timezone set London',
  isGroupCommand: true,
  run: async (client, message, args) => {
    if (!args[0]) {
      return await showUserTimezone(message, message.author.id);
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'set': {
        const subcommandInfo = {
          description: 'Set your timezone by city name',
          syntax: '{guildprefix}timezone set [city]',
          aliases: [],
          example: '{guildprefix}timezone set London'
        };

        if (!args[1]) {
          return runHelpCommand(message, 'timezone');
        }

        const cityName = args.slice(1).join(' ');
        return await setUserTimezone(message, cityName);
      }

      default: {
        const subcommandInfo = {
          description: 'View a user\'s timezone',
          syntax: '{guildprefix}timezone (user)',
          aliases: [],
          example: '{guildprefix}timezone @user'
        };

        // Show another user's timezone
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        const targetUserId = userResult.isGlobal ? userResult.user.id : userResult.user.user.id;
        return await showUserTimezone(message, targetUserId, userResult.user);
      }
    }
  }
};

async function showUserTimezone(message, userId, targetUser = null) {
  try {
    const userService = getService('user');
    const userTimezone = await userService.getTimezone(userId);
    const isOwnTimezone = !targetUser;

    if (!userTimezone) {
      if (isOwnTimezone) {
        return embeds.warn(message, `You have not set a **timezone** yet. Use \`tz set [city]\` to set one.`);
      } else {
        const displayName = targetUser.displayName || targetUser.username || targetUser.user?.username;
        return embeds.warn(message, `**${displayName}** has not set a **timezone** yet.`);
      }
    }

    const tz = userTimezone;
    const now = DateTime.now().setZone(tz);

    if (!now.isValid) {
      return embeds.deny(message, `**Invalid** timezone data stored. Please set your **timezone** again.`);
    }

    const displayName = isOwnTimezone ? 'Your' : `**${targetUser.displayName || targetUser.username || targetUser.user?.username}**'s`;
    const timeString = now.toFormat('LLLL dd, hh:mm a');
    const text = `${displayName} current time is **${timeString}**`;

    return embeds.info(message, text);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'An error occurred while fetching timezone information');
  }
}

async function setUserTimezone(message, cityName) {
  try {
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

      // Find country by exact name or partial match
      const matchedCountry = countries.find(country =>
        country.name.toLowerCase() === searchTerm ||
        country.name.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(country.name.toLowerCase()) ||
        (country.officialName && country.officialName.toLowerCase().includes(searchTerm))
      );

      if (matchedCountry && matchedCountry.timezones && matchedCountry.timezones.length > 0) {
        timezoneId = matchedCountry.timezones[0]; // Use the first timezone for the country
        locationName = matchedCountry.name;
      }
    }

    if (!timezoneId) {
      return embeds.warn(message, `**${cityName}** was not found. Please try a major city name like **Madrid**, **London**, **New York**, **Tokyo**, etc.`);
    }

    // Validate the timezone with Luxon
    const testTime = DateTime.now().setZone(timezoneId);
    if (!testTime.isValid) {
      return embeds.deny(message, `Invalid timezone data for **${cityName}**. Please try a **different** city.`);
    }

    // Update user timezone using service layer
    await userService.setTimezone(message.author.id, timezoneId);

    const timeString = testTime.toFormat('LLLL dd, hh:mm a');
    const text = `Timezone set to **${locationName}**. Your current time is **${timeString}**`;

    return embeds.success(message, text);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'An error occurred while **setting** your timezone');
  }
}

// Add slash command data
module.exports.data = new SlashCommandBuilder()
  .setName('timezone')
  .setDescription('View a user\'s timezone')
  .setIntegrationTypes([
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  ])
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to view')
      .setRequired(false)
  );

// Add slash command execute
module.exports.execute = async function(interaction) {
  try {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    return await showUserTimezoneSlash(interaction, targetUser.id, targetUser);
  } catch (error) {
    logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });
    return embeds.deny(interaction, 'An error occurred while processing your request', false);
  }
};

// Slash command version of showUserTimezone
async function showUserTimezoneSlash(interaction, userId, targetUser) {
  try {
    const userService = getService('user');
    const userTimezone = await userService.getTimezone(userId);
    const isOwnTimezone = targetUser.id === interaction.user.id;

    if (!userTimezone) {
      if (isOwnTimezone) {
        return embeds.warn(interaction, `You have not set a **timezone** yet. Use \`,tz set [city]\` to set one.`, false);
      } else {
        return embeds.warn(interaction, `**${targetUser.username}** has not set a **timezone** yet.`, false);
      }
    }

    const tz = userTimezone;
    const now = DateTime.now().setZone(tz);

    if (!now.isValid) {
      return embeds.deny(interaction, `**Invalid** timezone data stored. Please set your **timezone** again.`, false);
    }

    const displayName = isOwnTimezone ? 'Your' : `**${targetUser.username}**'s`;
    const timeString = now.toFormat('LLLL dd, hh:mm a');
    const text = `${displayName} current time is **${timeString}**`;

    return embeds.info(interaction, text, false);

  } catch (error) {
    logger.webhook.error(error, interaction);
    return embeds.deny(interaction, 'An error occurred while fetching timezone information', false);
  }
}

// Slash command version of setUserTimezone
async function setUserTimezoneSlash(interaction, cityName) {
  try {
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