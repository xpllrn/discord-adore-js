const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix, runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const axios = require('axios');
const { fetch } = require('undici');
const { getModels } = require('../../database');

// Error helper function
const error = (member, author, type) => {
    if (member.id === author.id) {
        switch (type) {
            case ('notConnected'): {
                return `You have not set your **Last.fm** username - \`lastfm set (username)\``
            }
            case ('noRecentTracks'): {
                return `You don't have any **recent tracks**.`
            }
        }
    } else {
        switch (type) {
            case ('notConnected'): {
                return `**${member.tag}** has not set their **Last.fm** username.`
            }
            case ('noRecentTracks'): {
                return `**${member.tag}** does not have any **recent tracks**.`
            }
        }
    }
}

// Command groups
const commands = {
    general: [
        'howto', 'set',
        'update', 'refresh', 'index'
    ],
    username: [
        // FMBot-style short commands (auto-detect current track)
        'wa', 'wt', 'wal', 'pa', 'pt', 'pal',
        'recent', 'r', 'chart', 'streak', 'pace',
        // Original whoknows commands
        'whoknows', 'wk',
        'wkalbum', 'whoknowsalbum', 'wka',
        'wktrack', 'whoknowstrack', 'wkt',
        'globalwhoknows', 'globalwk', 'gwk',
        'globalwkalbum', 'globalwka', 'gwka',
        'globalwktrack', 'globalwkt', 'gwkt',
        // Top commands
        'topartists', 'topartist', 'artists', 'artist', 'tar', 'ta',
        'topalbums', 'topalbum', 'albums', 'album', 'tab', 'tl',
        'toptracks', 'toptrack', 'tracks', 'track', 'ttr', 'tt',
        // Plays commands
        'plays',
        'playsalbum', 'playsa', 'aplays',
        'playstrack', 'playst', 'tplays',
        // Social commands
        'compare', 'taste', 'mutual', 'match'
    ]
}, allCommands = [...commands.general, ...commands.username]

