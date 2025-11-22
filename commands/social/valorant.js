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
      return embeds.warn(message, 'Please provide a **valid Valorant** username');
    }

    const { username, tagline } = parsed;

    try {
      const url = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(`${username}#${tagline}`)}/overview`;

      const msg = await embeds.loading(message, `Searching for player \`${username}#${tagline}\``);

      const API_KEY = 'YOUR_API_KEY'

      // Fetch account data with API key
      const accountResponse = await fetch(`https://api.henrikdev.xyz/valorant/v1/account/${username}/${tagline}`, {
        method: 'GET',
        headers: {
          'Authorization': API_KEY,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }).then((response) => response.json());

      if (!accountResponse) {
        const errorEmbed = embeds.createWarn(message, `Valorant API is currently unavailable. Please try again later.`);
        return msg.edit({ embeds: [errorEmbed] });
      }

      if (accountResponse.status !== 200) {
        let errorMessage = `Could not find Valorant player \`${username}#${tagline}\``;

        // Provide more specific error messages based on API response
        if (accountResponse.status === 404) {
          errorMessage = `Valorant player \`${username}#${tagline}\` was not found. Please check the username and tag.`;
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

      // Get MMR data with API key
      let MMR = { data: {} };
      try {
        MMR = await fetch(`https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${name}/${tag}`, {
          method: 'GET',
          headers: {
            'Authorization': API_KEY,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }).then((response) => response.json()).catch(() => ({ data: {} }));
      } catch (mmrError) {
        console.log('MMR fetch failed:', mmrError.message);
        MMR = { data: {} };
      }

      const { currenttierpatched, mmr_change_to_last_game, elo, ranking_in_tier } = MMR.data || {};

      // Get recent matches with API key
      let matches = { data: [] };
      try {
        matches = await fetch(`https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}?filter=competitive`, {
          method: 'GET',
          headers: {
            'Authorization': API_KEY,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }).then((response) => response.json()).catch(() => ({ data: [] }));
      } catch (matchError) {
        console.log('Matches fetch failed:', matchError.message);
        matches = { data: [] };
      }

      let competitive = [];
      let stats = { kills: 0, deaths: 0, assists: 0, matches: 0, wins: 0 };

      if (matches.data && matches.data.length > 0) {
        competitive = matches.data.slice(0, 5).map((match) => {
          const { metadata, players, teams } = match;
          const player = players.all_players.find((p) => p.name === name && p.tag === tag);

          let result = 'Match';
          let kda = '';
          if (player) {
            const { stats: playerStats } = player;
            stats.kills += playerStats.kills || 0;
            stats.deaths += playerStats.deaths || 0;
            stats.assists += playerStats.assists || 0;
            stats.matches++;

            if (player.team === 'Red') {
              result = teams.red.has_won ? 'Victory' : 'Defeat';
              if (teams.red.has_won) stats.wins++;
            } else if (player.team === 'Blue') {
              result = teams.blue.has_won ? 'Victory' : 'Defeat';
              if (teams.blue.has_won) stats.wins++;
            }

            kda = `${playerStats.kills}/${playerStats.deaths}/${playerStats.assists}`;
          }

          return `<t:${metadata.game_start}:R> • ${result} • ${kda}`;
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.member.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`${region ? region.toUpperCase() : 'VALORANT'} • ${name}#${tag}`)
        .setURL(url)
        .setThumbnail(card ? card.small : null)
        .setFooter({
          text: `${last_update_raw ? 'Last Updated' : 'Valorant Profile'}`,
          iconURL: 'https://img.icons8.com/color/512/valorant.png'
        });

      // Build description
      let description = `[${username}#${tagline}](${url})\n**Account Level** ${account_level || 'not sure'}`;

      if (currenttierpatched || elo) {
        description += `\n**Current Rank** ${currenttierpatched || 'Unranked'}`;
        description += `\n**Rating** ${elo || '0'} RR`;

        if (mmr_change_to_last_game) {
          const change = mmr_change_to_last_game >= 0 ? `+${mmr_change_to_last_game}` : mmr_change_to_last_game;
          description += ` \`${change}\``;
        }

        if (ranking_in_tier) {
          description += `\n**Leaderboard** #${ranking_in_tier.toLocaleString()}`;
        }
      }

      embed.setDescription(description);

      // Add statistics if available
      if (stats.matches > 0) {
        const kd = (stats.kills / Math.max(stats.deaths, 1)).toFixed(2);
        const winRate = ((stats.wins / stats.matches) * 100).toFixed(1);
        const avgKills = (stats.kills / stats.matches).toFixed(1);
        const avgDeaths = (stats.deaths / stats.matches).toFixed(1);
        const avgAssists = (stats.assists / stats.matches).toFixed(1);

        embed.addFields(
          {
            name: 'Recent Performance',
            value: `> **win rate** \`${winRate}%\` (${stats.wins}W ${stats.matches - stats.wins}L)\n> **k/d ratio** \`${kd}\`\n> **kda** \`${avgKills} / ${avgDeaths} / ${avgAssists}\``,
            inline: true
          }
        );
      }

      if (competitive.length > 0) {
        embed.addFields({
          name: 'Recent Matches',
          value: competitive.join('\n'),
          inline: false
        });
      } else {
        embed.addFields({
          name: 'Recent Matches',
          value: 'No recent **competitive matches** found',
          inline: false
        });
      }

      if (last_update_raw) {
        embed.setTimestamp(new Date(last_update_raw * 1000));
      }

      const successEmbed = embed;
      return msg.edit({ embeds: [successEmbed] });

    } catch (error) {
      return embeds.warn(message, `Failed to **fetch Valorant** profile for \`${username}#${tagline}\`. Please try again later.`);
    }
  }
}