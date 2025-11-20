const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const config = require('../../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix, runHelpCommand } = require('../../../utils/commandProcessor');
const { findUser } = require('../../../handlers/finder');
const { handleSpotifyError, checkSpotifyAccess, checkActiveDevices } = require('../../../utils/helpers');
const logger = require('../../../utils/logger');

module.exports = {
  name: "spotify",
  aliases: ['sp'],
  description: 'Manage Spotify playback and account',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const spotifyService = getService('spotify');
    const guildprefix = await getGuildPrefix(message.guild.id);
    const subcommand = String(args[0] || '').toLowerCase();

    if (!subcommand) {
      return runHelpCommand(message, 'spotify');
    }

    switch (subcommand) {
      case 'link':
      case 'login': {
        const subcommandInfo = {
          description: 'Link your Spotify account to control playback',
          usage: '{guildprefix}spotify link',
          aliases: ['login'],
          example: '{guildprefix}spotify link'
        };
        return await handleLogin(message, spotifyService, guildprefix);
      }
      
      case 'unlink':
      case 'logout': {
        const subcommandInfo = {
          description: 'Unlink your Spotify account',
          usage: '{guildprefix}spotify unlink',
          aliases: ['logout'],
          example: '{guildprefix}spotify unlink'
        };
        return await handleLogout(message, spotifyService, guildprefix);
      }
      
      case 'play': {
        const subcommandInfo = {
          description: 'Play a track, search query, or from another user',
          usage: '{guildprefix}spotify play <track link|search query|@user>',
          aliases: [],
          example: '{guildprefix}spotify play never gonna give you up'
        };
        return await handlePlay(client, message, args.slice(1), spotifyService);
      }
      
      case 'pause': {
        const subcommandInfo = {
          description: 'Pause current playback',
          usage: '{guildprefix}spotify pause',
          aliases: [],
          example: '{guildprefix}spotify pause'
        };
        return await handlePause(message, spotifyService);
      }
      
      case 'skip':
      case 'next': {
        const subcommandInfo = {
          description: 'Skip to the next track',
          usage: '{guildprefix}spotify skip',
          aliases: ['next'],
          example: '{guildprefix}spotify skip'
        };
        return await handleSkip(message, spotifyService);
      }
      
      case 'previous':
      case 'back': {
        const subcommandInfo = {
          description: 'Go back to the previous track',
          usage: '{guildprefix}spotify previous',
          aliases: ['back'],
          example: '{guildprefix}spotify previous'
        };
        return await handlePrevious(message, spotifyService);
      }
      
      case 'volume':
      case 'vol': {
        const subcommandInfo = {
          description: 'Set playback volume (0-100)',
          usage: '{guildprefix}spotify volume <0-100>',
          aliases: ['vol'],
          example: '{guildprefix}spotify volume 50'
        };
        return await handleVolume(message, args.slice(1), spotifyService);
      }
      
      case 'repeat':
      case 'loop': {
        const subcommandInfo = {
          description: 'Set repeat mode (track, context, or off)',
          usage: '{guildprefix}spotify repeat <track|context|off>',
          aliases: ['loop'],
          example: '{guildprefix}spotify repeat track'
        };
        return await handleRepeat(message, args.slice(1), spotifyService);
      }
      
      case 'shuffle': {
        const subcommandInfo = {
          description: 'Toggle shuffle mode on or off',
          usage: '{guildprefix}spotify shuffle <on|off>',
          aliases: [],
          example: '{guildprefix}spotify shuffle on'
        };
        return await handleShuffle(message, args.slice(1), spotifyService);
      }
      
      case 'queue':
      case 'q': {
        const subcommandInfo = {
          description: 'Add a track to your queue',
          usage: '{guildprefix}spotify queue <track link|search query>',
          aliases: ['q'],
          example: '{guildprefix}spotify queue bohemian rhapsody'
        };
        return await handleQueue(message, args.slice(1), spotifyService);
      }
      
      case 'search': {
        const subcommandInfo = {
          description: 'Search for a track and get its Spotify link',
          usage: '{guildprefix}spotify search <search query|@user>',
          aliases: [],
          example: '{guildprefix}spotify search the beatles'
        };
        return await handleGetLink(client, message, args.slice(1));
      }
      
      case 'recents':
      case 'recent': {
        const subcommandInfo = {
          description: 'View your recently played tracks',
          usage: '{guildprefix}spotify recents',
          aliases: ['recent'],
          example: '{guildprefix}spotify recents'
        };
        return await handleRecents(message, spotifyService);
      }
      
      case 'toptracks':
      case 'tracks': {
        const subcommandInfo = {
          description: 'View your top tracks (short, medium, or long term)',
          usage: '{guildprefix}spotify toptracks [short|medium|long]',
          aliases: ['tracks'],
          example: '{guildprefix}spotify toptracks short'
        };
        return await handleTopTracks(message, args.slice(1), spotifyService);
      }
      
      case 'topartists':
      case 'artists': {
        const subcommandInfo = {
          description: 'View your top artists (short, medium, or long term)',
          usage: '{guildprefix}spotify topartists [short|medium|long]',
          aliases: ['artists'],
          example: '{guildprefix}spotify topartists long'
        };
        return await handleTopArtists(message, args.slice(1), spotifyService);
      }
      
      default:
        return runHelpCommand(message, 'spotify');
    }
  }
};

