const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const config = require('../../../config/setup');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "fm",
  aliases: ['np'],
  description: 'Show your current or last played track from Last.fm',
  syntax: 'fm (user) | fm set [username] | fm unset',
  example: 'fm @vwsn',
  isGroupCommand: true,

  subcommands: {
    set: {
      name: 'set',
      aliases: [],
      description: 'Set your Last.fm username',
      syntax: '{guildprefix}fm set [username]',
      parameters: ['username'],
      example: '{guildprefix}fm set vwsnxy',

      handler: async (client, message, args) => {
        const userService = getService('user');

        if (!args[0]) {
          return embeds.warn(message, 'Please provide your **Last.fm** username. Example: `,fm set vwsnxy`');
        }

        const username = args[0];

        if (username.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
          return embeds.warn(message, 'Invalid **Last.fm** username. Usernames can only contain letters, numbers, hyphens, and underscores.');
        }

        try {
          const verifyUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${encodeURIComponent(username)}&api_key=${config.apis.lastfm}&format=json`;
          const verifyResponse = await fetch(verifyUrl);

          if (!verifyResponse.ok) {
            throw new Error(`Last.fm API returned ${verifyResponse.status}`);
          }

          const verifyData = await verifyResponse.json();

          if (verifyData.error) {
            if (verifyData.error === 6) {
              return embeds.warn(message, `The **Last.fm** user **${username}** **doesn't exist**. Please check the spelling and try again.`);
            }
            throw new Error(`Last.fm API error: ${verifyData.message}`);
          }

          await userService.setLastFMUsername(message.author.id, username);

          return embeds.success(message, `Successfully set your **Last.fm** username to **${username}**. Use \`,fm\` to see your now playing!`);

        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.warn(message, `**Last.fm** service is currently unavailable, please try again later.`);
        }
      }
    },

    unset: {
      name: 'unset',
      aliases: [],
      description: 'Remove your Last.fm username',
      syntax: '{guildprefix}fm unset',
      parameters: [],
      example: '{guildprefix}fm unset',

      handler: async (client, message, args) => {
        const userService = getService('user');

        try {
          const currentUsername = await userService.getLastFMUsername(message.author.id);

          if (!currentUsername) {
            return embeds.warn(message, 'You **don\'t have** a **Last.fm** username set.');
          }

          await userService.setLastFMUsername(message.author.id, null);

          return embeds.success(message, `Successfully removed your **Last.fm** username (**${currentUsername}**).`);

        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.warn(message, 'An error occurred while removing your **Last.fm** username.');
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (args[0]) {
      const sub = args[0].toLowerCase();

      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1));
      }

      // Check if it's a user mention/ID
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.warn(message, userResult.error);
      }

      const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
      return await handleFMShared(message, targetUser);
    }

    // No args - show own now playing
    return await handleFMShared(message, null);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('fm')
    .setDescription('Last.fm integration commands')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addSubcommand(subcommand =>
      subcommand
        .setName('nowplaying')
        .setDescription('Show your current or last played track from Last.fm')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to check')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your Last.fm username')
        .addStringOption(option =>
          option
            .setName('username')
            .setDescription('Your Last.fm username')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unset')
        .setDescription('Remove your Last.fm username')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userService = getService('user');

    if (subcommand === 'nowplaying') {
      const targetUser = interaction.options.getUser('user');
      return await handleFMShared(interaction, targetUser);
    } 
    
    else if (subcommand === 'set') {
      const username = interaction.options.getString('username');

      if (username.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
        return embeds.warn(interaction, 'Invalid **Last.fm** username. Usernames can only contain letters, numbers, hyphens, and underscores.', false);
      }

      try {
        const verifyUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${encodeURIComponent(username)}&api_key=${config.apis.lastfm}&format=json`;
        const verifyResponse = await fetch(verifyUrl);

        if (!verifyResponse.ok) {
          throw new Error(`Last.fm API returned ${verifyResponse.status}`);
        }

        const verifyData = await verifyResponse.json();

        if (verifyData.error) {
          if (verifyData.error === 6) {
            return embeds.warn(interaction, `The **Last.fm** user **${username}** **doesn't exist**. Please check the spelling and try again.`, false);
          }
          throw new Error(`Last.fm API error: ${verifyData.message}`);
        }

        await userService.setLastFMUsername(interaction.user.id, username);

        return embeds.success(interaction, `Successfully set your **Last.fm** username to **${username}**. Use \`/fm nowplaying\` to see your now playing!`, false);

      } catch (error) {
        logger.webhook.error(error, interaction);
        return embeds.warn(interaction, `**Last.fm** service is currently unavailable, please try again later.`, false);
      }
    } 
    
    else if (subcommand === 'unset') {
      try {
        const currentUsername = await userService.getLastFMUsername(interaction.user.id);

        if (!currentUsername) {
          return embeds.warn(interaction, 'You **don\'t have** a **Last.fm** username set.', false);
        }

        await userService.setLastFMUsername(interaction.user.id, null);

        return embeds.success(interaction, `Successfully removed your **Last.fm** username (**${currentUsername}**).`, false);

      } catch (error) {
        logger.webhook.error(error, interaction);
        return embeds.warn(interaction, 'An error occurred while removing your **Last.fm** username.', false);
      }
    }
  }
};

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
      const helpText = isOwnProfile ? (isInteraction ? ' Use `/fm-set` to set it.' : ' Use `,fm set [username]` to set it.') : '';
      return embeds.warn(context, `${pronoun} ${verb} a **Last.fm** username set.${helpText}`, false);
    }

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
    } catch (error) {}

    const formatNumber = (num) => {
      return parseInt(num).toLocaleString();
    };

    const trackUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`;
    const userUrl = `https://www.last.fm/user/${encodeURIComponent(fmuser)}`;

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
