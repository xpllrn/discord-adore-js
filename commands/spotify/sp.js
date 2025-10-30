const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');

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
      return message.channel.send('❌ An error occurred while searching for the track.');
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

    // Use Spotify's public search (no auth required for basic search)
    // We'll use a simple web scraping approach or public API
    const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    
    // For now, just return the search URL since we don't have public API access
    // In a real implementation, you'd want to use Spotify Web API with client credentials
    return message.channel.send(`🎵 **${query}**: ${searchUrl}`);

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
      return message.channel.send('❌ User not found.');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    
    await message.channel.sendTyping();
    
    // Check Discord presence for Spotify activity
    const member = await message.guild.members.fetch(targetUser.id);
    const spotifyActivity = member.presence?.activities?.find(activity => activity.name === 'Spotify' && activity.type === 2);

    if (!spotifyActivity) {
      return message.channel.send(`❌ **${targetUser.username}** isn't listening to any music right now!`);
    }

    // Extract track info from presence
    const trackName = spotifyActivity.details; // Song name
    const artistName = spotifyActivity.state; // Artist name
    const trackId = spotifyActivity.syncId; // Spotify track ID
    
    if (!trackId) {
      return message.channel.send(`❌ Could not get track information from **${targetUser.username}**'s Spotify status.`);
    }

    const trackUrl = `https://open.spotify.com/track/${trackId}`;
    
    // Just send the link
    return message.channel.send(`🎵 **${trackName}** by **${artistName}**: ${trackUrl}`);

  } catch (error) {
    throw error;
  }
}