module.exports = {
    name: "lastfm",
    aliases: ['lf'],
    description: 'Manage your last.fm profile and settings',
    isGroupCommand: true,
    run: async (client, message, args) => {
        const userService = getService('user');
        const guildService = getService('guild');
        const guildprefix = await getGuildPrefix(message.guild.id);
        const command = String(args[0] || '').toLowerCase();

        if (!args[0] || !allCommands.includes(command)) {
            return runHelpCommand(message, 'lastfm');
        }

        // Check if user has Last.fm linked for username-required commands
        if (commands.username.includes(command)) {
            const fmUsername = await userService.getLastFMUsername(message.author.id);
            if (!fmUsername) {
                return embeds.warn(message, error(message.author, message.author, 'notConnected'));
            }
        }

        switch (command) {
            case 'howto': {
                const subcommandInfo = {
                    description: 'Show Last.fm setup guide',
                    usage: '{guildprefix}lastfm howto',
                    aliases: [],
                    parameters: [],
                    example: '{guildprefix}lastfm howto'
                };

                const embed = new EmbedBuilder()
                    .setColor(config.colors.info)
                    .setTitle('**Last.fm Setup Guide**')
                    .addFields(
                        { name: '**First**', value: `Register for a [**last.fm account**](https://www.last.fm/join)`, inline: false },
                        { name: '**Second**', value: `> For **Spotify** users, [**connect here**](https://www.last.fm/settings/applications)\n> For **other music services** [**connect here**](https://www.last.fm/about/trackmymusic)`, inline: false },
                        { name: '**Third**', value: `\`\`\`${guildprefix}lf set [lastfm username]\`\`\``, inline: false }
                    );

                return message.channel.send({ embeds: [embed] });
            }

            case 'set': {
                const subcommandInfo = {
                    description: 'Link your Last.fm account',
                    usage: '{guildprefix}lastfm set [username]',
                    aliases: [],
                    parameters: ['username'],
                    example: '{guildprefix}lastfm set vwsn'
                };

                const fmuser = args[1];

                if (!fmuser) {
                    return runHelpCommand(message, 'lastfm');
                }

                if (String(args[1]).toLowerCase() === 'none') {
                    // Unlink Last.fm profile using service layer
                    await userService.setLastFMUsername(message.author.id, null);
                    await userService.setLastFMLibrary(message.author.id, null);
                    return embeds.success(message, `Your **Last.fm** profile has been **unlinked**`);
                }

                // Verify the Last.fm username exists
                try {
                    const results = await axios({
                        method: 'GET',
                        url: `http://ws.audioscrobbler.com/2.0/`,
                        params: {
                            method: 'user.getinfo',
                            user: fmuser,
                            api_key: config.apis.lastfm,
                            format: 'json'
                        }
                    }).then((results) => results.data).catch(() => { });

                    if (!results) {
                        return embeds.warn(message, `User [**${fmuser}**](https://last.fm/user/${fmuser}) was not found.`);
                    }

                    // Check if user already has this username set
                    const currentUsername = await userService.getLastFMUsername(message.author.id);
                    if (currentUsername === results.user.name) {
                        return embeds.warn(message, `Your **Last.fm** username is already set as [**${results.user.name}**](https://last.fm/user/${results.user.name}).`);
                    }

                    // Update user data using service layer
                    await userService.setLastFMUsername(message.author.id, results.user.name);

                    // Start library indexing
                    const msg = await embeds.loading(message, `Creating a new **Last.fm** library..`);

                    const library = new Library(message.author.id, results.user.name, message, msg);
                    await library.index();

                    const successEmbed = embeds.createSuccess(message, `Success, your **Last.fm** profile has been set as [**${results.user.name}**](https://last.fm/user/${results.user.name}).`);
                    return msg.edit({ embeds: [successEmbed] });
                } catch (error) {
                    return embeds.warn(message, `Error verifying **Last.fm** username. Please try again.`);
                }
            }

            case 'update':
            case 'refresh':
            case 'index': {
                const subcommandInfo = {
                    description: 'Update your Last.fm library',
                    usage: '{guildprefix}lastfm update',
                    aliases: ['refresh', 'index'],
                    parameters: [],
                    example: '{guildprefix}lastfm update'
                };

                try {
                    const fmUsername = await userService.getLastFMUsername(message.author.id);
                    if (!fmUsername) {
                        return embeds.warn(message, error(message.author, message.author, 'notConnected'));
                    }

                    const msg = await embeds.loading(message, `Updating your current **Last.fm** library..`);

                    const library = new Library(message.author.id, fmUsername, message, msg);
                    await library.index();

                    const successEmbed = embeds.createSuccess(message, `Your **Last.fm** library has been updated.`);
                    return msg.edit({ embeds: [successEmbed] });
                } catch (error) {
                    return embeds.warn(message, `Error updating **Last.fm** library. Please try again.`);
                }
            }

            // FMBot-style short commands (auto-detect current track)
            case 'wa': {
                const subcommandInfo = {
                    description: 'Who knows this artist (auto-detect from current track)',
                    usage: '{guildprefix}lastfm wa',
                    aliases: [],
                    parameters: [],
                    example: '{guildprefix}lastfm wa'
                };

                message.channel.sendTyping();
                const whoknowsArtist = new WhoKnows(message.author.id, 'artist');
                await whoknowsArtist.execute(message, []); // Empty args to auto-detect
                break;
            }

            case 'wt': {
                const subcommandInfo = {
                    description: 'Who knows this track (auto-detect from current track)',
                    usage: '{guildprefix}lastfm wt',
                    aliases: [],
                    parameters: [],
                    example: '{guildprefix}lastfm wt'
                };

                message.channel.sendTyping();
                const whoknowsTrack = new WhoKnows(message.author.id, 'track');
                await whoknowsTrack.execute(message, []); // Empty args to auto-detect
                break;
            }

            case 'wal': {
                const subcommandInfo = {
                    description: 'Who knows this album (auto-detect from current track)',
                    usage: '{guildprefix}lastfm wal',
                    aliases: [],
                    parameters: [],
                    example: '{guildprefix}lastfm wal'
                };

                message.channel.sendTyping();
                const whoknowsAlbum = new WhoKnows(message.author.id, 'album');
                await whoknowsAlbum.execute(message, []); // Empty args to auto-detect
                break;
            }

            case 'pa': {
                const subcommandInfo = {
                    description: 'Your plays for this artist (auto-detect from current track)',
                    usage: '{guildprefix}lastfm pa',
                    aliases: [],
                    parameters: [],
                    example: '{guildprefix}lastfm pa'
                };

                message.channel.sendTyping();
                const playsArtist = new Plays(message.author.id, 'artist');
                await playsArtist.execute(message, []); // Empty args to auto-detect
                break;
            }

            case 'pt': {
                const subcommandInfo = {
                    description: 'Your plays for this track (auto-detect from current track)',
                    usage: '{guildprefix}lastfm pt',
                    aliases: [],
                    parameters: [],
                    example: '{guildprefix}lastfm pt'
                };

                message.channel.sendTyping();
                const playsTrack = new Plays(message.author.id, 'track');
                await playsTrack.execute(message, []); // Empty args to auto-detect
                break;
            }

            case 'pal': {
                const subcommandInfo = {
                    description: 'Your plays for this album (auto-detect from current track)',
                    usage: '{guildprefix}lastfm pal',
                    aliases: [],
                    parameters: [],
                    example: '{guildprefix}lastfm pal'
                };

                message.channel.sendTyping();
                const playsAlbum = new Plays(message.author.id, 'album');
                await playsAlbum.execute(message, []); // Empty args to auto-detect
                break;
            }

            case 'recent':
            case 'r': {
                const subcommandInfo = {
                    description: 'Show your recent tracks',
                    usage: '{guildprefix}lastfm recent [user] [limit]',
                    aliases: ['r'],
                    parameters: ['user (optional)', 'limit (optional)'],
                    example: '{guildprefix}lastfm recent @vwsn 10'
                };

                message.channel.sendTyping();
                const recent = new Recent(message.author.id);
                await recent.execute(message, args);
                break;
            }

            case 'chart': {
                const subcommandInfo = {
                    description: 'Generate a chart of your top albums/artists',
                    usage: '{guildprefix}lastfm chart [user] [type] [period] [size]',
                    aliases: [],
                    parameters: ['user (optional)', 'type (optional)', 'period (optional)', 'size (optional)'],
                    example: '{guildprefix}lastfm chart album weekly 3x3'
                };

                message.channel.sendTyping();
                const chart = new Chart(message.author.id);
                await chart.execute(message, args);
                break;
            }

            case 'streak': {
                const subcommandInfo = {
                    description: 'Show your current listening streak',
                    usage: '{guildprefix}lastfm streak [user]',
                    aliases: [],
                    parameters: ['user (optional)'],
                    example: '{guildprefix}lastfm streak @vwsn'
                };

                message.channel.sendTyping();
                const streak = new Streak(message.author.id);
                await streak.execute(message, args);
                break;
            }

            case 'pace': {
                const subcommandInfo = {
                    description: 'Show your scrobbling pace and statistics',
                    usage: '{guildprefix}lastfm pace [user]',
                    aliases: [],
                    parameters: ['user (optional)'],
                    example: '{guildprefix}lastfm pace @vwsn'
                };

                message.channel.sendTyping();
                const pace = new Pace(message.author.id);
                await pace.execute(message, args);
                break;
            }

            case 'whoknows':
            case 'wk': {
                const subcommandInfo = {
                    description: 'Show who knows an artist in this server',
                    usage: '{guildprefix}lastfm whoknows [artist]',
                    aliases: ['wk'],
                    parameters: ['artist'],
                    example: '{guildprefix}lastfm whoknows Taylor Swift'
                };

                message.channel.sendTyping();
                const whoknowsArtist = new WhoKnows(message.author.id, 'artist');
                await whoknowsArtist.execute(message, args);
                break;
            }

            case 'wkalbum':
            case 'whoknowsalbum':
            case 'wka': {
                const subcommandInfo = {
                    description: 'Show who knows an album in this server',
                    usage: '{guildprefix}lastfm wkalbum [album]',
                    aliases: ['whoknowsalbum', 'wka'],
                    parameters: ['album'],
                    example: '{guildprefix}lastfm wkalbum 1989'
                };

                message.channel.sendTyping();
                const whoknowsAlbum = new WhoKnows(message.author.id, 'album');
                await whoknowsAlbum.execute(message, args);
                break;
            }

            case 'wktrack':
            case 'whoknowstrack':
            case 'wkt': {
                const subcommandInfo = {
                    description: 'Show who knows a track in this server',
                    usage: '{guildprefix}lastfm wktrack [track]',
                    aliases: ['whoknowstrack', 'wkt'],
                    parameters: ['track'],
                    example: '{guildprefix}lastfm wktrack Shake It Off'
                };

                message.channel.sendTyping();
                const whoknowsTrack = new WhoKnows(message.author.id, 'track');
                await whoknowsTrack.execute(message, args);
                break;
            }

            case 'globalwhoknows':
            case 'globalwk':
            case 'gwk': {
                const subcommandInfo = {
                    description: 'Show who knows an artist globally',
                    usage: '{guildprefix}lastfm globalwhoknows [artist]',
                    aliases: ['globalwk', 'gwk'],
                    parameters: ['artist'],
                    example: '{guildprefix}lastfm globalwhoknows Taylor Swift'
                };

                message.channel.sendTyping();
                const whoknowsArtist = new WhoKnows(message.author.id, 'artist', true);
                await whoknowsArtist.execute(message, args);
                break;
            }

            case 'globalwkalbum':
            case 'globalwka':
            case 'gwka': {
                const subcommandInfo = {
                    description: 'Show who knows an album globally',
                    usage: '{guildprefix}lastfm globalwkalbum [album]',
                    aliases: ['globalwka', 'gwka'],
                    parameters: ['album'],
                    example: '{guildprefix}lastfm globalwkalbum 1989'
                };

                message.channel.sendTyping();
                const whoknowsAlbum = new WhoKnows(message.author.id, 'album', true);
                await whoknowsAlbum.execute(message, args);
                break;
            }

            case 'globalwktrack':
            case 'globalwkt':
            case 'gwkt': {
                const subcommandInfo = {
                    description: 'Show who knows a track globally',
                    usage: '{guildprefix}lastfm globalwktrack [track]',
                    aliases: ['globalwkt', 'gwkt'],
                    parameters: ['track'],
                    example: '{guildprefix}lastfm globalwktrack Shake It Off'
                };

                message.channel.sendTyping();
                const whoknowsTrack = new WhoKnows(message.author.id, 'track', true);
                await whoknowsTrack.execute(message, args);
                break;
            }

            case 'topartists':
            case 'topartist':
            case 'artists':
            case 'artist':
            case 'tar':
            case 'ta': {
                const subcommandInfo = {
                    description: 'Show your top artists',
                    usage: '{guildprefix}lastfm topartists [user] [period]',
                    aliases: ['topartist', 'artists', 'artist', 'tar', 'ta'],
                    parameters: ['user (optional)', 'period (optional)'],
                    example: '{guildprefix}lastfm topartists @vwsn weekly'
                };

                message.channel.sendTyping();
                const topArtists = new Top('artist');
                await topArtists.execute(message, args);
                break;
            }

            case 'topalbums':
            case 'topalbum':
            case 'albums':
            case 'album':
            case 'tab':
            case 'tl': {
                const subcommandInfo = {
                    description: 'Show your top albums',
                    usage: '{guildprefix}lastfm topalbums [user] [period]',
                    aliases: ['topalbum', 'albums', 'album', 'tab', 'tl'],
                    parameters: ['user (optional)', 'period (optional)'],
                    example: '{guildprefix}lastfm topalbums @vwsn monthly'
                };

                message.channel.sendTyping();
                const topAlbums = new Top('album');
                await topAlbums.execute(message, args);
                break;
            }

            case 'toptracks':
            case 'toptrack':
            case 'tracks':
            case 'track':
            case 'ttr':
            case 'tt': {
                const subcommandInfo = {
                    description: 'Show your top tracks',
                    usage: '{guildprefix}lastfm toptracks [user] [period]',
                    aliases: ['toptrack', 'tracks', 'track', 'ttr', 'tt'],
                    parameters: ['user (optional)', 'period (optional)'],
                    example: '{guildprefix}lastfm toptracks @vwsn yearly'
                };

                message.channel.sendTyping();
                const topTracks = new Top('track');
                await topTracks.execute(message, args);
                break;
            }

            case 'plays': {
                const subcommandInfo = {
                    description: 'Show your plays for a specific artist',
                    usage: '{guildprefix}lastfm plays [user] [artist]',
                    aliases: [],
                    parameters: ['user (optional)', 'artist'],
                    example: '{guildprefix}lastfm plays @vwsn Taylor Swift'
                };

                message.channel.sendTyping();
                const playsArtist = new Plays(message.author.id, 'artist');
                await playsArtist.execute(message, args);
                break;
            }

            case 'playsalbum':
            case 'playsa':
            case 'aplays': {
                const subcommandInfo = {
                    description: 'Show your plays for a specific album',
                    usage: '{guildprefix}lastfm playsalbum [user] [album]',
                    aliases: ['playsa', 'aplays'],
                    parameters: ['user (optional)', 'album'],
                    example: '{guildprefix}lastfm playsalbum @vwsn 1989'
                };

                message.channel.sendTyping();
                const playsAlbum = new Plays(message.author.id, 'album');
                await playsAlbum.execute(message, args);
                break;
            }

            case 'playstrack':
            case 'playst':
            case 'tplays': {
                const subcommandInfo = {
                    description: 'Show your plays for a specific track',
                    usage: '{guildprefix}lastfm playstrack [user] [track]',
                    aliases: ['playst', 'tplays'],
                    parameters: ['user (optional)', 'track'],
                    example: '{guildprefix}lastfm playstrack @vwsn Shake It Off'
                };

                message.channel.sendTyping();
                const playsTrack = new Plays(message.author.id, 'track');
                await playsTrack.execute(message, args);
                break;
            }

            case 'compare':
            case 'taste':
            case 'mutual':
            case 'match': {
                const subcommandInfo = {
                    description: 'Compare your music taste with another user',
                    usage: '{guildprefix}lastfm compare [user]',
                    aliases: ['taste', 'mutual', 'match'],
                    parameters: ['user'],
                    example: '{guildprefix}lastfm compare @vwsn'
                };

                if (!args[1]) {
                    return embeds.warn(message, `Please specify a user to compare with. Usage: \`${guildprefix}lastfm compare [user]\``);
                }

                try {
                    const userResult = await findUser(message.guild, args[1], client);
                    if (!userResult.found) {
                        return embeds.warn(message, userResult.error);
                    }

                    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
                    const targetFmUsername = await userService.getLastFMUsername(targetUser.id);

                    if (!targetFmUsername) {
                        return embeds.warn(message, error(targetUser, message.author, 'notConnected'));
                    }

                    message.channel.sendTyping();
                    const compare = new Compare(message.author.id, targetUser.id);
                    await compare.execute(message);
                } catch (error) {
                    return embeds.warn(message, `Error comparing **Last.fm** profiles. Please try again.`);
                }
                break;
            }

            default: {
                return runHelpCommand(message, 'lastfm');
            }
        }
    }
}

