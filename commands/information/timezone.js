const { DateTime } = require('luxon');
const timezone = require('node-location-timezone');
const { embeds } = require('../../core/embeds');
const { findUser } = require('../../handlers/finder');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { getService } = require('@services');

module.exports = {
  name: "timezone",
  aliases: ['tz'],
  description: "View or set timezone information",
  syntax: 'timezone (user/set)',
  example: 'timezone set London',
  run: async (client, message, args) => {


    if (!args[0]) {
      return await showUserTimezone(message, message.author.id);
    }

    // Set timezone
    if (args[0].toLowerCase() === 'set') {
      if (!args[1]) {
        return runHelpCommand(message, 'timezone');
      }

      const cityName = args.slice(1).join(' ');
      return await setUserTimezone(message, cityName);
    }

    // Show another user's timezone
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.warn(message, userResult.error);
    }

    const targetUserId = userResult.isGlobal ? userResult.user.id : userResult.user.user.id;
    return await showUserTimezone(message, targetUserId, userResult.user);
  }
};

async function showUserTimezone(message, userId, targetUser = null) {
  try {
    const userService = getService('user');
    const userTimezone = await userService.getTimezone(userId);

    if (!userTimezone) {
      const displayName = targetUser ?
        (targetUser.displayName || targetUser.username || targetUser.user?.username) :
        'You';
      return embeds.warn(message, `**${displayName}** ${targetUser ? 'has' : 'have'} not set a **timezone** yet. Use \`tz set [city]\` to set one.`);
    }

    const timezone = userTimezone;
    const now = DateTime.now().setZone(timezone);

    if (!now.isValid) {
      return embeds.deny(message, `**Invalid** timezone data stored. Please set your **timezone** again.`);
    }

    const displayName = targetUser ?
      (targetUser.displayName || targetUser.username || targetUser.user?.username) :
      'Your';

    const timeString = now.toFormat('LLLL dd, hh:mm a');
    const text = `**${displayName}** current time is **${timeString}**`;

    return embeds.info(message, text);

  } catch (error) {

    return embeds.deny(message, 'An error occurred while fetching timezone information.');
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

    return embeds.deny(message, 'An error occurred while **setting** your timezone.');
  }
}