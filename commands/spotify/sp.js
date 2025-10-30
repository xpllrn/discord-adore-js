const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { embeds } = require('../../core/embeds');

module.exports = {
  name: "sp",
  aliases: [],
  description: 'Get Spotify links for songs, artists, or what a user is currently playing',
  syntax: 'sp (song name/artist name/@user)',
  example: 'sp @vwsn',
  run: async(client, message, args) => {
    if (!args[0]) {
      return runHelpCommand(message, 'sp');
    }

    try {
      const firstArg = args[0];
      
      // Check if it's a user mention
      if (firstArg.startsWith('<@') && firstArg.endsWith('>')) {
        return await getLinkFromUser(client, message, args);
      }
      
      // Otherwise, search by query (song name or artist)
      return await getLinkBySearch(message, args);

    } catch (error) {
      console.error('[SP Command] Error:', error);
      return embeds.warn(message, 'An error occurred while searching for the track.');
    }
  }
};

/**
 * Get Spotify link by searching for a song or artist using public API
 */
async function getLinkBySearch(message, args) {
  try {
    const query = args.join(' ');
    await message.channel.sendTyping();

    // Use Spotify's public search URL
    const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    
    // Just send the raw link
    return message.channel.send(searchUrl);

  } catch (error) {
    throw error;
  }
}

/**
 * Get Spotify link for what another user is currently listening to
 */
async function getLinkFromUser(client, message, args) {
  try {
    // Parse user mention
    const userResult = await findUser(message.guild, args[0], client);
    
    if (!userResult.found) {
      return embeds.warn(message, userResult.error || 'User not found.');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    
    await message.channel.sendTyping();
    
    // Check Discord presence for Spotify activity
    const member = await message.guild.members.fetch(targetUser.id);
    const spotifyActivity = member.presence?.activities?.find(activity => activity.name === 'Spotify' && activity.type === 2);

    if (!spotifyActivity) {
      return embeds.warn(message, `**${targetUser.username}** isn't listening to any **music** right now!`);
    }

    // Extract track ID from presence
    const trackId = spotifyActivity.syncId; // Spotify track ID
    
    if (!trackId) {
      return embeds.warn(message, `Could not get track information from **${targetUser.username}**'s Spotify status.`);
    }

    const trackUrl = `https://open.spotify.com/track/${trackId}`;
    
    // Just send the raw link
    return message.channel.send(trackUrl);

  } catch (error) {
    throw error;
  }
}