// ===== LOGIN/LOGOUT =====

async function handleLogin(message, spotifyService, guildprefix) {
  try {
    const isLinked = await spotifyService.isLinked(message.author.id);

    if (isLinked) {
      return embeds.warn(message, 'Your **Spotify** account is already linked. Use `' + guildprefix + 'spotify logout` to unlink it first.');
    }

    const { authUrl, stateToken } = await spotifyService.createAuthSession(
      message.author.id,
      message.guild.id
    );

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setAuthor({
        name: 'Connect your Spotify account',
        iconURL: message.author.displayAvatarURL()
      })
      .setDescription(
        `Authorize **adore** to use your Spotify account. You give us permission to control your active player and show your music statistics through commands.\n\n` +
        `If you want to remove your account with adore, run \`${guildprefix}spotify logout\`.\n\n-# First time adore users have to **create a ticket** in the [\`support server\`](https://discord.gg/qsJMaTURqf) first to use spotify commands.`
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Authorize Spotify')
          .setStyle(ButtonStyle.Link)
          .setURL(authUrl),
        new ButtonBuilder()
          .setCustomId(`spotify_code_${message.author.id}_${stateToken}`)
          .setLabel('Enter Code')
          .setStyle(ButtonStyle.Secondary)
      );

    const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

    setTimeout(async () => {
      try {
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Authorize Spotify')
              .setStyle(ButtonStyle.Link)
              .setURL(authUrl)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`spotify_code_expired`)
              .setLabel('Enter Code')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

        await sentMessage.edit({ components: [disabledRow] });
      } catch (err) {
        // Message might be deleted, ignore
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to create **Spotify** authorization link. Please try again later.');
  }
}

async function handleLogout(message, spotifyService, guildprefix) {
  try {
    const isLinked = await spotifyService.isLinked(message.author.id);

    if (!isLinked) {
      return embeds.warn(message, 'You don\'t have a **Spotify** account linked. Use `' + guildprefix + 'spotify login` to link one.');
    }

    const { createConfirmation } = require('../../../core/buttons');

    await createConfirmation(
      message,
      'Are you sure that you would like to unlink your **Spotify**?',
      async (interaction, confirmMessage) => {
        await spotifyService.revokeTokens(message.author.id);

        const successEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(`${config.emojis.success} ${message.author}: Your **Spotify** account has been **unlinked**!`);

        await interaction.update({ embeds: [successEmbed], components: [] });
      }
    );

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to unlink **Spotify** account. Please try again later.');
  }
}

// ===== PLAYBACK CONTROLS =====

async function handlePlay(client, message, args, spotifyService) {
  if (!args[0]) {
    return runHelpCommand(message, 'spotify play');
  }

  try {
    const { isLinked, accessToken } = await checkSpotifyAccess(message);
    if (!isLinked || !accessToken) return;

    const devices = await checkActiveDevices(message, accessToken);
    if (!devices) return;

    const firstArg = args[0];
    
    if (firstArg.startsWith('<@') && firstArg.endsWith('>')) {
      return await playFromUser(client, message, args, spotifyService, accessToken);
    }
    
    if (firstArg.includes('spotify.com/') || firstArg.startsWith('spotify:')) {
      return await playFromSpotifyLink(message, args, spotifyService, accessToken);
    }
    
    return await playBySearch(message, args, spotifyService, accessToken);

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function playFromSpotifyLink(message, args, spotifyService, accessToken) {
  const link = args[0];
  await message.channel.sendTyping();

  let uri = link;
  if (link.includes('spotify.com/')) {
    const match = link.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
    if (!match) {
      return embeds.warn(message, 'Invalid **Spotify** link. Please provide a track, album, or playlist link.');
    }
    uri = `spotify:${match[1]}:${match[2]}`;
  }

  if (!uri.match(/^spotify:(track|album|playlist):[a-zA-Z0-9]+$/)) {
    return embeds.warn(message, 'Invalid **Spotify** URI format.');
  }

  const [, type, id] = uri.split(':');

  if (type === 'track') {
    await spotifyService.startPlayback(uri, accessToken);
    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} ${message.author}: Now playing track from **Spotify** link`);
    return message.channel.send({ embeds: [embed] });
  } else if (type === 'album' || type === 'playlist') {
    const axios = require('axios');
    await axios.put(
      'https://api.spotify.com/v1/me/player/play',
      { context_uri: uri },
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const typeLabel = type === 'album' ? 'album' : 'playlist';
    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} ${message.author}: Now playing **Spotify** ${typeLabel}`);
    return message.channel.send({ embeds: [embed] });
  }
}

async function playBySearch(message, args, spotifyService, accessToken) {
  const query = args.join(' ');
  await message.channel.sendTyping();

  const tracks = await spotifyService.searchTrack(query, accessToken);

  if (!tracks || tracks.length === 0) {
    return embeds.warn(message, `No tracks found for **${query}**`);
  }

  const track = tracks[0];
  await spotifyService.startPlayback(track.uri, accessToken);

  const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  const trackName = track.name;
  const artistName = track.artists.map(a => a.name).join(', ');
  
  const embed = new EmbedBuilder()
    .setColor(config.colors.spotify)
    .setDescription(
      `${config.emojis.spotify} ${message.author}: Now playing [\`${trackName}\`](${trackUrl}) by \`${artistName}\``
    );

  return message.channel.send({ embeds: [embed] });
}

async function playFromUser(client, message, args, spotifyService, accessToken) {
  const userResult = await findUser(message.guild, args[0], client);
  
  if (!userResult.found) {
    return embeds.warn(message, userResult.error || 'User not found.');
  }

  const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
  let trackUri = null;
  let trackName = null;
  let artistName = null;
  let trackUrl = null;

  const isTargetLinked = await spotifyService.isLinked(targetUser.id);
  
  if (isTargetLinked) {
    await message.channel.sendTyping();

    const targetAccessToken = await spotifyService.getAccessToken(targetUser.id);
    
    if (targetAccessToken) {
      try {
        const currentlyPlaying = await spotifyService.getCurrentlyPlaying(targetAccessToken);

        if (currentlyPlaying && currentlyPlaying.item) {
          const track = currentlyPlaying.item;
          trackUri = track.uri;
          trackName = track.name;
          artistName = track.artists.map(a => a.name).join(', ');
          trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
        }
      } catch (error) {
        // Silently fail if target user doesn't have API access (not in beta list)
        // Will fall back to Discord presence check
      }
    }
  }

  if (!trackUri) {
    await message.channel.sendTyping();
    
    const member = await message.guild.members.fetch(targetUser.id);
    const spotifyActivity = member.presence?.activities?.find(activity => activity.name === 'Spotify' && activity.type === 2);

    if (!spotifyActivity) {
      return embeds.warn(message, `**${targetUser.username}** isn't listening to any **music** right now!`);
    }

    trackName = spotifyActivity.details;
    artistName = spotifyActivity.state;
    const trackId = spotifyActivity.syncId;
    
    if (!trackId) {
      return embeds.warn(message, `Could not get track information from **${targetUser.username}**'s Spotify status.`);
    }

    trackUri = `spotify:track:${trackId}`;
    trackUrl = `https://open.spotify.com/track/${trackId}`;
  }

  await spotifyService.startPlayback(trackUri, accessToken);

  const embed = new EmbedBuilder()
    .setColor(config.colors.spotify)
    .setDescription(
      `${config.emojis.spotify} ${message.author}: Now playing [\`${trackName}\`](${trackUrl}) by \`${artistName}\``
    );

  return message.channel.send({ embeds: [embed] });
}

async function handlePause(message, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    await spotifyService.pausePlayback(accessToken);

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} ${message.author}: Playback **paused**`);

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function handleSkip(message, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    await spotifyService.skipToNext(accessToken);
    await new Promise(resolve => setTimeout(resolve, 500));

    const nowPlaying = await spotifyService.getCurrentlyPlaying(accessToken);

    if (nowPlaying && nowPlaying.item) {
      const track = nowPlaying.item;
      const trackName = track.name;
      const artistName = track.artists.map(a => a.name).join(', ');

      const embed = new EmbedBuilder()
        .setColor(config.colors.spotify)
        .setDescription(`${config.emojis.spotify} Skipped current track — now playing **${trackName}** by **${artistName}**`);

      return message.channel.send({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(config.colors.spotify)
        .setDescription(`${config.emojis.spotify} Skipping to **next** track`);

      return message.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function handlePrevious(message, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    await spotifyService.skipToPrevious(accessToken);
    await new Promise(resolve => setTimeout(resolve, 500));

    const nowPlaying = await spotifyService.getCurrentlyPlaying(accessToken);

    if (nowPlaying && nowPlaying.item) {
      const track = nowPlaying.item;
      const trackName = track.name;
      const artistName = track.artists.map(a => a.name).join(', ');

      const embed = new EmbedBuilder()
        .setColor(config.colors.spotify)
        .setDescription(`${config.emojis.spotify} Playing **previous** track — **${trackName}** by **${artistName}**`);

      return message.channel.send({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(config.colors.spotify)
        .setDescription(`${config.emojis.spotify} Playing **previous** track`);

      return message.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function handleVolume(message, args, spotifyService) {
  if (!args[0]) {
    return runHelpCommand(message, 'spotify volume');
  }

  const volume = parseInt(args[0]);

  if (isNaN(volume) || volume < 0 || volume > 100) {
    return embeds.warn(message, 'Volume must be a number between **0** and **100**');
  }

  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    await spotifyService.setVolume(volume, accessToken);

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} ${message.author}: Volume set to **${volume}%** successfully`);

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function handleRepeat(message, args, spotifyService) {
  const mode = args[0] ? args[0].toLowerCase() : 'track';
  
  if (!['track', 'context', 'off'].includes(mode)) {
    return embeds.warn(message, 'Repeat mode must be **track**, **context**, or **off**');
  }

  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    await spotifyService.setRepeatMode(mode, accessToken);

    let modeText = mode === 'track' ? 'current track' : mode === 'context' ? 'playlist/album' : 'disabled';
    
    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} Repeat mode set to **${mode === 'off' ? 'disabled' : 'enabled'}** (\`${modeText}\`)`);

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function handleShuffle(message, args, spotifyService) {
  const mode = args[0] ? args[0].toLowerCase() : 'on';
  let shuffleState = true;
  
  if (mode === 'off' || mode === 'false' || mode === '0') {
    shuffleState = false;
  }

  try {
    const isLinked = await spotifyService.isLinked(message.author.id);
    
    if (!isLinked) {
      return embeds.warn(message, 'You haven\'t linked your **Spotify** account. Use `,spotify login` to get started.');
    }

    const accessToken = await spotifyService.getAccessToken(message.author.id);
    
    if (!accessToken) {
      return embeds.warn(message, 'Failed to get Spotify access token.');
    }

    await spotifyService.setShuffleMode(shuffleState, accessToken);

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} Shuffle mode **${shuffleState ? 'enabled' : 'disabled'}** successfully`);

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to set shuffle mode. Make sure **Spotify** is open on a device.');
  }
}

async function handleQueue(message, args, spotifyService) {
  if (!args[0]) {
    return runHelpCommand(message, 'spotify queue');
  }

  try {
    const { isLinked, accessToken } = await checkSpotifyAccess(message);
    if (!isLinked || !accessToken) return;

    const devices = await checkActiveDevices(message, accessToken);
    if (!devices) return;

    const firstArg = args[0];
    
    if (firstArg.includes('spotify.com/') || firstArg.startsWith('spotify:')) {
      return await queueFromSpotifyLink(message, args, spotifyService, accessToken);
    }
    
    return await queueBySearch(message, args, spotifyService, accessToken);

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function queueFromSpotifyLink(message, args, spotifyService, accessToken) {
  const link = args[0];
  await message.channel.sendTyping();

  let uri = link;
  if (link.includes('spotify.com/')) {
    const match = link.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (!match) {
      return embeds.warn(message, 'Invalid **Spotify** track link. Queue only supports individual tracks.');
    }
    uri = `spotify:track:${match[1]}`;
  }

  if (!uri.match(/^spotify:track:[a-zA-Z0-9]+$/)) {
    return embeds.warn(message, 'Queue only supports individual tracks. Please provide a track link.');
  }

  const axios = require('axios');
  await axios.post(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`,
    {},
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  const embed = new EmbedBuilder()
    .setColor(config.colors.spotify)
    .setDescription(`${config.emojis.spotify} ${message.author}: Added track to your **Spotify** queue`);
  
  return message.channel.send({ embeds: [embed] });
}

async function queueBySearch(message, args, spotifyService, accessToken) {
  const query = args.join(' ');
  await message.channel.sendTyping();

  const tracks = await spotifyService.searchTrack(query, accessToken);

  if (!tracks || tracks.length === 0) {
    return embeds.warn(message, `No tracks found for **${query}**`);
  }

  const track = tracks[0];

  const axios = require('axios');
  await axios.post(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(track.uri)}`,
    {},
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  const trackName = track.name;
  const artistName = track.artists.map(a => a.name).join(', ');
  
  const embed = new EmbedBuilder()
    .setColor(config.colors.spotify)
    .setDescription(
      `${config.emojis.spotify} ${message.author}: Added [\`${trackName}\`](${trackUrl}) by \`${artistName}\` to your queue`
    );

  return message.channel.send({ embeds: [embed] });
}

// ===== GET LINK =====

async function handleGetLink(client, message, args) {
  if (!args[0]) {
    return runHelpCommand(message, 'spotify link');
  }

  try {
    const firstArg = args[0];
    
    if (firstArg.startsWith('<@') && firstArg.endsWith('>')) {
      return await getLinkFromUser(client, message, args);
    }
    
    return await getLinkBySearch(message, args);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'An error occurred while searching for the track.');
  }
}

