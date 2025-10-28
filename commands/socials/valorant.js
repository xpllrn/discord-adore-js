const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { fetch } = require('undici');

const parse = (str) => {
    const regex = /^([a-zA-Z0-9_ ]{1,16})#([a-zA-Z0-9_]{1,5})$/;

    const match = str.match(regex);

    if (!match) {
        return false;
    }

    const [, username, tagline] = match;

    return { username, tagline };
}

module.exports = {
  name: "valorant",
  aliases: ['valo', 'val'],
  description: 'Get information about a Valorant player',
  syntax: 'valorant (username#tag)',
  example: 'valorant fuck#valo',
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'valorant');
    }

    const parsed = parse(args.join(' '));

    if (!parsed) {
      return embeds.warn(message, 'Please provide a valid Valorant username in the format: **username#tag**');
    }

    const { username, tagline } = parsed;

    try {
      const url = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(`${username}#${tagline}`)}/overview`;

      const msg = await embeds.loading(message, `Searching for player **${username}#${tagline}**...`);

      // Try multiple API endpoints for better reliability
      let accountResponse = null;
      let apiUsed = '';

      // Try Henrik API first
      try {
        accountResponse = await fetch(`https://api.henrikdev.xyz/valorant/v1/account/${username}/${tagline}`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }).then((response) => response.json());

        if (accountResponse && accountResponse.status === 200) {
          apiUsed = 'Henrik API';
        } else {
          accountResponse = null;
        }
      } catch (error) {
        console.log('Henrik API failed:', error.message);
        accountResponse = null;
      }

      // If Henrik API fails, try alternative approach
      if (!accountResponse) {
        try {
          // Try using Tracker.gg as fallback
          const trackerUrl = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(`${username}#${tagline}`)}/overview`;

          // Create a basic response for Tracker.gg
          accountResponse = {
            status: 200,
            data: {
              name: username,
              tag: tagline,
              region: 'unknown',
              account_level: 'N/A',
              card: null,
              last_update_raw: null
            }
          };
          apiUsed = 'Tracker.gg (Limited Info)';
        } catch (fallbackError) {
          console.log('Fallback API also failed:', fallbackError.message);
        }
      }

      // If all APIs fail
      if (!accountResponse) {
        const errorEmbed = embeds.createWarn(message, `Valorant APIs are currently unavailable. Please try again later.`);
        return msg.edit({ embeds: [errorEmbed] });
      }

      if (accountResponse.status !== 200) {
        let errorMessage = `Could not find Valorant player **${username}#${tagline}**`;

        // Provide more specific error messages based on API response
        if (accountResponse.status === 404) {
          errorMessage = `Valorant player **${username}#${tagline}** was not found. Please check the username and tag.`;
        } else if (accountResponse.status === 429) {
          errorMessage = `Valorant API rate limit exceeded. Please try again in a few minutes.`;
        } else if (accountResponse.errors && accountResponse.errors.length > 0) {
          errorMessage = `Valorant API error: ${accountResponse.errors[0].message}`;
        }

        const errorEmbed = embeds.createWarn(message, errorMessage);
        return msg.edit({ embeds: [errorEmbed] });
      }

      const results = accountResponse;

      const { region, account_level, name, tag, card, last_update_raw } = results.data;

      // Get MMR data - only if we have a valid region and Henrik API worked
      let MMR = { data: {} };
      if (apiUsed === 'Henrik API' && region && region !== 'unknown') {
        try {
          MMR = await fetch(`https://api.henrikdev.xyz/valorant/v1/mmr/${region}/${name}/${tag}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }).then((response) => response.json()).catch(() => ({ data: {} }));
        } catch (mmrError) {
          console.log('MMR fetch failed:', mmrError.message);
          MMR = { data: {} };
        }
      }

      const { currenttierpatched, mmr_change_to_last_game, elo } = MMR.data || {};

      // Get recent matches - only if we have a valid region and Henrik API worked
      let matches = { data: [] };
      if (apiUsed === 'Henrik API' && region && region !== 'unknown') {
        try {
          matches = await fetch(`https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}?filter=competitive`, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }).then((response) => response.json()).catch(() => ({ data: [] }));
        } catch (matchError) {
          console.log('Matches fetch failed:', matchError.message);
          matches = { data: [] };
        }
      }

      let competitive = [];

      if (matches.data && matches.data.length > 0) {
        competitive = matches.data.slice(0, 5).map((match) => {
          const { metadata, players, teams } = match;
          const player = players.all_players.find((p) => p.name === name && p.tag === tag);

          let result = 'Unknown';
          if (player) {
            if (player.team === 'Red') {
              result = teams.red.has_won ? '🟢 Victory' : '🔴 Defeat';
            } else if (player.team === 'Blue') {
              result = teams.blue.has_won ? '🟢 Victory' : '🔴 Defeat';
            }
          }

          return `<t:${metadata.game_start}:d> ${result}`;
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.member.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`${region && region !== 'unknown' ? region.toUpperCase() : 'VALORANT'}: ${name}#${tag}`)
        .setURL(url)
        .setThumbnail(card ? card.small : null)
        .setFooter({
          text: `${apiUsed} • ${last_update_raw ? 'Last Updated' : 'Valorant Profile'}`,
          iconURL: 'https://img.icons8.com/color/512/valorant.png'
        });

      // Build description based on available data
      let description = `**Account Level:** ${account_level || 'Unknown'}`;

      if (currenttierpatched || elo) {
        description += `\n**Rank:** ${currenttierpatched || 'Unranked'}`;
        description += `\n**ELO:** ${elo || '0'}`;

        if (mmr_change_to_last_game) {
          description += ` (\`${mmr_change_to_last_game >= 0 ? '+' : ''}${mmr_change_to_last_game}\`)`;
        }
      } else if (apiUsed !== 'Henrik API') {
        description += `\n\n⚠️ **Limited data available** - Rank and match data requires Henrik API`;
        description += `\n🔗 [View full profile on Tracker.gg](${url})`;
      }

      embed.setDescription(description);

      if (competitive.length > 0) {
        embed.addFields({
          name: 'Recent Competitive Matches',
          value: competitive.join('\n'),
          inline: false
        });
      } else if (apiUsed === 'Henrik API') {
        embed.addFields({
          name: 'Recent Matches',
          value: 'No recent competitive matches found',
          inline: false
        });
      }

      if (last_update_raw) {
        embed.setTimestamp(new Date(last_update_raw * 1000));
      }

      const successEmbed = embed;
      return msg.edit({ embeds: [successEmbed] });

    } catch (error) {
      return embeds.warn(message, `Failed to fetch Valorant profile for **${username}#${tagline}**. Please try again later.`);
    }
  }
}