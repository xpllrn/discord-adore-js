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

  // Calculate join position if member exists
  let joinPosition = null;
  if (member && member.guild) {
    const members = await member.guild.members.fetch();
    const sortedMembers = members.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
    joinPosition = Array.from(sortedMembers.keys()).indexOf(member.id) + 1;
  }

  // Fetch full user for flags
  const fullUser = await client.users.fetch(user.id, { force: true });
  
  // Get user badges
  function getUserBadges(user, member) {
    const badges = [];
    const flags = user.flags?.toArray() || [];
    
    // Server owner badge
    if (member && member.guild.ownerId === user.id) {
      badges.push(config.emojis.crown);
    }
    
    // Discord Staff
    if (flags.includes('Staff')) badges.push(config.emojis.staff);
    
    // Partner
    if (flags.includes('Partner')) badges.push(config.emojis.partner);
    
    // Verified Developer (Early Verified Bot Developer)
    if (flags.includes('VerifiedDeveloper')) badges.push(config.emojis.verifiedDeveloper);
    
    // Active Developer
    if (flags.includes('ActiveDeveloper')) badges.push(config.emojis.activeDeveloper);
    
    // Early Supporter
    if (flags.includes('PremiumEarlySupporter')) badges.push(config.emojis.earlySupporter);
    
    // Bug Hunter Level 1
    if (flags.includes('BugHunterLevel1')) badges.push(config.emojis.bughunterLevel1);
    
    // Bug Hunter Level 2
    if (flags.includes('BugHunterLevel2')) badges.push(config.emojis.bughunterLevel2);
    
    // HypeSquad Events
    if (flags.includes('Hypesquad')) badges.push(config.emojis.hypesquadEvents);
    
    // HypeSquad Bravery
    if (flags.includes('HypeSquadOnlineHouse1')) badges.push(config.emojis.hypesquadBravery);
    
    // HypeSquad Brilliance
    if (flags.includes('HypeSquadOnlineHouse2')) badges.push(config.emojis.hypesquadBrilliance);
    
    // HypeSquad Balance
    if (flags.includes('HypeSquadOnlineHouse3')) badges.push(config.emojis.hypesquadBalance);
    
    // Quest completion badge
    if (flags.includes('CompletedQuest') || flags.includes('QuestCompleted')) badges.push(config.emojis.quest);
    
    // Check for Nitro subscription (avatar decoration or banner indicates Nitro)
    if (user.banner || user.avatarDecoration || user.accentColor) {
      // Check premium type if available
      // Note: Discord.js doesn't expose premium_type directly, but we can infer from features
      badges.push(config.emojis.goldNitro); // Default to gold nitro
    }
    
    // Server boosting badges (if member exists)
    if (member && member.premiumSince) {
      const boostMonths = Math.floor((Date.now() - member.premiumSince.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (boostMonths >= 24) badges.push(config.emojis.boostLevel9);
      else if (boostMonths >= 18) badges.push(config.emojis.boostLevel8);
      else if (boostMonths >= 15) badges.push(config.emojis.boostLevel7);
      else if (boostMonths >= 12) badges.push(config.emojis.boostLevel6);
      else if (boostMonths >= 9) badges.push(config.emojis.boostLevel5);
      else if (boostMonths >= 6) badges.push(config.emojis.boostLevel4);
      else if (boostMonths >= 3) badges.push(config.emojis.boostLevel3);
      else if (boostMonths >= 2) badges.push(config.emojis.boostLevel2);
      else badges.push(config.emojis.boostLevel1);
    }
    
    return badges.join(' ');
  }

  const badges = getUserBadges(fullUser, member);

  // Build container with display components
  const container = new ContainerBuilder()
    .setAccentColor(parseInt(config.colors.info.replace('#', ''), 16));

  // Title with display name and profile picture
  const displayName = member?.displayName || user.displayName || user.username;
  
  // Add section with thumbnail (profile picture)
  container.addSectionComponents((section) =>
    section
      .addTextDisplayComponents(
        (text) => text.setContent(`# ${displayName}`),
        (text) => text.setContent(`-# ${badges || 'No badges'}`)
      )
      .setThumbnailAccessory((thumbnail) =>
        thumbnail
          .setURL(user.displayAvatarURL({ size: 512, extension: 'png' }))
          .setDescription(`${user.username}'s avatar`)
      )
  );

  // Created and Joined timestamps
  container.addSeparatorComponents((separator) => separator);
  
  let timestampText = `> **Created**: <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`;
  
  if (member && member.joinedTimestamp) {
    const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
    timestampText += `\n> **Joined**: <t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)`;
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

  // Footer with join position and mutual servers
  container.addSeparatorComponents((separator) => separator);
  
  let footerText = '';
  if (joinPosition) {
    footerText = `-# Join position: ${joinPosition}`;
  }
  if (mutualCount > 0) {
    footerText += footerText ? ` • ${mutualCount} mutual server${mutualCount === 1 ? '' : 's'}` : `-# ${mutualCount} mutual server${mutualCount === 1 ? '' : 's'}`;
  }
  
  if (footerText) {
    container.addTextDisplayComponents(
      (text) => text.setContent(footerText)
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
