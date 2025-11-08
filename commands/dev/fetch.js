const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../utils/permissions');

module.exports = {
  name: "fetch",
  aliases: [],
  description: 'Fetch server information and invites',
  permission: 'dev',
  isGroupCommand: true,
  run: async(client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'fetch');
    }

    const subcommand = args[0].toLowerCase();

    if (subcommand === 'invite' || subcommand === 'inv') {
      const subcommandInfo = {
        description: 'Fetch an invite link for a server by ID',
        usage: '{guildprefix}fetch invite [server id]',
        aliases: ['inv'],
        parameters: ['server id'],
        example: '{guildprefix}fetch invite 1234567890123456789'
      };
      await handleInvite(client, message, args);
    } else {
      return runHelpCommand(message, 'fetch');
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
    console.error('Error in fetch invite command:', error);
    return embeds.deny(message, `An error occurred while processing the invite for server \`${serverId}\``);
  }
}