// Helper Classes
class Library {
    constructor(userId, username, message, msg) {
        this.userId = userId;
        this.username = username;
        this.message = message;
        this.msg = msg;

        this.artists = [];
        this.albums = [];
        this.tracks = [];

        this.totalArtists = null;
        this.totalAlbums = null;
        this.totalTracks = null;

        this.artistsPerPage = 2000;
        this.albumsPerPage = 1000;
        this.tracksPerPage = 1000;

        this.artistPage = 1;
        this.albumPage = 1;
        this.trackPage = 1;
    }

    async query(type, page) {
        try {
            const converter = {
                'artist': 'library.getArtists',
                'album': 'user.getTopAlbums',
                'track': 'user.getTopTracks'
            };

            const results = await fetch(`http://ws.audioscrobbler.com/2.0/?method=${converter[type]}&user=${this.username}&api_key=${config.apis.lastfm}&format=json&limit=${type === 'artist' ? '2000' : '1000'}&page=${page}`, {
                method: 'GET'
            }).then((results) => results.json());

            switch (type) {
                case 'artist':
                    this.artists = this.artists.concat(results.artists.artist);
                    this.totalArtists = parseInt(results.artists['@attr'].total);
                    break;
                case 'album':
                    this.albums = this.albums.concat(results.topalbums.album);
                    this.totalAlbums = parseInt(results.topalbums['@attr'].total);
                    break;
                case 'track':
                    this.tracks = this.tracks.concat(results.toptracks.track);
                    this.totalTracks = parseInt(results.toptracks['@attr'].total);
                    break;
            }
        } catch (error) {
            console.error('Library', error);
        }
    }

    async index() {
        try {
            // Index artists
            const loadingEmbed1 = embeds.createLoading(this.message, `Indexing your **Last.fm** artist library..`);
            await this.msg.edit({ embeds: [loadingEmbed1] });

            await this.query('artist', this.artistPage);

            while (this.artists.length < this.totalArtists) {
                this.artistPage++;
                await this.query('artist', this.artistPage);
            }

            if (this.totalArtists === 0) {
                const warnEmbed = embeds.createWarn(this.message, `Aborted indexing your **Last.fm** artist library - No plays available!`);
                return this.msg.edit({ embeds: [warnEmbed] });
            }

            // Index albums
            const loadingEmbed2 = embeds.createLoading(this.message, `Indexing your **Last.fm** album library..`);
            await this.msg.edit({ embeds: [loadingEmbed2] });

            await this.query('album', this.albumPage);

            while (this.albums.length < this.totalAlbums) {
                this.albumPage++;
                await this.query('album', this.albumPage);
            }

            // Index tracks
            const loadingEmbed3 = embeds.createLoading(this.message, `Indexing your **Last.fm** track library..`);
            await this.msg.edit({ embeds: [loadingEmbed3] });

            await this.query('track', this.trackPage);

            while (this.tracks.length < this.totalTracks) {
                this.trackPage++;
                await this.query('track', this.trackPage);
            }

            // Save to database
            const loadingEmbed4 = embeds.createLoading(this.message, `Saving your **Last.fm** artists, albums, and tracks..`);
            await this.msg.edit({ embeds: [loadingEmbed4] });

            await this.saveUserLibrary();

            return;
        } catch (error) {
            console.error('Library', error);
        }
    }

