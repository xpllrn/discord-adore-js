const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const config = require('../../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix } = require('../../../utils/commandProcessor');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

// Shared logic for FM command
async function handleFMShared(context, targetUser) {
  const userService = getService('user');
  const isInteraction = !!context.user;
  const author = isInteraction ? context.user : context.author;
  
  const userToCheck = targetUser || author;
  const targetUserId = userToCheck.id;

  try {
    const fmuser = await userService.getLastFMUsername(targetUserId);

    if (!fmuser) {
      const isOwnProfile = targetUserId === author.id;
      const pronoun = isOwnProfile ? 'You' : `**${userToCheck.username}**`;
      const verb = isOwnProfile ? "**don't have**" : "**doesn't have**";
      return embeds.warn(context, `${pronoun} ${verb} a **Last.fm** username set`, false);
    }

    // Get recent tracks
    const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(fmuser)}&api_key=${config.apis.lastfm}&format=json&limit=1&extended=1`;

    const recentResponse = await fetch(recentTracksUrl);

    if (!recentResponse.ok) {
      throw new Error(`Last.fm API returned ${recentResponse.status}`);
    }

    const recentData = await recentResponse.json();

    if (recentData.error) {
      if (recentData.error === 6) {
        return embeds.warn(context, `The **Last.fm** user **${fmuser}** **doesn't exist**`, false);
      }
      throw new Error(`Last.fm API error: ${recentData.message}`);
    }

    if (!recentData.recenttracks || !recentData.recenttracks.track || recentData.recenttracks.track.length === 0) {
      return embeds.warn(context, `**${fmuser}** **hasn't played** any tracks recently`, false);
    }

    const track = recentData.recenttracks.track[0];

    const trackName = track.name;
    const artistName = track.artist.name;
    const trackImage = track.image[3]['#text'] || track.image[2]['#text'] || '';
    const isNowPlaying = track['@attr'] && track['@attr'].nowplaying;

    // Get track info for play count
    let playCount = '0';
    try {
      const trackInfoUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&username=${encodeURIComponent(fmuser)}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&api_key=${config.apis.lastfm}&format=json&autocorrect=1`;

      const trackResponse = await fetch(trackInfoUrl);
      if (trackResponse.ok) {
        const trackData = await trackResponse.json();
        if (trackData.track && trackData.track.userplaycount) {
          playCount = trackData.track.userplaycount;
        }
      }
    } catch (error) {
      // Continue with playCount = '0'
    }

    // Format numbers with commas
    const formatNumber = (num) => {
      return parseInt(num).toLocaleString();
    };

    // Create Last.fm URLs
    const trackUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`;
    const userUrl = `https://www.last.fm/user/${encodeURIComponent(fmuser)}`;

    // Status indicator
    const statusText = isNowPlaying ? 'Now Playing' : 'Last Played';

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: `${statusText} - ${userToCheck.username}`,
        iconURL: userToCheck.displayAvatarURL({ dynamic: true }),
        url: userUrl
      })
      .setDescription(`**[${trackName}](${trackUrl})** - \`${formatNumber(playCount)} ${playCount === '1' ? 'play' : 'plays'}\`\n> by ${artistName}`);

    if (trackImage) {
      embed.setThumbnail(trackImage);
    }

    if (isInteraction) {
      return context.reply({ embeds: [embed] });
    } else {
      return context.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    logger.webhook.error(error, context);

    if (error.message.includes('doesn\'t exist')) {
      return embeds.warn(context, `The **Last.fm** user **doesn't exist**`, false);
    }

    return embeds.warn(context, `**Last.fm** service is currently unavailable, please try again later. For updates, check [@lastfmstatus](https://twitter.com/lastfmstatus)`, false);
  }
}

module.exports = {
  name: "fm",
  aliases: ['np'],
  description: 'Show your current or last played track from Last.fm',
  syntax: 'fm (user)',
  example: 'fm @vwsn',
  run: async(client, message, args) => {
    let targetUser = null;

    if (args[0]) {
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.warn(message, userResult.error);
      }

      targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    }

    return await handleFMShared(message, targetUser);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('fm')
    .setDescription('Show your current or last played track from Last.fm')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    return await handleFMShared(interaction, targetUser);
  }
}