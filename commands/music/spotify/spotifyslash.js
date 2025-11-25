const { SlashCommandBuilder, ApplicationIntegrationType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const config = require('../../../config/setup');
const { getService } = require('@services');
const { handleSpotifyError, checkSpotifyAccess, checkActiveDevices } = require('../../../utils/helpers');
const logger = require('../../../utils/logger');

module.exports = {
  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('spotify')
    .setDescription('Control your Spotify playback')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addSubcommand(subcommand =>
      subcommand
        .setName('link')
        .setDescription('Link your Spotify account')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlink')
        .setDescription('Unlink your Spotify account')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('Play a track or search query')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Track link or search query')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('Pause current playback')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('Skip to the next track')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('previous')
        .setDescription('Go back to the previous track')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('volume')
        .setDescription('Set playback volume')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('Volume level (0-100)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('repeat')
        .setDescription('Set repeat mode')
        .addStringOption(option =>
          option
            .setName('mode')
            .setDescription('Repeat mode')
            .setRequired(true)
            .addChoices(
              { name: 'Track', value: 'track' },
              { name: 'Context (Playlist/Album)', value: 'context' },
              { name: 'Off', value: 'off' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('shuffle')
        .setDescription('Toggle shuffle mode')
        .addStringOption(option =>
          option
            .setName('state')
            .setDescription('Shuffle state')
            .setRequired(true)
            .addChoices(
              { name: 'On', value: 'on' },
              { name: 'Off', value: 'off' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('queue')
        .setDescription('Add a track to your queue')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Track link or search query')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for a track and get its Spotify link')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Search query')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('recents')
        .setDescription('View your recently played tracks')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toptracks')
        .setDescription('View your top tracks')
        .addStringOption(option =>
          option
            .setName('timerange')
            .setDescription('Time range for top tracks')
            .setRequired(false)
            .addChoices(
              { name: 'Last 4 Weeks', value: 'short' },
              { name: 'Last 6 Months', value: 'medium' },
              { name: 'All Time', value: 'long' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('topartists')
        .setDescription('View your top artists')
        .addStringOption(option =>
          option
            .setName('timerange')
            .setDescription('Time range for top artists')
            .setRequired(false)
            .addChoices(
              { name: 'Last 4 Weeks', value: 'short' },
              { name: 'Last 6 Months', value: 'medium' },
              { name: 'All Time', value: 'long' }
            )
        )
    ),

  async execute(interaction) {
    try {
      const spotifyService = getService('spotify');
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'link':
          return await handleLinkSlash(interaction, spotifyService);
        
        case 'unlink':
          return await handleUnlinkSlash(interaction, spotifyService);
        
        case 'play':
          return await handlePlaySlash(interaction, spotifyService);
        
        case 'pause':
          return await handlePauseSlash(interaction, spotifyService);
        
        case 'skip':
          return await handleSkipSlash(interaction, spotifyService);
        
        case 'previous':
          return await handlePreviousSlash(interaction, spotifyService);
        
        case 'volume':
          return await handleVolumeSlash(interaction, spotifyService);
        
        case 'repeat':
          return await handleRepeatSlash(interaction, spotifyService);
        
        case 'shuffle':
          return await handleShuffleSlash(interaction, spotifyService);
        
        case 'queue':
          return await handleQueueSlash(interaction, spotifyService);
        
        case 'search':
          return await handleSearchSlash(interaction, spotifyService);
        
        case 'recents':
          return await handleRecentsSlash(interaction, spotifyService);
        
        case 'toptracks':
          return await handleTopTracksSlash(interaction, spotifyService);
        
        case 'topartists':
          return await handleTopArtistsSlash(interaction, spotifyService);
        
        default:
          return embeds.deny(interaction, 'Unknown subcommand', false);
      }
    } catch (error) {
      logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });
      return embeds.deny(interaction, 'An error occurred while executing this command', false);
    }
  }
};

// ===== LINK =====
async function handleLinkSlash(interaction, spotifyService) {
  try {
    const isLinked = await spotifyService.isLinked(interaction.user.id);

    if (isLinked) {
      return embeds.warn(interaction, 'Your **Spotify** account is **already linked**. Use `/spotify unlink` to unlink it first.', false);
    }

    const { authUrl, stateToken } = await spotifyService.createAuthSession(
      interaction.user.id,
      interaction.guild?.id || 'dm'
    );

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setAuthor({
        name: 'Connect your Spotify account',
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(
        `Authorize **adore** to use your Spotify account. You give us permission to control your active player and show your music statistics through commands.\n\n` +
        `If you want to remove your account with adore, run \`/spotify unlink\`.\n\n-# First time adore users have to **create a ticket** in the [\`support server\`](https://discord.gg/qsJMaTURqf) first to use spotify commands.`
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Authorize Spotify')
          .setStyle(ButtonStyle.Link)
          .setURL(authUrl),
        new ButtonBuilder()
          .setCustomId(`spotify_code_${interaction.user.id}_${stateToken}`)
          .setLabel('Enter Code')
          .setStyle(ButtonStyle.Secondary)
      );

    const sentMessage = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

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

        await interaction.editReply({ components: [disabledRow] });
      } catch (err) {
        // Message might be deleted, ignore
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    logger.webhook.error(error, interaction);
    return embeds.warn(interaction, 'Failed to create **Spotify** authorization link. Please try again later.', false);
  }
}

// ===== UNLINK =====
async function handleUnlinkSlash(interaction, spotifyService) {
  try {
    const isLinked = await spotifyService.isLinked(interaction.user.id);

    if (!isLinked) {
      return embeds.warn(interaction, 'You **don\'t have** a **Spotify** account linked. Use `/spotify link` to link one.', false);
    }

    const { createConfirmation } = require('../../../core/buttons');

    await createConfirmation(
      interaction,
      'Are you sure that you would like to unlink your **Spotify**?',
      async (confirmInteraction, confirmMessage) => {
        await spotifyService.revokeTokens(interaction.user.id);

        const successEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(`${config.emojis.success} ${interaction.user}: Your **Spotify** account has been **unlinked**!`);

        await confirmInteraction.update({ embeds: [successEmbed], components: [] });
      }
    );

  } catch (error) {
    logger.webhook.error(error, interaction);
    return embeds.warn(interaction, 'Failed to unlink **Spotify** account. Please try again later.', false);
  }
}

// ===== PLAY =====
async function handlePlaySlash(interaction, spotifyService) {
  try {
    const { isLinked, accessToken } = await checkSpotifyAccess(interaction);
    if (!isLinked || !accessToken) return;

    const devices = await checkActiveDevices(interaction, accessToken);
    if (!devices) return;

    const query = interaction.options.getString('query');
    
    await interaction.deferReply();

    // Check if it's a Spotify link
    if (query.includes('spotify.com/') || query.startsWith('spotify:')) {
      return await playFromSpotifyLinkSlash(interaction, query, spotifyService, accessToken);
    }
    
    // Otherwise search
    return await playBySearchSlash(interaction, query, spotifyService, accessToken);

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

async function playFromSpotifyLinkSlash(interaction, link, spotifyService, accessToken) {
  let uri = link;
  if (link.includes('spotify.com/')) {
    const match = link.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
    if (!match) {
      return embeds.warn(interaction, 'Invalid **Spotify** link. Please provide a track, album, or playlist link.', false);
    }
    uri = `spotify:${match[1]}:${match[2]}`;
  }

  if (!uri.match(/^spotify:(track|album|playlist):[a-zA-Z0-9]+$/)) {
    return embeds.warn(interaction, 'Invalid **Spotify** URI format.', false);
  }

  const [, type, id] = uri.split(':');

  if (type === 'track') {
    await spotifyService.startPlayback(uri, accessToken);
    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} ${interaction.user}: Now playing track from **Spotify** link`);
    return interaction.editReply({ embeds: [embed] });
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
      .setDescription(`${config.emojis.spotify} ${interaction.user}: Now playing **Spotify** ${typeLabel}`);
    return interaction.editReply({ embeds: [embed] });
  }
}

async function playBySearchSlash(interaction, query, spotifyService, accessToken) {
  const tracks = await spotifyService.searchTrack(query, accessToken);

  if (!tracks || tracks.length === 0) {
    return embeds.warn(interaction, `No tracks found for **${query}**`, false);
  }

  const track = tracks[0];
  await spotifyService.startPlayback(track.uri, accessToken);

  const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  const trackName = track.name;
  const artistName = track.artists.map(a => a.name).join(', ');
  
  const embed = new EmbedBuilder()
    .setColor(config.colors.spotify)
    .setDescription(
      `${config.emojis.spotify} ${interaction.user}: Now playing [\`${trackName}\`](${trackUrl}) by \`${artistName}\``
    );

  return interaction.editReply({ embeds: [embed] });
}

// ===== PAUSE =====
async function handlePauseSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    await spotifyService.pausePlayback(accessToken);

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} ${interaction.user}: Playback **paused**`);

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

// ===== SKIP =====
async function handleSkipSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    await interaction.deferReply();

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

      return interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(config.colors.spotify)
        .setDescription(`${config.emojis.spotify} Skipping to **next** track`);

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

// ===== PREVIOUS =====
async function handlePreviousSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    await interaction.deferReply();

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

      return interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(config.colors.spotify)
        .setDescription(`${config.emojis.spotify} Playing **previous** track`);

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

// ===== VOLUME =====
async function handleVolumeSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    const volume = interaction.options.getInteger('level');

    await spotifyService.setVolume(volume, accessToken);

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} ${interaction.user}: Volume set to **${volume}%** successfully`);

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

// ===== REPEAT =====
async function handleRepeatSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    const mode = interaction.options.getString('mode');

    await spotifyService.setRepeatMode(mode, accessToken);

    let modeText = mode === 'track' ? 'current track' : mode === 'context' ? 'playlist/album' : 'disabled';
    
    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} Repeat mode set to **${mode === 'off' ? 'disabled' : 'enabled'}** (\`${modeText}\`)`);

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

// ===== SHUFFLE =====
async function handleShuffleSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    const state = interaction.options.getString('state');
    const shuffleState = state === 'on';

    await spotifyService.setShuffleMode(shuffleState, accessToken);

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(`${config.emojis.spotify} Shuffle mode **${shuffleState ? 'enabled' : 'disabled'}** successfully`);

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, interaction);
    return embeds.warn(interaction, 'Failed to set shuffle mode. Make sure **Spotify** is open on a device.', false);
  }
}

// ===== QUEUE =====
async function handleQueueSlash(interaction, spotifyService) {
  try {
    const { isLinked, accessToken } = await checkSpotifyAccess(interaction);
    if (!isLinked || !accessToken) return;

    const devices = await checkActiveDevices(interaction, accessToken);
    if (!devices) return;

    const query = interaction.options.getString('query');
    
    await interaction.deferReply();

    // Check if it's a Spotify link
    if (query.includes('spotify.com/') || query.startsWith('spotify:')) {
      return await queueFromSpotifyLinkSlash(interaction, query, spotifyService, accessToken);
    }
    
    // Otherwise search
    return await queueBySearchSlash(interaction, query, spotifyService, accessToken);

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

async function queueFromSpotifyLinkSlash(interaction, link, spotifyService, accessToken) {
  let uri = link;
  if (link.includes('spotify.com/')) {
    const match = link.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (!match) {
      return embeds.warn(interaction, 'Invalid **Spotify** track link. Queue only supports individual tracks.', false);
    }
    uri = `spotify:track:${match[1]}`;
  }

  if (!uri.match(/^spotify:track:[a-zA-Z0-9]+$/)) {
    return embeds.warn(interaction, 'Queue only supports individual tracks. Please provide a track link.', false);
  }

  const axios = require('axios');
  await axios.post(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`,
    {},
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  const embed = new EmbedBuilder()
    .setColor(config.colors.spotify)
    .setDescription(`${config.emojis.spotify} ${interaction.user}: Added track to your **Spotify** queue`);
  
  return interaction.editReply({ embeds: [embed] });
}

async function queueBySearchSlash(interaction, query, spotifyService, accessToken) {
  const tracks = await spotifyService.searchTrack(query, accessToken);

  if (!tracks || tracks.length === 0) {
    return embeds.warn(interaction, `No tracks found for **${query}**`, false);
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
      `${config.emojis.spotify} ${interaction.user}: Added [\`${trackName}\`](${trackUrl}) by \`${artistName}\` to your queue`
    );

  return interaction.editReply({ embeds: [embed] });
}

// ===== SEARCH =====
async function handleSearchSlash(interaction, spotifyService) {
  try {
    const query = interaction.options.getString('query');
    
    await interaction.deferReply();

    const accessToken = await spotifyService.getClientCredentialsToken();
    const tracks = await spotifyService.searchTrack(query, accessToken);

    if (!tracks || tracks.length === 0) {
      return embeds.warn(interaction, `No tracks found for **${query}**`, false);
    }

    const track = tracks[0];
    const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
    
    return interaction.editReply(trackUrl);

  } catch (error) {
    logger.webhook.error(error, interaction);
    return embeds.warn(interaction, 'An error occurred while searching for the track.', false);
  }
}

// ===== RECENTS =====
async function handleRecentsSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    await interaction.deferReply();

    const recentTracks = await spotifyService.getRecentlyPlayed(accessToken, 10);

    if (!recentTracks || recentTracks.length === 0) {
      return embeds.warn(interaction, '**No recently played tracks** found.', false);
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
        name: `${interaction.user.username}'s Recently Played`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(trackList)
      .setFooter({ text: 'Powered by Spotify' });

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

// ===== TOP TRACKS =====
async function handleTopTracksSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    // Parse time range from options
    let timeRange = 'medium_term'; // default: 6 months
    let timeLabel = 'Last 6 Months';
    
    const timeArg = interaction.options.getString('timerange');
    if (timeArg === 'short') {
      timeRange = 'short_term';
      timeLabel = 'Last 4 Weeks';
    } else if (timeArg === 'long') {
      timeRange = 'long_term';
      timeLabel = 'All Time';
    }

    await interaction.deferReply();

    const topTracks = await spotifyService.getTopTracks(accessToken, timeRange, 10);

    if (!topTracks || topTracks.length === 0) {
      return embeds.warn(interaction, '**No top tracks** found for this time period.', false);
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
        name: `${interaction.user.username}'s Top Tracks`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(trackList)
      .setFooter({ text: `${timeLabel} • Powered by Spotify` });

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}

// ===== TOP ARTISTS =====
async function handleTopArtistsSlash(interaction, spotifyService) {
  try {
    const { accessToken } = await checkSpotifyAccess(interaction);
    if (!accessToken) return;

    // Parse time range from options
    let timeRange = 'medium_term'; // default: 6 months
    let timeLabel = 'Last 6 Months';
    
    const timeArg = interaction.options.getString('timerange');
    if (timeArg === 'short') {
      timeRange = 'short_term';
      timeLabel = 'Last 4 Weeks';
    } else if (timeArg === 'long') {
      timeRange = 'long_term';
      timeLabel = 'All Time';
    }

    await interaction.deferReply();

    const topArtists = await spotifyService.getTopArtists(accessToken, timeRange, 10);

    if (!topArtists || topArtists.length === 0) {
      return embeds.warn(interaction, '**No top artists** found for this time period.', false);
    }

    const artistList = topArtists.map((artist, index) => {
      const artistName = artist.name;
      const artistUrl = artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`;
      const genres = artist.genres && artist.genres.length > 0 ? ` - *${artist.genres.slice(0, 2).join(', ')}*` : '';
      return `**${index + 1}.** [\`${artistName}\`](${artistUrl})${genres}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setAuthor({
        name: `${interaction.user.username}'s Top Artists`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(artistList)
      .setFooter({ text: `${timeLabel} • Powered by Spotify` });

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, interaction);
    return handleSpotifyError(interaction, error);
  }
}
