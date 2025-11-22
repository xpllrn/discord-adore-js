const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { fetch } = require('undici');

module.exports = {
  name: "roblox",
  aliases: ['rbx', 'rblx'],
  description: 'Get information about a Roblox player',
  syntax: 'roblox (username)',
  example: 'roblox Builderman',
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'roblox');
    }

    const username = args.join(' ');

    try {
      const msg = await embeds.loading(message, `Searching for player **${username}**...`);

      // Get user ID from username
      const userSearchResponse = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }).then((response) => response.json());

      if (!userSearchResponse.data || userSearchResponse.data.length === 0) {
        const errorEmbed = embeds.createWarn(message, `Roblox player **${username}** was not found`);
        return msg.edit({ embeds: [errorEmbed] });
      }

      // Find exact match or use first result
      let user = userSearchResponse.data.find(u => u.name.toLowerCase() === username.toLowerCase());
      if (!user) user = userSearchResponse.data[0];

      const userId = user.id;

      // Fetch detailed user info
      const [userDetails, friendsCount, followersCount, followingCount] = await Promise.all([
        fetch(`https://users.roblox.com/v1/users/${userId}`).then(r => r.json()),
        fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`).then(r => r.json()).catch(() => ({ count: 0 })),
        fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`).then(r => r.json()).catch(() => ({ count: 0 })),
        fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`).then(r => r.json()).catch(() => ({ count: 0 }))
      ]);

      // Get user avatar
      const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`).then(r => r.json());
      const avatarUrl = avatarResponse.data?.[0]?.imageUrl || null;

      // Get user presence
      const presenceResponse = await fetch(`https://presence.roblox.com/v1/presence/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userIds: [userId] })
      }).then(r => r.json()).catch(() => ({ userPresences: [] }));

      const presence = presenceResponse.userPresences?.[0];
      let status = 'Offline';
      if (presence) {
        if (presence.userPresenceType === 1) status = 'Online';
        else if (presence.userPresenceType === 2) status = 'In Game';
        else if (presence.userPresenceType === 3) status = 'In Studio';
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.member.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`ROBLOX • ${userDetails.name}`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setThumbnail(avatarUrl);

      // Build description
      let description = `**Display Name** ${userDetails.displayName}`;
      description += `\n**User ID** ${userId}`;
      description += `\n**Status** ${status}`;
      
      if (userDetails.description) {
        const bio = userDetails.description.length > 100 
          ? userDetails.description.substring(0, 100) + '...' 
          : userDetails.description;
        description += `\n\n${bio}`;
      }

      embed.setDescription(description);

      // Add statistics
      embed.addFields(
        {
          name: 'Account Info',
          value: `**Created** <t:${Math.floor(new Date(userDetails.created).getTime() / 1000)}:R>\n**Friends** ${friendsCount.count?.toLocaleString() || '0'}\n**Followers** ${followersCount.count?.toLocaleString() || '0'}\n**Following** ${followingCount.count?.toLocaleString() || '0'}`,
          inline: true
        }
      );

      // Get badges
      const badgesResponse = await fetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=10&sortOrder=Asc`).then(r => r.json()).catch(() => ({ data: [] }));
      
      if (badgesResponse.data && badgesResponse.data.length > 0) {
        const badgesList = badgesResponse.data.slice(0, 5).map(badge => `**${badge.name}**`).join('\n');
        embed.addFields({
          name: 'Recent Badges',
          value: badgesList,
          inline: true
        });
      }

      embed.setFooter({
        text: 'Roblox Profile',
        iconURL: 'https://images.rbxcdn.com/c69b74f49c6738f0a0d01b1db0b8e95c.png'
      });

      const successEmbed = embed;
      return msg.edit({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Roblox command error:', error);
      return embeds.warn(message, `Failed to fetch Roblox profile for **${username}**. Please try again later.`);
    }
  }
}