    async saveUserLibrary() {
        // Save library using service layer
        const { getService } = require('@services');
        const userService = getService('user');
        
        const libraryData = {
            artists: this.artists.map(({ name, playcount }) => ({
                name: name,
                plays: parseInt(playcount)
            })),
            albums: this.albums.map(({ artist, name, playcount }) => ({
                name: name,
                artist: artist.name,
                plays: parseInt(playcount)
            })),
            tracks: this.tracks.map(({ artist, name, playcount }) => ({
                name: name,
                artist: artist.name,
                plays: parseInt(playcount)
            })),
            lastUpdated: new Date()
        };

        await userService.setLastFMLibrary(this.userId, libraryData);
    }
}

class WhoKnows {
    constructor(userId, type, global = false) {
        this.userId = userId;
        this.type = type;
        this.global = global;
    }

    async execute(message, args) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            let name, artist;

            if (!args[1]) {
                // Get from recent tracks
                const fmUsername = await userService.getLastFMUsername(this.userId);
                const recentTracks = await fetch(`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUsername}&api_key=${config.apis.lastfm}&format=json`, {
                    method: 'GET'
                }).then((results) => results.json()).catch(() => { });

                if (!recentTracks || !recentTracks.recenttracks || !recentTracks.recenttracks.track || recentTracks.recenttracks.track.length === 0) {
                    return embeds.warn(message, error(message.author, message.author, 'noRecentTracks'));
                }

                const track = recentTracks.recenttracks.track[0];
                switch (this.type) {
                    case 'artist':
                        name = track.artist['#text'];
                        break;
                    case 'album':
                        name = track.album['#text'];
                        artist = track.artist['#text'];
                        break;
                    case 'track':
                        name = track.name;
                        artist = track.artist['#text'];
                        break;
                }
            } else {
                name = args.slice(1).join(' ');

                if (['album', 'track'].includes(this.type)) {
                    // Search for the item to get proper artist info
                    try {
                        const searchUrl = `http://ws.audioscrobbler.com/2.0/?method=${this.type}.search&${this.type}=${name}&api_key=${config.apis.lastfm}&limit=1&format=json`;
                        const searchResult = await axios.get(searchUrl).then(res => res.data);

                        if (this.type === 'album' && searchResult.results.albummatches.album.length) {
                            name = searchResult.results.albummatches.album[0].name;
                            artist = searchResult.results.albummatches.album[0].artist;
                        } else if (this.type === 'track' && searchResult.results.trackmatches.track.length) {
                            name = searchResult.results.trackmatches.track[0].name;
                            artist = searchResult.results.trackmatches.track[0].artist;
                        }
                    } catch (error) {
                        // Continue with original name if search fails
                    }
                }
            }

            // Get item info to verify it exists
            const infoUrl = `http://ws.audioscrobbler.com/2.0/?method=${this.type}.getinfo&${this.type}=${name}&api_key=${config.apis.lastfm}&autocorrect=1&format=json${['album', 'track'].includes(this.type) ? `&artist=${artist}` : ''}`;
            const information = await fetch(infoUrl, { method: 'GET' }).then((results) => results.json()).catch(() => { });

            if (!information || !information[this.type]) {
                return embeds.warn(message, `No results were found for **${name}**`);
            }

            name = information[this.type].name;

            // Get all users with Last.fm usernames
            let members = [];
            let positions = [];

            if (this.global) {
                // Global whoknows - get all users from database using new system
                const models = getModels();
                if (models && models.User) {
                    const allUsers = await models.User.find({ LastFMUsername: { $ne: null } }).select('UserID LastFMUsername LastFMLibrary');

                    for (const user of allUsers) {
                        const plays = this.getUserPlays(user.LastFMLibrary, name, artist);
                        if (plays > 0) {
                            try {
                                const discordUser = await message.client.users.fetch(user.UserID);
                                const object = {
                                    id: user.UserID,
                                    text: `[**${discordUser.tag}**](https://last.fm/user/${user.LastFMUsername})`,
                                    plays: plays
                                };
                                members.push(object);
                                positions.push(object);
                            } catch (error) {
                                // User not found, skip
                            }
                        }
                    }
                }
            } else {
                // Server whoknows - get guild members
                const guildMembers = await message.guild.members.fetch();

                for (const [memberId, member] of guildMembers) {
                    const fmUsername = await userService.getLastFMUsername(memberId);
                    if (fmUsername) {
                        const library = await userService.getLastFMLibrary(memberId);
                        const plays = this.getUserPlays(library, name, artist);

                        const object = {
                            id: memberId,
                            text: `[**${member.user.tag}**](https://last.fm/user/${fmUsername})`,
                            plays: plays
                        };
                        positions.push(object);

                        if (plays > 0) {
                            members.push(object);
                        }
                    }
                }
            }

            const sortedP = positions.sort((a, b) => b.plays - a.plays);
            const sortedM = members.sort((a, b) => b.plays - a.plays);

            if (!sortedM.length) {
                return embeds.warn(message, `No results were found for **${name}**`);
            }

            const position = sortedP.find((member) => member.id === message.author.id) || { plays: 0 };
            const rank = sortedM.find((member) => member.id === message.author.id) ? `#${sortedP.indexOf(position) + 1}` : 'Unranked';

            // Create paginated embeds
            const embeds_list = [];
            const entriesPerPage = 10;
            let index = 0;
            let crown = null;
            let crownPlays = 0;

            for (let i = 0; i < sortedM.length; i += entriesPerPage) {
                const pageMembers = sortedM.slice(i, i + entriesPerPage);

                const mapped = pageMembers.map((member) => {
                    index++;
                    let display = `\`${index}\``;

                    if (index === 1 && this.type === 'artist' && !this.global) {
                        display = ':crown:';
                        crown = member.id;
                        crownPlays = member.plays;
                    }

                    return `${display} ${member.text} has **${member.plays.toLocaleString()}** ${member.plays === 1 ? 'play' : 'plays'}`;
                }).join('\n');

                const embed = new EmbedBuilder()
                    .setColor(config.colors.info)
                    .setAuthor({
                        name: message.member.displayName,
                        iconURL: message.member.displayAvatarURL({ dynamic: true })
                    })
                    .setTitle(`Top${this.global ? ' Global ' : ' '}Listeners for ${this.type} ${name}`)
                    .setDescription(`${mapped}\nYour plays: **${position.plays.toLocaleString()}** - Rank: \`${rank}\``);

                embeds_list.push(embed);
            }

            // Send the first embed
            await message.channel.send({ embeds: [embeds_list[0]] });

            // Handle crown system for artists
            if (crown && this.type === 'artist' && !this.global) {
                await this.handleCrown(message, crown, name, crownPlays);
            }

        } catch (error) {
            return embeds.warn(message, `Error fetching **${this.type}** information. Please try again.`);
        }
    }

    getUserPlays(library, name, artist) {
        if (!library || !library[`${this.type}s`]) return 0;

        const items = library[`${this.type}s`];

        if (this.type === 'artist') {
            const item = items.find(a => a.name.toLowerCase() === name.toLowerCase());
            return item ? item.plays : 0;
        } else {
            const item = items.find(a =>
                a.name.toLowerCase() === name.toLowerCase() &&
                a.artist.toLowerCase() === artist.toLowerCase()
            );
            return item ? item.plays : 0;
        }
    }

    async handleCrown(message, crownUserId, artistName, crownPlays) {
        try {
            const { getService } = require('@services');
            const guildService = getService('guild');
            
            const existingCrown = await guildService.getLastFMCrown(message.guild.id, artistName);
            const crownMember = await message.guild.members.fetch(crownUserId);

            if (existingCrown) {
                if (existingCrown.userId === crownUserId) return;

                const oldCrownMember = await message.guild.members.fetch(existingCrown.userId).catch(() => null);

                // Update crown
                await guildService.setLastFMCrown(message.guild.id, artistName, crownUserId, crownPlays);

                const stealEmbed = embeds.createInfo(message, `\`${crownMember.user.tag}\` stole the crown from \`${oldCrownMember ? oldCrownMember.user.tag : 'Unknown User'}\` for **${artistName}**!`);
                await message.channel.send({ embeds: [stealEmbed] });
            } else {
                // New crown
                await guildService.setLastFMCrown(message.guild.id, artistName, crownUserId, crownPlays);

                const claimEmbed = embeds.createInfo(message, `\`${crownMember.user.tag}\` claimed the crown for **${artistName}**!`);
                await message.channel.send({ embeds: [claimEmbed] });
            }
        } catch (error) {
            console.error('Crown handling error:', error);
        }
    }
}

