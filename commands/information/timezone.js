const { DateTime } = require('luxon');
const timezone = require('node-location-timezone');
const { embeds } = require('../../core/embeds');
const { findUser } = require('../../handlers/finder');
const { runHelpCommand } = require('../../utils/commandProcessor');
const userCache = require('../../database/cache/models/user');

module.exports = {
  name: "timezone",
  aliases: ['tz'],
  description: "View or set timezone information",
  usage: `{guildprefix}tz
{guildprefix}tz [user]
{guildprefix}tz set [city]`,
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
    const userTimezone = await userCache.getTimezone(userId);

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
    // Try to find timezone by city name first
    let timezoneId = timezone.findTimezoneByCityName(cityName);
    let locationName = cityName;

    // If not found, try by country name with fuzzy matching
    if (!timezoneId) {
      const countries = timezone.getCountries();
      const searchTerm = cityName.toLowerCase();

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

    // Update user timezone using cache system
    await userCache.setTimezone(message.author.id, timezoneId);

    const timeString = testTime.toFormat('LLLL dd, hh:mm a');
    const text = `Timezone set to **${locationName}**. Your current time is **${timeString}**`;

    return embeds.success(message, text);

  } catch (error) {

    return embeds.deny(message, 'An error occurred while **setting** your timezone.');
  }
}