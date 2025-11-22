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

      // Get full body avatar
      const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png`).then(r => r.json());
      const avatarUrl = avatarResponse.data?.[0]?.imageUrl || null;

      // Get user presence
      const presenceResponse = await fetch(`https://presence.roblox.com/v1/presence/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userIds: [userId] })
      }).then(r => r.json()).catch((err) => {
        console.log('Presence fetch error:', err);
        return { userPresences: [] };
      });

      console.log('Presence response:', JSON.stringify(presenceResponse));

      const presence = presenceResponse.userPresences?.[0];
      const isOnline = presence && presence.userPresenceType && presence.userPresenceType > 0; // 1=Online, 2=InGame, 3=InStudio
      const lastOnline = presence?.lastOnline ? new Date(presence.lastOnline).getTime() / 1000 : null;
      
      console.log('Is online:', isOnline, 'Presence type:', presence?.userPresenceType, 'Last online:', lastOnline);
      
      // Calculate last seen text
      let lastSeenText = 'Unknown';
      if (isOnline) {
        lastSeenText = `${config.emojis.online} Currently Online`;
      } else if (lastOnline) {
        const now = Date.now() / 1000;
        const diff = now - lastOnline;
        const hours = diff / 3600;
        const days = diff / 86400;
        
        if (hours < 1) {
          lastSeenText = 'Last seen few minutes ago';
        } else if (hours < 24) {
          lastSeenText = 'Last seen today';
        } else if (days < 2) {
          lastSeenText = 'Last seen yesterday';
        } else if (days < 7) {
          lastSeenText = 'Last seen this week';
        } else {
          lastSeenText = `Last seen <t:${Math.floor(lastOnline)}:R>`;
        }
      }

      // Get badges
      const badgesResponse = await fetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Asc`).then(r => r.json()).catch((err) => {
        console.log('Badges fetch error:', err);
        return { data: [] };
      });
      
      console.log('Badges count:', badgesResponse.data?.length || 0);
      if (badgesResponse.data && badgesResponse.data.length > 0) {
        console.log('First few badges:', badgesResponse.data.slice(0, 5).map(b => b.name));
      }

      const badgeEmotes = {
        'Welcome To The Club': config.emojis.robloxWelcomeToTheClub,
        'Warrior': config.emojis.robloxWarrior,
        'Veteran': config.emojis.robloxVeteran,
        'Administrator': config.emojis.robloxPremium,
        'Inviter': config.emojis.robloxInviter,
        'Homestead': config.emojis.robloxHomestead,
        'Friendship': config.emojis.robloxFriendship,
        'Combat Initiation': config.emojis.robloxCombat,
        'Bricksmith': config.emojis.robloxBricksmith,
        'Bloxxer': config.emojis.robloxBloxxer
      };

      let badgeEmotesList = [];
      if (badgesResponse.data && badgesResponse.data.length > 0) {
        badgesResponse.data.forEach(badge => {
          const emote = badgeEmotes[badge.name];
          if (emote && !badgeEmotesList.includes(emote)) {
            badgeEmotesList.push(emote);
          }
        });
      }
      
      console.log('Badge emotes found:', badgeEmotesList.length);

      // Get RAP and Value from Rolimons API
      let rapValue = 'N/A';
      let totalValue = 'N/A';
      try {
        const rolimonsResponse = await fetch(`https://api.rolimons.com/players/v1/playerinfo/${userId}`).then(r => r.json()).catch((err) => {
          console.log('Rolimons fetch error:', err);
          return null;
        });
        
        console.log('Rolimons response:', JSON.stringify(rolimonsResponse));
        
        if (rolimonsResponse && rolimonsResponse.success && rolimonsResponse.player_info) {
          const rap = rolimonsResponse.player_info[0]; // RAP
          const value = rolimonsResponse.player_info[1]; // Value
          
          if (rap && rap > 0) {
            rapValue = `[${rap.toLocaleString()}](https://www.rolimons.com/player/${userId})`;
          }
          if (value && value > 0) {
            totalValue = `[${value.toLocaleString()}](https://www.rolimons.com/player/${userId})`;
          }
        }
      } catch (error) {
        console.log('Failed to fetch Rolimons data:', error.message);
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.member.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`${userDetails.name} • ${userId}`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setThumbnail(avatarUrl);

      // Build description with bio and timestamp
      const createdTimestamp = Math.floor(new Date(userDetails.created).getTime() / 1000);
      let description = '';
      
      if (userDetails.description) {
        description += `${userDetails.description}\n\n`;
      }
      
      description += `<t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`;
      
      if (isOnline) {
        description += ` ${config.emojis.online}`;
      }

      embed.setDescription(description);

      // Add statistics - all inline
      embed.addFields(
        {
          name: 'Followers',
          value: followersCount.count?.toLocaleString() || '0',
          inline: true
        },
        {
          name: 'Follows',
          value: followingCount.count?.toLocaleString() || '0',
          inline: true
        },
        {
          name: 'Friends',
          value: friendsCount.count?.toLocaleString() || '0',
          inline: true
        },
        {
          name: 'RAP',
          value: rapValue,
          inline: true
        },
        {
          name: 'Value',
          value: totalValue,
          inline: true
        },
        {
          name: `Badges (${badgeEmotesList.length})`,
          value: badgeEmotesList.length > 0 ? badgeEmotesList.join(' ') : 'No badges',
          inline: true
        }
      );

      embed.setFooter({
        text: lastSeenText,
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