class Top {
    constructor(type) {
        this.type = type;
    }

    async execute(message, args) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            let targetUser = message.author;
            let isArgs = false;

            if (args[1]) {
                const userResult = await findUser(message.guild, args[1], message.client);
                if (userResult.found) {
                    targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
                    isArgs = true;
                }
            }

            const fmUsername = await userService.getLastFMUsername(targetUser.id);
            if (!fmUsername) {
                return embeds.warn(message, error(targetUser, message.author, 'notConnected'));
            }

            const period = this.period(isArgs ? args[2] : args[1]);
            const topUrl = `http://ws.audioscrobbler.com/2.0/?method=user.gettop${this.type}s&user=${fmUsername}&api_key=${config.apis.lastfm}&limit=10${period.period}&format=json`;

            const top = await axios.get(topUrl).then(res => res.data);

            if (!top[`top${this.type}s`] || !top[`top${this.type}s`][this.type]) {
                return embeds.warn(message, `No **${this.type}s** found for **${fmUsername}**`);
            }

            const items = top[`top${this.type}s`][this.type].slice(0, 10);

            const mapped = items.map((item, index) => {
                const plays = parseInt(item.playcount).toLocaleString();
                return `\`${index + 1}\` [**${item.name}**](${item.url}) ${this.type === 'track' || this.type === 'album' ? `by **${item.artist.name}**` : ''} (${plays} ${plays === '1' ? 'play' : 'plays'})`;
            }).join('\n');

