const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../../utils/permissions');
const { getService } = require('@services');
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
  run: async(client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'fetch');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'invite':
      case 'inv': {
        const subcommandInfo = {
          description: 'Fetch an invite link for a server by ID',
          syntax: '{guildprefix}fetch invite [server id]',
          aliases: ['inv'],
          parameters: ['server id'],
          example: '{guildprefix}fetch invite 1234567890123456789'
        };
        await handleInvite(client, message, args);
        break;
      }

      case 'confession':
      case 'confess': {
        const subcommandInfo = {
          description: 'Reveal who submitted a confession',
          syntax: '{guildprefix}fetch confession [server id] [confession id]',
          aliases: ['confess'],
          parameters: ['server id', 'confession id'],
          example: '{guildprefix}fetch confession 1234567890123456789 5'
        };
        await handleConfession(client, message, args);
        break;
      }

      case 'mutuals':
      case 'mutual': {
        const subcommandInfo = {
          description: 'Get invite links for all mutual servers with a user',
          syntax: '{guildprefix}fetch mutuals [user id]',
          aliases: ['mutual'],
          parameters: ['user id'],
          example: '{guildprefix}fetch mutuals 1234567890123456789'
        };
        await handleMutuals(client, message, args);
        break;
      }

      default: {
        return runHelpCommand(message, 'fetch');
      }
    }
  }
};

async function handleInvite(client, message, args) {
  if (!args[1]) {
    return embeds.warn(message, 'Please provide a **server ID**!');
  }

  const serverId = args[1];

  // Validate server ID format
  if (!/^\d{17,19}$/.test(serverId)) {
    return embeds.warn(message, 'Please provide a **valid server ID**!');
  }

  try {
    // Get the guild
    const guild = client.guilds.cache.get(serverId);
    
    if (!guild) {
      return embeds.deny(message, `Bot is not in server with ID: \`${serverId}\``);
    }

    // Check if bot has permission to create invites
    const botMember = guild.members.cache.get(client.user.id);
    if (!botMember.permissions.has('CreateInstantInvite')) {
      return embeds.deny(message, `Missing **Create Instant Invite** permission in **${guild.name}**`);
    }

    // Try to fetch existing invites first
    let existingInvite = null;
    try {
      const invites = await guild.invites.fetch();
      existingInvite = invites.find(invite => 
        !invite.temporary && 
        (invite.maxAge === 0 || invite.expiresTimestamp > Date.now()) &&
        invite.maxUses === 0
      );
    } catch (error) {
      // If we can't fetch invites, we'll create a new one
    }

    if (existingInvite) {
      return embeds.success(message, `Here's the [invite](${existingInvite.url}) from **${guild.name}**`);
    }

    // No existing invite found, create a new one
    // Find any text channel where bot can create invites
    const targetChannel = guild.channels.cache.find(channel => 
      channel.type === 0 && // Text channel
      channel.permissionsFor(botMember).has('CreateInstantInvite')
    );

    if (!targetChannel) {
      return embeds.deny(message, `Cannot find a suitable channel to create invite in **${guild.name}**`);
    }

    // Create the invite
    const newInvite = await targetChannel.createInvite({
      maxAge: 0, // Never expires
      maxUses: 0, // Unlimited uses
      unique: true,
      reason: `Fetch invite created by ${message.author.username}`
    });

    return embeds.success(message, `Here's the [invite](${newInvite.url}) from **${guild.name}**`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, `An error occurred while processing the invite for server \`${serverId}\``);
  }
}


async function handleConfession(client, message, args) {
  if (!args[1] || !args[2]) {
    return embeds.warn(message, 'Syntax: `,fetch confession [server id] [confession id]`');
  }

  const guildId = args[1];
  const confessionId = parseInt(args[2]);

  if (isNaN(confessionId) || confessionId < 1) {
    return embeds.deny(message, 'Invalid confession ID provided.');
  }

  // Validate guild ID
  if (!/^\d{17,19}$/.test(guildId)) {
    return embeds.deny(message, 'Invalid server ID provided.');
  }

  try {
    // Check if bot is in the guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return embeds.deny(message, 'Bot is not in that server or server does not exist.');
    }

    const confessionService = getService('confession');
    
    // Get the confession
    const confession = await confessionService.getConfessionById(guildId, confessionId);
    
    if (!confession) {
      return embeds.deny(message, `Confession #${confessionId} not found in server **${guild.name}**.`);
    }

    // Fetch the user
    let user;
    try {
      user = await client.users.fetch(confession.userId);
    } catch (error) {
      return embeds.deny(message, `Could not fetch user with ID: \`${confession.userId}\``);
    }

    // Create reveal embed
    const revealEmbed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`Confession #${confessionId} Reveal${confession.replyTo ? ' (Reply)' : ''}`)
      .addFields(
        {
          name: 'Server',
          value: `**${guild.name}** (\`${guild.id}\`)`,
          inline: false
        },
        {
          name: 'Author',
          value: `${user} (\`${user.id}\`)`,
          inline: false
        },
        {
          name: 'Submitted',
          value: `<t:${Math.floor(confession.createdAt.getTime() / 1000)}:R>`,
          inline: false
        },
        {
          name: 'Message ID',
          value: `\`${confession.messageId}\``,
          inline: false
        }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Requested by ${message.author.username}` })

    // Add reply info if this is a reply
    if (confession.replyTo) {
      revealEmbed.addFields({
        name: 'Reply To',
        value: `Confession #${confession.replyTo}`,
        inline: false
      });
    }

    return message.channel.send({ embeds: [revealEmbed] });

  } catch (error) {
    logger.webhook.error(error, 'Fetch Confession Command', {
      user: message.author,
      guild: message.guild,
      channel: message.channel,
      command: 'fetch confession',
      args: `${guildId} ${confessionId}`
    });
    return embeds.deny(message, 'An error occurred while revealing the confession.');
  }
}

