const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../utils/permissions');
const { findUser } = require('../../handlers/finder');
const { ensureUserData, ensureGuildData } = require('../../database');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');

module.exports = {
  name: "clear",
  aliases: [],
  description: 'Clear name history for users or servers',
  permission: 'dev',
  isGroupCommand: true,
  run: async(client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'clear');
    }

    const subcommand = args[0].toLowerCase();

    if (subcommand === 'names' || subcommand === 'usernames') {
      const subcommandInfo = {
        description: 'Clear a user\'s name change history',
        usage: '{guildprefix}clear names [@user]',
        aliases: ['usernames'],
        parameters: ['user'],
        example: '{guildprefix}clear names @user'
      };
      await handleClearNames(client, message, args);
    } else if (subcommand === 'servernames' || subcommand === 'guildnames') {
      const subcommandInfo = {
        description: 'Clear the server\'s name change history',
        usage: '{guildprefix}clear servernames [server id]',
        aliases: ['guildnames'],
        parameters: ['server id'],
        example: '{guildprefix}clear servernames 1234567890123456789'
      };
      await handleClearServerNames(client, message, args);
    } else {
      return runHelpCommand(message, 'clear');
    }
  }
};

async function handleClearNames(client, message, args) {
  const userService = getService('user');

  if (!args[1]) {
    return runHelpCommand(message, 'clear');
  }

  // Find the target user
  const userResult = await findUser(message.guild, args[1], client);

  if (!userResult.found) {
    return embeds.warn(message, userResult.error || 'User not found');
  }

  let targetUser, targetMember;
  if (userResult.isGlobal) {
    targetUser = userResult.user;
    targetMember = null;
  } else {
    targetUser = userResult.user.user || userResult.user;
    targetMember = userResult.user;
  }

  // Ensure user data exists in the database
  await ensureUserData(targetUser.id);

  try {
    const nameHistory = await userService.getNameHistory(targetUser.id);

    if (nameHistory.length === 0) {
      const username = targetMember ? targetMember.displayName : targetUser.username;
      return embeds.warn(message, `**${username}** has no name history to clear`);
    }

    const username = targetMember ? targetMember.displayName : targetUser.username;

    // Show confirmation dialog
    await createConfirmation(
      message,
      `Are you sure you want to **clear** all name history for **${username}**?`,
      async (interaction) => {
        // On approve: clear all name history using service layer
        await userService.clearAllNameHistory(targetUser.id);

        // Edit the confirmation embed to show success message
        const successEmbed = embeds.createSuccess(message, `**Cleared** all name history for **${username}**`);

        await interaction.editReply({ embeds: [successEmbed], components: [] });
      }
    );
  } catch (error) {
    console.error('Error clearing name history:', error);
    return embeds.deny(message, 'Failed to clear name history');
  }
}

async function handleClearServerNames(client, message, args) {
  const guildService = getService('guild');

  // Determine which guild to clear
  let targetGuildId = message.guild.id;
  let targetGuildName = message.guild.name;

  // If an argument is provided, try to use it as a guild ID
  if (args[1]) {
    targetGuildId = args[1];
    
    // Try to fetch guild info from client
    try {
      const fetchedGuild = client.guilds.cache.get(targetGuildId);
      if (fetchedGuild) {
        targetGuildName = fetchedGuild.name;
      } else {
        targetGuildName = `Server ${targetGuildId}`;
      }
    } catch (error) {
      targetGuildName = `Server ${targetGuildId}`;
    }
  }

  // Ensure guild data exists in the database
  await ensureGuildData(targetGuildId);

  try {
    const nameHistory = await guildService.getGuildNameHistory(targetGuildId);

    if (nameHistory.length === 0) {
      return embeds.warn(message, 'No guild name history to clear');
    }

    // Show confirmation dialog
    await createConfirmation(
      message,
      `Are you sure you want to **clear** all guild name history for **${targetGuildName}**?`,
      async (interaction) => {
        // On approve: clear all guild name history
        await guildService.clearAllGuildNameHistory(targetGuildId);

        // Edit the confirmation embed to show success message
        const successEmbed = embeds.createSuccess(message, `**Cleared** all guild name history for **${targetGuildName}**`);

        await interaction.editReply({ embeds: [successEmbed], components: [] });
      }
    );
  } catch (error) {
    console.error('Error clearing guild name history:', error);
    return embeds.deny(message, 'Failed to clear guild name history');
  }
}