            const converter = {
                'artist': 'Top Artists',
                'album': 'Top Albums',
                'track': 'Top Tracks'
            };

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: message.member.displayName,
                    iconURL: message.member.displayAvatarURL({ dynamic: true })
                })
                .setTitle(`${converter[this.type]} (${period.type}) - ${fmUsername}`)
                .setDescription(mapped);

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error fetching top **${this.type}s**. Please try again.`);
        }
    }

    period(input) {
        const periods = {
            'overall': { period: '', type: 'Overall' },
            'week': { period: '&period=7day', type: 'Weekly' },
            '7d': { period: '&period=7day', type: 'Weekly' },
            'month': { period: '&period=1month', type: 'Monthly' },
            '1m': { period: '&period=1month', type: 'Monthly' },
            '3m': { period: '&period=3month', type: '3 Month' },
            '6m': { period: '&period=6month', type: '6 Month' },
            'year': { period: '&period=12month', type: 'Yearly' },
            '1y': { period: '&period=12month', type: 'Yearly' }
        };

        return periods[input] || periods['overall'];
    }
}

class Plays {
    constructor(userId, type) {
        this.userId = userId;
        this.type = type;
    }

    async execute(message, args) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            let targetUser = message.author;
            let isArgs = false;

            if (args[1]) {
                const userResult = await findUser(message.guild, args[1], message.client);
                if (userResult.found) {
                    targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
                    isArgs = true;
                }
            }

            const fmUsername = await userService.getLastFMUsername(targetUser.id);
            if (!fmUsername) {
                return embeds.warn(message, error(targetUser, message.author, 'notConnected'));
            }

            let name = isArgs ? args.slice(2).join(' ') : args.slice(1).join(' ');
            let artist;

            // Auto-detect from current track if no name provided
            if (!name) {
                const recentTracks = await fetch(`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUsername}&api_key=${config.apis.lastfm}&format=json`, {
                    method: 'GET'
                }).then((results) => results.json()).catch(() => { });

                if (!recentTracks || !recentTracks.recenttracks || !recentTracks.recenttracks.track || recentTracks.recenttracks.track.length === 0) {
                    return embeds.warn(message, error(targetUser, message.author, 'noRecentTracks'));
                }

                const track = recentTracks.recenttracks.track[0];
                switch (this.type) {
                    case 'artist':
                        name = track.artist['#text'];
                        break;
                    case 'album':
                        name = track.album['#text'];
                        artist = track.artist['#text'];
                        break;
                    case 'track':
                        name = track.name;
                        artist = track.artist['#text'];
                        break;
                }

                if (!name) {
                    return embeds.warn(message, `Please specify a **${this.type}** to check plays for.`);
                }
            }

            // Search for the item if it's an album or track
            if (['album', 'track'].includes(this.type)) {
                try {
                    const searchUrl = `http://ws.audioscrobbler.com/2.0/?method=${this.type}.search&${this.type}=${name}&api_key=${config.apis.lastfm}&limit=1&format=json`;
                    const searchResult = await axios.get(searchUrl).then(res => res.data);

                    if (this.type === 'album' && searchResult.results.albummatches.album.length) {
                        name = searchResult.results.albummatches.album[0].name;
                        artist = searchResult.results.albummatches.album[0].artist;
                    } else if (this.type === 'track' && searchResult.results.trackmatches.track.length) {
                        name = searchResult.results.trackmatches.track[0].name;
                        artist = searchResult.results.trackmatches.track[0].artist;
                    }
                } catch (error) {
                    // Continue with original name if search fails
                }
            }

            // Get item info with user play count
            const infoUrl = `http://ws.audioscrobbler.com/2.0/?method=${this.type}.getinfo&username=${fmUsername}&${this.type}=${name}&api_key=${config.apis.lastfm}&autocorrect=1&format=json${['album', 'track'].includes(this.type) ? `&artist=${artist}` : ''}`;
            const information = await fetch(infoUrl, { method: 'GET' }).then((results) => results.json()).catch(() => { });

            if (!information || !information[this.type]) {
                return embeds.warn(message, `No results were found for **${name}**`);
            }

            const item = information[this.type];
            let plays = 0;

            if (['album', 'track'].includes(this.type)) {
                plays = item.userplaycount || 0;
            } else {
                plays = item.stats?.userplaycount || 0;
            }

            name = item.name;
            const url = item.url;
            const operator = targetUser.id === message.author.id ? 'You have' : `**${targetUser.username}** has`;
            const artistOperator = artist ? ` by **${artist}**` : '';

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setDescription(`${operator} **${parseInt(plays).toLocaleString()}** plays for [**${name}**](${url})${artistOperator}`);

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error fetching **${this.type}** plays. Please try again.`);
        }
    }
}

class Compare {
    constructor(userId1, userId2) {
        this.userId1 = userId1;
        this.userId2 = userId2;
    }

    async execute(message) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            const [user1Data, user2Data] = await Promise.all([
                userService.getLastFMUsername(this.userId1),
                userService.getLastFMUsername(this.userId2)
            ]);

            if (!user1Data || !user2Data) {
                return embeds.warn(message, `Both users need to have **Last.fm** profiles linked.`);
            }

            const [library1, library2] = await Promise.all([
                userService.getLastFMLibrary(this.userId1),
                userService.getLastFMLibrary(this.userId2)
            ]);

            if (!library1 || !library2 || !library1.artists || !library2.artists) {
                return embeds.warn(message, `Both users need to have indexed **Last.fm** libraries. Use \`lastfm update\` to index.`);
            }

            const artists1 = library1.artists.map(a => a.name.toLowerCase());
            const artists2 = library2.artists.map(a => a.name.toLowerCase());

            const commonArtists = artists1.filter(artist => artists2.includes(artist));
            const percentage = (commonArtists.length / (artists1.length + artists2.length - commonArtists.length)) * 100;

            let comparisons = [];

            for (const artist1 of library1.artists.slice(0, 50)) { // Limit to top 50 for performance
                const artist2 = library2.artists.find(a => a.name.toLowerCase() === artist1.name.toLowerCase());

                if (artist2) {
                    let operator;

                    if (artist1.plays > artist2.plays) {
                        operator = '>';
                    } else if (artist1.plays === artist2.plays) {
                        operator = '=';
                    } else {
                        operator = '<';
                    }

                    comparisons.push({
                        artist: `${artist1.name.slice(0, 16).trim()}${artist1.name.length > 16 ? '..' : ''}`,
                        plays: `${parseInt(artist1.plays).toLocaleString()} ${operator} ${parseInt(artist2.plays).toLocaleString()}`,
                        raw: artist1.plays
                    });
                }
            }

            comparisons = comparisons.sort((a, b) => b.raw - a.raw).slice(0, 10);

            const longestName = Math.max(...comparisons.map(element => element.artist.length));

            const mappedArray = comparisons.map(element => ({
                name: element.artist.padEnd(longestName, ' '),
                value: element.plays
            }));

            const mapped = mappedArray.map(element => `${element.name.padEnd(element.name.length + 1, ' ')}${element.value}`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: message.member.displayName,
                    iconURL: message.member.displayAvatarURL({ dynamic: true })
                })
                .setTitle(`Comparison - ${user1Data} vs ${user2Data}`)
                .setDescription(`You both have **${commonArtists.length}** artists (${percentage.toFixed(0)}%) in common\n>>> \`\`\`${mapped}\`\`\``);

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error comparing **Last.fm** profiles. Please try again.`);
        }
    }
}

class Recent {
    constructor(userId) {
        this.userId = userId;
    }

    async execute(message, args) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            let targetUser = message.author;
            let limit = 10;

            // Check if first arg is a user
            if (args[1]) {
                const userResult = await findUser(message.guild, args[1], message.client);
                if (userResult.found) {
                    targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
                    // Check if second arg is a number for limit
                    if (args[2] && !isNaN(args[2])) {
                        limit = Math.min(parseInt(args[2]), 15);
                    }
                } else if (!isNaN(args[1])) {
                    // First arg is a number, use as limit
                    limit = Math.min(parseInt(args[1]), 15);
                }
            }

            const fmUsername = await userService.getLastFMUsername(targetUser.id);
            if (!fmUsername) {
                return embeds.warn(message, error(targetUser, message.author, 'notConnected'));
            }

            const recentUrl = `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUsername}&api_key=${config.apis.lastfm}&format=json&limit=${limit}&extended=1`;
            const recentData = await fetch(recentUrl).then(res => res.json());

            if (!recentData.recenttracks || !recentData.recenttracks.track) {
                return embeds.warn(message, `No recent tracks found for **${fmUsername}**`);
            }

            const tracks = Array.isArray(recentData.recenttracks.track) ? recentData.recenttracks.track : [recentData.recenttracks.track];

            const mapped = tracks.map((track, index) => {
                const isNowPlaying = track['@attr'] && track['@attr'].nowplaying;
                const timeAgo = isNowPlaying ? '🎵 Now Playing' : this.timeAgo(track.date.uts);
                const trackUrl = `https://www.last.fm/music/${encodeURIComponent(track.artist.name)}/_/${encodeURIComponent(track.name)}`;

                return `\`${index + 1}\` [**${track.name}**](${trackUrl}) by **${track.artist.name}** ${timeAgo}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: `Recent tracks - ${fmUsername}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                    url: `https://www.last.fm/user/${fmUsername}`
                })
                .setDescription(mapped);

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error fetching recent tracks. Please try again.`);
        }
    }

    timeAgo(timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const diff = now - parseInt(timestamp);

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
        return `${Math.floor(diff / 2592000)}mo ago`;
    }
}

class Chart {
    constructor(userId) {
        this.userId = userId;
    }

    async execute(message, args) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            let targetUser = message.author;
            let type = 'album';  // Default to album for collages
            let period = 'overall';
            let size = '3x3';

            // Parse arguments
            if (args[1]) {
                const userResult = await findUser(message.guild, args[1], message.client);
                if (userResult.found) {
                    targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
                    type = args[2] || 'album';
                    period = args[3] || 'overall';
                    size = args[4] || '3x3';
                } else {
                    type = args[1] || 'album';
                    period = args[2] || 'overall';
                    size = args[3] || '3x3';
                }
            }

            // Default to 'overall' period for album charts to show all-time listening
            if (type === 'album' && period === 'overall') {
                period = 'overall';
            }

            const fmUsername = await userService.getLastFMUsername(targetUser.id);
            if (!fmUsername) {
                return embeds.warn(message, error(targetUser, message.author, 'notConnected'));
            }

            // Validate chart size
            const validSizes = ['3x3', '4x4', '5x5'];
            if (!validSizes.includes(size)) {
                size = '3x3';
            }

            const gridSize = parseInt(size.charAt(0));
            const limit = gridSize * gridSize;

            const periodObj = this.period(period);
            const topUrl = `http://ws.audioscrobbler.com/2.0/?method=user.gettop${type}s&user=${fmUsername}&api_key=${config.apis.lastfm}&limit=${limit}${periodObj.period}&format=json`;

            const topData = await axios.get(topUrl).then(res => res.data);

            if (!topData[`top${type}s`] || !topData[`top${type}s`][type]) {
                return embeds.warn(message, `No **${type}s** found for **${fmUsername}**`);
            }

            const items = topData[`top${type}s`][type].slice(0, limit);

            // Check if user wants album collage (for album type, create image collage)
            if (type === 'album') {
                return this.createAlbumCollage(message, items, gridSize, periodObj, fmUsername, targetUser);
            }

            // Create enhanced text-based chart with better formatting
            let chart = '';
            let row = '';

            for (let i = 0; i < gridSize; i++) {
                row = '';
                for (let j = 0; j < gridSize; j++) {
                    const index = i * gridSize + j;
                    if (items[index]) {
                        const item = items[index];
                        const name = item.name.length > 15 ? item.name.substring(0, 15) + '..' : item.name;
                        const plays = parseInt(item.playcount).toLocaleString();

                        // Create clickable link
                        const itemUrl = item.url || `https://www.last.fm/music/${encodeURIComponent(type === 'track' ? item.artist.name : item.name)}${type === 'track' ? `/_/${encodeURIComponent(item.name)}` : ''}`;

                        row += `**${index + 1}.** [${name}](${itemUrl}) (${plays})\n`;
                    } else {
                        row += `**${index + 1}.** —\n`;
                    }
                }
                chart += row;
                if (i < gridSize - 1) chart += '\n';
            }

            // Try to get a representative image from the top item
            let chartImage = '';
            if (items[0] && items[0].image && items[0].image.length > 0) {
                chartImage = items[0].image[3]['#text'] || items[0].image[2]['#text'] || '';
            }

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: `${size} ${type} chart (${periodObj.type}) - ${fmUsername}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                    url: `https://www.last.fm/user/${fmUsername}`
                })
                .setDescription(chart)
                .setFooter({ text: `Total ${type}s: ${items.length} | Use 'lf chart [user] [type] [period] [size]' for different options` });

            if (chartImage) {
                embed.setThumbnail(chartImage);
            }

            // Check if user wants a visual grid chart
            if (args.includes('visual') || args.includes('grid')) {
                return this.createVisualChart(message, items, gridSize, periodObj, fmUsername, targetUser, type);
            }

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error generating chart. Please try again.`);
        }
    }

    async createVisualChart(message, items, gridSize, periodObj, fmUsername, targetUser, type) {
        try {
            // Create a visual grid using Unicode blocks and emojis
            let visualChart = '';
            const emojis = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜'];

            for (let i = 0; i < gridSize; i++) {
                let row = '';
                for (let j = 0; j < gridSize; j++) {
                    const index = i * gridSize + j;
                    if (items[index]) {
                        // Use different colors based on play count
                        const plays = parseInt(items[index].playcount);
                        const maxPlays = parseInt(items[0].playcount);
                        const intensity = Math.floor((plays / maxPlays) * 8);
                        row += emojis[intensity] || '⬜';
                    } else {
                        row += '⬜';
                    }
                }
                visualChart += row + '\n';
            }

            // Create legend with top items
            let legend = '';
            for (let i = 0; i < Math.min(9, items.length); i++) {
                const item = items[i];
                const name = item.name.length > 20 ? item.name.substring(0, 20) + '..' : item.name;
                const plays = parseInt(item.playcount).toLocaleString();
                const emoji = emojis[Math.floor((parseInt(item.playcount) / parseInt(items[0].playcount)) * 8)] || '⬜';
                legend += `${emoji} **${name}** (${plays})\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: `Visual ${gridSize}x${gridSize} ${type} chart (${periodObj.type}) - ${fmUsername}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                    url: `https://www.last.fm/user/${fmUsername}`
                })
                .addFields(
                    { name: 'Chart', value: visualChart, inline: false },
                    { name: 'Legend', value: legend, inline: false }
                )
                .setFooter({ text: 'Colors represent play count intensity' });

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error creating visual chart. Please try again.`);
        }
    }

    async createAlbumCollage(message, items, gridSize, periodObj, fmUsername, targetUser) {
        try {
            // Check if jimp is available
            let Jimp;
            try {
                Jimp = require('jimp');
            } catch (error) {
                // Fallback to text-based chart if jimp is not available
                return this.createTextBasedAlbumChart(message, items, gridSize, periodObj, fmUsername, targetUser);
            }

            // Image settings
            const albumSize = 300; // Size of each album cover
            const canvasWidth = gridSize * albumSize;
            const canvasHeight = gridSize * albumSize;

            // Create main canvas with dark background
            const canvas = new Jimp(canvasWidth, canvasHeight, 0x1a1a1aff);

            // Download and draw album covers
            const loadingEmbed = embeds.createLoading(message, `Creating your **${gridSize}x${gridSize}** album collage...`);
            const loadingMsg = await message.channel.send({ embeds: [loadingEmbed] });

            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    const index = i * gridSize + j;
                    const item = items[index];

                    if (item && item.image && item.image.length > 0) {
                        try {
                            // Get the largest available image
                            const imageUrl = item.image[3]?.['#text'] || item.image[2]?.['#text'] || item.image[1]?.['#text'] || item.image[0]?.['#text'];

                            if (imageUrl && imageUrl !== '') {
                                // Download and process the image
                                const albumImage = await Jimp.read(imageUrl);
                                albumImage.resize(albumSize, albumSize);

                                const x = j * albumSize;
                                const y = i * albumSize;

                                // Composite the album cover onto the canvas
                                canvas.composite(albumImage, x, y);
                            } else {
                                // Draw placeholder for missing image
                                await this.drawJimpPlaceholder(canvas, j * albumSize, i * albumSize, albumSize, item.name, item.artist.name);
                            }
                        } catch (error) {
                            // Draw placeholder if image fails to load
                            await this.drawJimpPlaceholder(canvas, j * albumSize, i * albumSize, albumSize, item.name, item.artist.name);
                        }
                    } else {
                        // Draw empty placeholder
                        await this.drawJimpEmptyPlaceholder(canvas, j * albumSize, i * albumSize, albumSize);
                    }
                }
            }

            // Convert to buffer
            const buffer = await canvas.getBufferAsync(Jimp.MIME_PNG);

            // Create attachment
            const attachment = new AttachmentBuilder(buffer, {
                name: `${fmUsername}-${gridSize}x${gridSize}-albums-${periodObj.type.toLowerCase()}.png`
            });

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: `${gridSize}x${gridSize} Album Collage (${periodObj.type}) - ${fmUsername}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                    url: `https://www.last.fm/user/${fmUsername}`
                })
                .setImage(`attachment://${fmUsername}-${gridSize}x${gridSize}-albums-${periodObj.type.toLowerCase()}.png`)
                .setFooter({ text: `Generated from ${fmUsername}'s ${periodObj.type.toLowerCase()} listening data` });

            // Delete loading message and send result
            try {
                await loadingMsg.delete();
            } catch (error) {
                // Ignore deletion errors
            }

            return message.channel.send({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('Album collage error:', error);
            return embeds.warn(message, `Error creating album collage. Please try again.`);
        }
    }

    async drawJimpPlaceholder(canvas, x, y, size, albumName, artistName) {
        try {
            const Jimp = require('jimp');

            // Create placeholder with dark gray background
            const placeholder = new Jimp(size, size, 0x2a2a2aff);

            // Add border effect by drawing a slightly darker rectangle inside
            const borderSize = 2;
            const innerRect = new Jimp(size - borderSize * 2, size - borderSize * 2, 0x444444ff);
            placeholder.composite(innerRect, borderSize, borderSize);

            // For now, just use the solid color placeholder
            // Text rendering in Jimp is more complex and would require additional setup
            canvas.composite(placeholder, x, y);
        } catch (error) {
            // If anything fails, just draw a simple dark rectangle
            const Jimp = require('jimp');
            const placeholder = new Jimp(size, size, 0x2a2a2aff);
            canvas.composite(placeholder, x, y);
        }
    }

    async drawJimpEmptyPlaceholder(canvas, x, y, size) {
        try {
            const Jimp = require('jimp');

            // Create empty placeholder with very dark background
            const placeholder = new Jimp(size, size, 0x0a0a0aff);

            // Add subtle border
            const borderSize = 1;
            const innerRect = new Jimp(size - borderSize * 2, size - borderSize * 2, 0x333333ff);
            placeholder.composite(innerRect, borderSize, borderSize);

            canvas.composite(placeholder, x, y);
        } catch (error) {
            // If anything fails, just draw a simple dark rectangle
            const Jimp = require('jimp');
            const placeholder = new Jimp(size, size, 0x0a0a0aff);
            canvas.composite(placeholder, x, y);
        }
    }

    drawPlaceholder(ctx, x, y, size, albumName, artistName) {
        // Legacy canvas method - kept for compatibility
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x, y, size, size);

        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, size, size);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxLength = 20;
        const displayAlbum = albumName.length > maxLength ? albumName.substring(0, maxLength) + '...' : albumName;
        const displayArtist = artistName.length > maxLength ? artistName.substring(0, maxLength) + '...' : artistName;

        ctx.fillText(displayAlbum, x + size / 2, y + size / 2 - 10);
        ctx.font = '12px Arial';
        ctx.fillText(displayArtist, x + size / 2, y + size / 2 + 10);
    }

    drawEmptyPlaceholder(ctx, x, y, size) {
        // Legacy canvas method - kept for compatibility
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x, y, size, size);

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, size, size);
    }

    createTextBasedAlbumChart(message, items, gridSize, periodObj, fmUsername, targetUser) {
        // Fallback text-based chart for albums when canvas is not available
        let chart = '';

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const index = i * gridSize + j;
                if (items[index]) {
                    const item = items[index];
                    const name = item.name.length > 15 ? item.name.substring(0, 15) + '..' : item.name;
                    const artist = item.artist.name.length > 15 ? item.artist.name.substring(0, 15) + '..' : item.artist.name;
                    const plays = parseInt(item.playcount).toLocaleString();
                    const itemUrl = item.url || `https://www.last.fm/music/${encodeURIComponent(item.artist.name)}/_/${encodeURIComponent(item.name)}`;

                    chart += `**${index + 1}.** [${name}](${itemUrl}) by **${artist}** (${plays})\n`;
                } else {
                    chart += `**${index + 1}.** —\n`;
                }
            }
            if (i < gridSize - 1) chart += '\n';
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setAuthor({
                name: `${gridSize}x${gridSize} Album Chart (${periodObj.type}) - ${fmUsername}`,
                iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                url: `https://www.last.fm/user/${fmUsername}`
            })
            .setDescription(chart)
            .setFooter({ text: `Install 'jimp' package for visual album collages | Total albums: ${items.length}` });

        return message.channel.send({ embeds: [embed] });
    }

    period(input) {
        const periods = {
            'overall': { period: '', type: 'Overall' },
            'week': { period: '&period=7day', type: 'Weekly' },
            '7d': { period: '&period=7day', type: 'Weekly' },
            'month': { period: '&period=1month', type: 'Monthly' },
            '1m': { period: '&period=1month', type: 'Monthly' },
            '3m': { period: '&period=3month', type: '3 Month' },
            '6m': { period: '&period=6month', type: '6 Month' },
            'year': { period: '&period=12month', type: 'Yearly' },
            '1y': { period: '&period=12month', type: 'Yearly' }
        };

        return periods[input] || periods['overall'];
    }
}

