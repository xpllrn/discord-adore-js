const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const fetch = require('node-fetch');
const { embeds } = require('../../../core/embeds');
const config = require('../../../config/setup');
const { getService } = require('@services');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

async function createUserInfoContainer(client, user, member) {
  // Create account creation timestamp
  const createdTimestamp = Math.floor(user.createdTimestamp / 1000);

  // Calculate mutual servers
  const mutualServers = client.guilds.cache.filter(guild => guild.members.cache.has(user.id));
  const mutualCount = mutualServers.size;

  // Fetch full user for banner check
  const fullUser = await client.users.fetch(user.id, { force: true });

  // Build container with display components
  const container = new ContainerBuilder()
    .setAccentColor(parseInt(config.colors.info.replace('#', ''), 16));

  // Title with display name and profile picture
  const displayName = member?.displayName || user.displayName || user.username;
  
  // Add section with thumbnail (profile picture)
  container.addSectionComponents((section) =>
    section
      .addTextDisplayComponents(
        (text) => text.setContent(`# ${displayName}`)
      )
      .setThumbnailAccessory((thumbnail) =>
        thumbnail
          .setURL(user.displayAvatarURL({ size: 512, extension: 'png' }))
          .setDescription(`${user.username}'s avatar`)
      )
  );

  // Created and Joined timestamps
  container.addSeparatorComponents((separator) => separator);
  
  let timestampText = `**Created**: <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`;
  
  if (member && member.joinedTimestamp) {
    const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
    timestampText += `\n**Joined**: <t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)`;
  }
  
  container.addTextDisplayComponents(
    (text) => text.setContent(timestampText)
  );

  // Roles section if user is in guild
  if (member && member.roles) {
    const roles = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(role => role.toString());

    if (roles.length > 0) {
      container.addSeparatorComponents((separator) => separator);
      
      const roleCount = roles.length;
      const displayRoles = roles.slice(0, 20).join(' ');
      const moreRoles = roleCount > 20 ? `... and ${roleCount - 20} more` : '';
      
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Roles (${roleCount})**`),
        (text) => text.setContent(`> ${displayRoles}${moreRoles ? '\n> ' + moreRoles : ''}`)
      );
    }
  }

  // Buttons for avatar and banner (always show both, disable banner if not available)
  container.addSeparatorComponents((separator) => separator);
  
  const hasBanner = fullUser.bannerURL() !== null;
  
  container.addActionRowComponents((actionRow) =>
    actionRow.setComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Avatar')
        .setURL(user.displayAvatarURL({ size: 4096, extension: 'png' })),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Banner')
        .setURL(hasBanner ? fullUser.bannerURL({ size: 4096, extension: 'png' }) : 'https://discord.com')
        .setDisabled(!hasBanner)
    )
  );

  // Footer with mutual servers
  if (mutualCount > 0) {
    container.addSeparatorComponents((separator) => separator);
    container.addTextDisplayComponents(
      (text) => text.setContent(`-# ${mutualCount} mutual server${mutualCount === 1 ? '' : 's'}`)
    );
  }

  return container;
}

async function checkLastFmNowPlaying(client, user, member, sentMessage) {
  try {
    const userService = getService('user');
    const fmuser = await userService.getLastFMUsername(user.id);

    if (!fmuser) {
      return;
    }

    const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(fmuser)}&api_key=${config.apis.lastfm}&format=json&limit=1&extended=1`;

    const response = await fetch(recentTracksUrl);

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    if (data.error || !data.recenttracks || !data.recenttracks.track || data.recenttracks.track.length === 0) {
      return;
    }

    const track = data.recenttracks.track[0];

    // Check if currently playing
    if (!track['@attr'] || !track['@attr'].nowplaying) {
      return;
    }

    const trackName = track.name;
    const artistName = track.artist.name;

    // Create the Last.fm status line
    const lastfmEmoji = config.emojis.lastfm;
    const trackUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`;
    const lastfmStatus = `${lastfmEmoji} Listening to **[${trackName}](${trackUrl})** by **${artistName}**`;

    // Recreate container with Last.fm status
    const container = await createUserInfoContainer(client, user, member);
    
    // Insert Last.fm status at the beginning
    const displayName = member?.displayName || user.displayName || user.username;
    container.components[0] = new ContainerBuilder()
      .addTextDisplayComponents(
        (text) => text.setContent(`# ${displayName}`),
        (text) => text.setContent(`-# @${user.username}`),
        (text) => text.setContent(lastfmStatus)
      ).components[0];

    await sentMessage.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

  } catch (error) {
    // Silently fail on any errors to not disrupt the userinfo command
  }
}

module.exports = {
  name: "userinfo",
  aliases: ['lookup', 'whois', 'ui'],
  description: "Get information about a Discord user",
  syntax: 'userinfo (user)',
  example: 'userinfo @vwsn',
  run: async (client, message, args) => {
    try {
      let targetUser = null;
      let isGlobalUser = false;

      // If no arguments provided, show info for message author
      if (!args[0]) {
        targetUser = message.member;
      } else {
        // Use universal finder to get user
        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        targetUser = userResult.user;
        isGlobalUser = userResult.isGlobal;
      }

      // Extract user and member data
      let user, member;
      if (isGlobalUser) {
        user = targetUser;
        member = null;
      } else {
        user = targetUser.user || targetUser;
        member = targetUser;
      }

      const container = await createUserInfoContainer(client, user, member);

      const sentMessage = await message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

      checkLastFmNowPlaying(client, user, member, sentMessage);
    } catch (error) {
      throw error;
    }
  },

  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Get information about a Discord user')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    ])
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get information about')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      let member = null;

      // Try to get member if in a guild
      if (interaction.guild) {
        member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      }

      const container = await createUserInfoContainer(interaction.client, targetUser, member);

      const sentMessage = await interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        fetchReply: true
      });

      checkLastFmNowPlaying(interaction.client, targetUser, member, sentMessage);
    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching user information');
    }
  }
};