async function getLinkBySearch(message, args) {
  const query = args.join(' ');
  await message.channel.sendTyping();

  const spotifyService = getService('spotify');
  const accessToken = await spotifyService.getClientCredentialsToken();
  const tracks = await spotifyService.searchTrack(query, accessToken);

  if (!tracks || tracks.length === 0) {
    return embeds.warn(message, `No tracks found for **${query}**`);
  }

  const track = tracks[0];
  const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  
  return message.channel.send(trackUrl);
}

async function getLinkFromUser(client, message, args) {
  const userResult = await findUser(message.guild, args[0], client);
  
  if (!userResult.found) {
    return embeds.warn(message, userResult.error || 'User not found.');
  }

  const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
  
  await message.channel.sendTyping();
  
  const member = await message.guild.members.fetch(targetUser.id);
  const spotifyActivity = member.presence?.activities?.find(activity => activity.name === 'Spotify' && activity.type === 2);

  if (!spotifyActivity) {
    return embeds.warn(message, `**${targetUser.username}** isn't listening to any **music** right now!`);
  }

  const trackId = spotifyActivity.syncId;
  
  if (!trackId) {
    return embeds.warn(message, `Could not get track information from **${targetUser.username}**'s Spotify status.`);
  }

  const trackUrl = `https://open.spotify.com/track/${trackId}`;
  
  return message.channel.send(trackUrl);
}