class Streak {
    constructor(userId) {
        this.userId = userId;
    }

    async execute(message, args) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            let targetUser = message.author;

            if (args[1]) {
                const userResult = await findUser(message.guild, args[1], message.client);
                if (userResult.found) {
                    targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
                }
            }

            const fmUsername = await userService.getLastFMUsername(targetUser.id);
            if (!fmUsername) {
                return embeds.warn(message, error(targetUser, message.author, 'notConnected'));
            }

            // Get recent tracks to analyze streak
            const recentUrl = `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUsername}&api_key=${config.apis.lastfm}&format=json&limit=200&extended=1`;
            const recentData = await fetch(recentUrl).then(res => res.json());

            if (!recentData.recenttracks || !recentData.recenttracks.track) {
                return embeds.warn(message, `No recent tracks found for **${fmUsername}**`);
            }

            const tracks = Array.isArray(recentData.recenttracks.track) ? recentData.recenttracks.track : [recentData.recenttracks.track];

            // Find current streak
            let currentStreak = 1;
            let streakArtist = tracks[0].artist.name;
            let streakTrack = tracks[0].name;


            // Check for artist streak
            for (let i = 1; i < tracks.length; i++) {
                if (tracks[i].artist.name === streakArtist) {
                    currentStreak++;
                } else {
                    break;
                }
            }

