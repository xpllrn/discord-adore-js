const { embeds } = require('../../core/embeds');

module.exports = {
  name: "invite",
  aliases: ['inv'],
  description: 'Get or create an invite link for a server',
  permission: 'dev',
  usage: '{guildprefix}invite [server_id]',
  example: '{guildprefix}invite 123456789012345678',
  run: async(client, message, args) => {

    if (!args[0]) {
      return embeds.warn(message, 'Please provide a **server ID**!');
    }

    const serverId = args[0];

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

      }

      if (existingInvite) {
        return embeds.success(message, `Here's the [invite](${existingInvite.url}) from **${guild.name}**`);
      }

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
        reason: `Admin invite created by ${message.author.username}`
      });

      return embeds.success(message, `Here's the [invite](${newInvite.url}) from **${guild.name}**`);

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, `An error occurred while processing the invite for server \`${serverId}\``);
    }
  }
};