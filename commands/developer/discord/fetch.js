const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../../utils/permissions');
const { getService } = require('@services');
const { findGuild, findUser } = require('../../../handlers/finder');
const config = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "fetch",
  aliases: [],
  description: 'Fetch server information and invites',
  permission: 'developer',
  syntax: 'fetch [subcommand] [parameters]',
  example: 'fetch invite 1234567890123456789',
  isGroupCommand: true,

  subcommands: {
    invite: {
      name: 'invite',
      aliases: ['inv'],
      description: 'Fetch an invite link for a server by ID',
      syntax: '{guildprefix}fetch invite [server id]',
      parameters: ['server id'],
      example: '{guildprefix}fetch invite 1234567890123456789',

      handler: async (client, message, args) => {
        if (!args[0]) {
          return embeds.warn(message, 'Please provide a **server ID**!');
        }

        try {
          const { found, guild, error } = await findGuild(client, args[0]);
          
          if (!found) {
            return embeds.deny(message, error);
          }

          const botMember = guild.members.cache.get(client.user.id);
          if (!botMember.permissions.has('CreateInstantInvite')) {
            return embeds.deny(message, `Missing **Create Instant Invite** permission in **${guild.name}**`);
          }

          let existingInvite = null;
          try {
            const invites = await guild.invites.fetch();
            existingInvite = invites.find(invite => 
              !invite.temporary && 
              (invite.maxAge === 0 || invite.expiresTimestamp > Date.now()) &&
              invite.maxUses === 0
            );
          } catch (error) {}

          if (existingInvite) {
            return embeds.success(message, `Here's the [invite](${existingInvite.url}) from **${guild.name}**`);
          }

          const targetChannel = guild.channels.cache.find(channel => 
            channel.type === 0 &&
            channel.permissionsFor(botMember).has('CreateInstantInvite')
          );

          if (!targetChannel) {
            return embeds.deny(message, `Cannot find a suitable channel to create invite in **${guild.name}**`);
          }

          const newInvite = await targetChannel.createInvite({
            maxAge: 0,
            maxUses: 0,
            unique: true,
            reason: `Fetch invite created by ${message.author.username}`
          });

          return embeds.success(message, `Here's the [invite](${newInvite.url}) from **${guild.name}**`);

        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `An error occurred while processing the invite`);
        }
      }
    },

    confession: {
      name: 'confession',
      aliases: ['confess'],
      description: 'Reveal who submitted a confession',
      syntax: '{guildprefix}fetch confession [server id] [confession id]',
      parameters: ['server id', 'confession id'],
      example: '{guildprefix}fetch confession 1234567890123456789 5',

      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) {
          return embeds.warn(message, 'Syntax: `,fetch confession [server id] [confession id]`');
        }

        const confessionId = parseInt(args[1]);

        if (isNaN(confessionId) || confessionId < 1) {
          return embeds.deny(message, 'Invalid confession ID provided.');
        }

        try {
          const { found, guild, error } = await findGuild(client, args[0]);
          
          if (!found) {
            return embeds.deny(message, error);
          }

          const confessionService = getService('confession');
          const confession = await confessionService.getConfessionById(guild.id, confessionId);
          
          if (!confession) {
            return embeds.deny(message, `Confession #${confessionId} not found in server **${guild.name}**.`);
          }

          const userResult = await findUser(guild, confession.userId, client);
          
          if (!userResult.found) {
            return embeds.deny(message, `Could not fetch user with ID: \`${confession.userId}\``);
          }
          
          const user = userResult.isGlobal ? userResult.user : userResult.user.user;

          const revealEmbed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle(`Confession #${confessionId} Reveal${confession.replyTo ? ' (Reply)' : ''}`)
            .addFields(
              { name: 'Server', value: `**${guild.name}** (\`${guild.id}\`)`, inline: false },
              { name: 'Author', value: `${user} (\`${user.id}\`)`, inline: false },
              { name: 'Submitted', value: `<t:${Math.floor(confession.createdAt.getTime() / 1000)}:R>`, inline: false },
              { name: 'Message ID', value: `\`${confession.messageId}\``, inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Requested by ${message.author.username}` });

          if (confession.replyTo) {
            revealEmbed.addFields({ name: 'Reply To', value: `Confession #${confession.replyTo}`, inline: false });
          }

          return message.channel.send({ embeds: [revealEmbed] });

        } catch (error) {
          logger.webhook.error(error, 'Fetch Confession Command', {
            user: message.author,
            guild: message.guild,
            channel: message.channel,
            command: 'fetch confession',
            args: `${args[0]} ${confessionId}`
          });
          return embeds.deny(message, 'An error occurred while revealing the confession.');
        }
      }
    },

    mutuals: {
      name: 'mutuals',
      aliases: ['mutual'],
      description: 'Get invite links for all mutual servers with a user',
      syntax: '{guildprefix}fetch mutuals [user id]',
      parameters: ['user id'],
      example: '{guildprefix}fetch mutuals 1234567890123456789',

      handler: async (client, message, args) => {
        if (!args[0]) {
          return embeds.warn(message, 'Please provide a **user ID**!');
        }

        try {
          const userResult = await findUser(message.guild, args[0], client);
          
          if (!userResult.found) {
            return embeds.deny(message, userResult.error);
          }
          
          const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
          const userId = targetUser.id;

          const mutualGuilds = client.guilds.cache.filter(guild => 
            guild.members.cache.has(userId)
          );

          if (mutualGuilds.size === 0) {
            return embeds.deny(message, `No mutual servers found with **${targetUser.username}**`);
          }

          const inviteResults = [];
          
          for (const [guildId, guild] of mutualGuilds) {
            try {
              const botMember = guild.members.cache.get(client.user.id);
              
              if (!botMember.permissions.has('CreateInstantInvite')) {
                inviteResults.push({ guild, invite: null, error: 'Missing Create Instant Invite permission' });
                continue;
              }

              let existingInvite = null;
              try {
                const invites = await guild.invites.fetch();
                existingInvite = invites.find(invite => 
                  !invite.temporary && 
                  (invite.maxAge === 0 || invite.expiresTimestamp > Date.now()) &&
                  invite.maxUses === 0
                );
              } catch (error) {}

              if (existingInvite) {
                inviteResults.push({ guild, invite: existingInvite.url, error: null });
                continue;
              }

              const targetChannel = guild.channels.cache.find(channel => 
                channel.type === 0 &&
                channel.permissionsFor(botMember).has('CreateInstantInvite')
              );

              if (!targetChannel) {
                inviteResults.push({ guild, invite: null, error: 'No suitable channel found' });
                continue;
              }

              const newInvite = await targetChannel.createInvite({
                maxAge: 0,
                maxUses: 0,
                unique: true,
                reason: `Fetch mutuals created by ${message.author.username}`
              });

              inviteResults.push({ guild, invite: newInvite.url, error: null });

            } catch (error) {
              inviteResults.push({ guild, invite: null, error: 'Failed to create invite' });
            }
          }

          const mutualsEmbed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle(`Mutual Servers with ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(`Found **${mutualGuilds.size}** mutual server${mutualGuilds.size !== 1 ? 's' : ''}`)
            .setFooter({ text: `Requested by ${message.author.username}` });

          const successfulInvites = inviteResults.filter(r => r.invite);
          const failedInvites = inviteResults.filter(r => !r.invite);

          if (successfulInvites.length > 0) {
            const inviteList = successfulInvites
              .map(r => `• [${r.guild.name}](${r.invite}) (\`${r.guild.id}\`)`)
              .join('\n');
            
            mutualsEmbed.addFields({
              name: `Invites (${successfulInvites.length})`,
              value: inviteList.length > 1024 ? inviteList.substring(0, 1021) + '...' : inviteList,
              inline: false
            });
          }

          if (failedInvites.length > 0) {
            const failedList = failedInvites
              .map(r => `• **${r.guild.name}** - ${r.error}`)
              .join('\n');
            
            mutualsEmbed.addFields({
              name: `Failed (${failedInvites.length})`,
              value: failedList.length > 1024 ? failedList.substring(0, 1021) + '...' : failedList,
              inline: false
            });
          }

          return message.channel.send({ embeds: [mutualsEmbed] });

        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `An error occurred while fetching mutual servers`);
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasPermissionLevel(message, 'dev')) return;

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'fetch');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'fetch');
  }
};