            // Check for track streak
            let trackStreak = 1;
            for (let i = 1; i < tracks.length; i++) {
                if (tracks[i].name === streakTrack && tracks[i].artist.name === streakArtist) {
                    trackStreak++;
                } else {
                    break;
                }
            }

            const artistUrl = `https://www.last.fm/music/${encodeURIComponent(streakArtist)}`;
            const trackUrl = `https://www.last.fm/music/${encodeURIComponent(streakArtist)}/_/${encodeURIComponent(streakTrack)}`;

            let description = `**Artist streak:** [**${streakArtist}**](${artistUrl}) - **${currentStreak}** ${currentStreak === 1 ? 'play' : 'plays'}`;

            if (trackStreak > 1) {
                description += `\n**Track streak:** [**${streakTrack}**](${trackUrl}) - **${trackStreak}** ${trackStreak === 1 ? 'play' : 'plays'}`;
            }

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: `Current streak - ${fmUsername}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                    url: `https://www.last.fm/user/${fmUsername}`
                })
                .setDescription(description);

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error fetching streak information. Please try again.`);
        }
    }
}

class Pace {
    constructor(userId) {
        this.userId = userId;
    }

    async execute(message, args) {
        try {
            const { getService } = require('@services');
            const userService = getService('user');
            
            let targetUser = message.author;

            if (args[1]) {
                const userResult = await findUser(message.guild, args[1], message.client);
                if (userResult.found) {
                    targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
                }
            }

            const fmUsername = await userService.getLastFMUsername(targetUser.id);
            if (!fmUsername) {
                return embeds.warn(message, error(targetUser, message.author, 'notConnected'));
            }

            // Get user info for total plays and registration date
            const userInfoUrl = `http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${fmUsername}&api_key=${config.apis.lastfm}&format=json`;
            const userInfo = await fetch(userInfoUrl).then(res => res.json());

            if (!userInfo.user) {
                return embeds.warn(message, `User **${fmUsername}** not found.`);
            }

            const totalPlays = parseInt(userInfo.user.playcount);
            const registeredTimestamp = parseInt(userInfo.user.registered.unixtime);
            const now = Math.floor(Date.now() / 1000);
            const daysSinceRegistration = Math.floor((now - registeredTimestamp) / 86400);

            // Get recent tracks for daily pace calculation
            const recentUrl = `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUsername}&api_key=${config.apis.lastfm}&format=json&limit=200&extended=1`;
            const recentData = await fetch(recentUrl).then(res => res.json());

            let dailyPlays = 0;
            if (recentData.recenttracks && recentData.recenttracks.track) {
                const tracks = Array.isArray(recentData.recenttracks.track) ? recentData.recenttracks.track : [recentData.recenttracks.track];
                const oneDayAgo = now - 86400;

                dailyPlays = tracks.filter(track => {
                    if (track['@attr'] && track['@attr'].nowplaying) return true;
                    return track.date && parseInt(track.date.uts) > oneDayAgo;
                }).length;
            }

            const averageDailyPlays = daysSinceRegistration > 0 ? (totalPlays / daysSinceRegistration).toFixed(1) : 0;
            const registrationDate = new Date(registeredTimestamp * 1000).toLocaleDateString();

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setAuthor({
                    name: `Scrobbling pace - ${fmUsername}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                    url: `https://www.last.fm/user/${fmUsername}`
                })
                .addFields(
                    { name: 'Total plays', value: totalPlays.toLocaleString(), inline: true },
                    { name: 'Registered', value: registrationDate, inline: true },
                    { name: 'Days active', value: daysSinceRegistration.toLocaleString(), inline: true },
                    { name: 'Average per day', value: averageDailyPlays, inline: true },
                    { name: 'Last 24 hours', value: dailyPlays.toString(), inline: true },
                    { name: 'Current pace', value: dailyPlays > 0 ? `${(dailyPlays * 365).toLocaleString()} per year` : 'No recent activity', inline: true }
                );

            return message.channel.send({ embeds: [embed] });
        } catch (error) {
            return embeds.warn(message, `Error fetching pace information. Please try again.`);
        }
    }
}