async function handleMutuals(client, message, args) {
  if (!args[1]) {
    return embeds.warn(message, 'Please provide a **user ID**!');
  }

  const userId = args[1];

  // Validate user ID format
  if (!/^\d{17,19}$/.test(userId)) {
    return embeds.warn(message, 'Please provide a **valid user ID**!');
  }

  try {
    // Fetch the user
    let targetUser;
    try {
      targetUser = await client.users.fetch(userId);
    } catch (error) {
      return embeds.deny(message, `Could not fetch user with ID: \`${userId}\``);
    }

    // Find all mutual servers
    const mutualGuilds = client.guilds.cache.filter(guild => 
      guild.members.cache.has(userId)
    );

    if (mutualGuilds.size === 0) {
      return embeds.deny(message, `No mutual servers found with **${targetUser.username}**`);
    }

    // Create invites for each mutual server
    const inviteResults = [];
    
    for (const [guildId, guild] of mutualGuilds) {
      try {
        const botMember = guild.members.cache.get(client.user.id);
        
        // Check if bot has permission to create invites
        if (!botMember.permissions.has('CreateInstantInvite')) {
          inviteResults.push({
            guild: guild,
            invite: null,
            error: 'Missing Create Instant Invite permission'
          });
          continue;
        }

        // Try to fetch existing invites first
        let existingInvite = null;
        try {
          const invites = await guild.invites.fetch();
          existingInvite = invites.find(invite => 
            !invite.temporary && 
            (invite.maxAge === 0 || invite.expiresTimestamp > Date.now()) &&
            invite.maxUses === 0
          );
        } catch (error) {
          // If we can't fetch invites, we'll create a new one
        }

        if (existingInvite) {
          inviteResults.push({
            guild: guild,
            invite: existingInvite.url,
            error: null
          });
          continue;
        }

        // Find any text channel where bot can create invites
        const targetChannel = guild.channels.cache.find(channel => 
          channel.type === 0 && // Text channel
          channel.permissionsFor(botMember).has('CreateInstantInvite')
        );

        if (!targetChannel) {
          inviteResults.push({
            guild: guild,
            invite: null,
            error: 'No suitable channel found'
          });
          continue;
        }

        // Create the invite
        const newInvite = await targetChannel.createInvite({
          maxAge: 0, // Never expires
          maxUses: 0, // Unlimited uses
          unique: true,
          reason: `Fetch mutuals created by ${message.author.username}`
        });

        inviteResults.push({
          guild: guild,
          invite: newInvite.url,
          error: null
        });

      } catch (error) {
        inviteResults.push({
          guild: guild,
          invite: null,
          error: 'Failed to create invite'
        });
      }
    }

    // Build the response embed
    const mutualsEmbed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`Mutual Servers with ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(`Found **${mutualGuilds.size}** mutual server${mutualGuilds.size !== 1 ? 's' : ''}`)
      .setFooter({ text: `Requested by ${message.author.username}` });

    // Add fields for each server
    const successfulInvites = inviteResults.filter(r => r.invite);
    const failedInvites = inviteResults.filter(r => !r.invite);

    if (successfulInvites.length > 0) {
      const inviteList = successfulInvites
        .map(r => `• [${r.guild.name}](${r.invite}) (\`${r.guild.id}\`)`)
        .join('\n');
      
      mutualsEmbed.addFields({
        name: `✅ Invites (${successfulInvites.length})`,
        value: inviteList.length > 1024 ? inviteList.substring(0, 1021) + '...' : inviteList,
        inline: false
      });
    }

    if (failedInvites.length > 0) {
      const failedList = failedInvites
        .map(r => `• **${r.guild.name}** - ${r.error}`)
        .join('\n');
      
      mutualsEmbed.addFields({
        name: `❌ Failed (${failedInvites.length})`,
        value: failedList.length > 1024 ? failedList.substring(0, 1021) + '...' : failedList,
        inline: false
      });
    }

    return message.channel.send({ embeds: [mutualsEmbed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, `An error occurred while fetching mutual servers for user \`${userId}\``);
  }
}