// ===== STATS COMMANDS =====

async function handleRecents(message, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    await message.channel.sendTyping();

    const recentTracks = await spotifyService.getRecentlyPlayed(accessToken, 10);

    if (!recentTracks || recentTracks.length === 0) {
      return embeds.warn(message, 'No recently played tracks found.');
    }

    const trackList = recentTracks.map((item, index) => {
      const track = item.track;
      const trackName = track.name;
      const artistName = track.artists.map(a => a.name).join(', ');
      const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
      return `**${index + 1}.** [\`${trackName}\`](${trackUrl}) by \`${artistName}\``;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setAuthor({
        name: `${message.author.username}'s Recently Played`,
        iconURL: message.author.displayAvatarURL()
      })
      .setDescription(trackList)
      .setFooter({ text: 'Powered by Spotify' });

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function handleTopTracks(message, args, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    // Parse time range from args
    let timeRange = 'medium_term'; // default: 6 months
    let timeLabel = 'Last 6 Months';
    
    const timeArg = args[0] ? args[0].toLowerCase() : '';
    if (timeArg === 'short' || timeArg === 'month' || timeArg === '4weeks') {
      timeRange = 'short_term';
      timeLabel = 'Last 4 Weeks';
    } else if (timeArg === 'long' || timeArg === 'alltime' || timeArg === 'all') {
      timeRange = 'long_term';
      timeLabel = 'All Time';
    }

    await message.channel.sendTyping();

    const topTracks = await spotifyService.getTopTracks(accessToken, timeRange, 10);

    if (!topTracks || topTracks.length === 0) {
      return embeds.warn(message, 'No top tracks found for this time period.');
    }

    const trackList = topTracks.map((track, index) => {
      const trackName = track.name;
      const artistName = track.artists.map(a => a.name).join(', ');
      const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
      return `**${index + 1}.** [\`${trackName}\`](${trackUrl}) by \`${artistName}\``;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setAuthor({
        name: `${message.author.username}'s Top Tracks`,
        iconURL: message.author.displayAvatarURL()
      })
      .setDescription(trackList)
      .setFooter({ text: `${timeLabel} • Powered by Spotify` });

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}

async function handleTopArtists(message, args, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(message);
    if (!accessToken) return;

    // Parse time range from args
    let timeRange = 'medium_term'; // default: 6 months
    let timeLabel = 'Last 6 Months';
    
    const timeArg = args[0] ? args[0].toLowerCase() : '';
    if (timeArg === 'short' || timeArg === 'month' || timeArg === '4weeks') {
      timeRange = 'short_term';
      timeLabel = 'Last 4 Weeks';
    } else if (timeArg === 'long' || timeArg === 'alltime' || timeArg === 'all') {
      timeRange = 'long_term';
      timeLabel = 'All Time';
    }

    await message.channel.sendTyping();

    const topArtists = await spotifyService.getTopArtists(accessToken, timeRange, 10);

    if (!topArtists || topArtists.length === 0) {
      return embeds.warn(message, 'No top artists found for this time period.');
    }

    const artistList = topArtists.map((artist, index) => {
      const artistName = artist.name;
      const artistUrl = artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`;
      const genres = artist.genres && artist.genres.length > 0 
        ? ` • ${artist.genres.slice(0, 2).join(', ')}` 
        : '';
      return `**${index + 1}.** [\`${artistName}\`](${artistUrl})${genres}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setAuthor({
        name: `${message.author.username}'s Top Artists`,
        iconURL: message.author.displayAvatarURL()
      })
      .setDescription(artistList)
      .setFooter({ text: `${timeLabel} • Powered by Spotify` });

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return handleSpotifyError(message, error);
  }
}
