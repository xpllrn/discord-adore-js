const { embeds } = require('../../../core/embeds');
const { findUser } = require('../../../handlers/finder');
const { processCommand } = require('../../../utils/commandProcessor');
const { getService } = require('@services');

module.exports = {
  name: 'exec',
  aliases: ['sudo', 'runas'],
  description: 'Execute a command as another user',
  permission: 'dev',
  syntax: 'exec [user] [command]',
  example: 'exec 123456789 balance',

  run: async (client, message, args) => {
    if (args.length < 2) {
      return embeds.warn(message, 'Usage: `,exec [user id] [command]`');
    }

    const targetId = args[0].replace(/[<@!>]/g, '');
    const commandToRun = args.slice(1).join(' ');

    // Validate user ID
    if (!/^\d{17,19}$/.test(targetId)) {
      return embeds.warn(message, 'Please provide a **valid user ID**!');
    }

    // Try to find the user
    const userResult = await findUser(message.guild, targetId, client);
    if (!userResult.found) {
      return embeds.warn(message, 'Could not find that **user**!');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    const targetMember = userResult.isGlobal ? null : userResult.user;

    // Get the guild prefix
    const prefixService = getService('prefix');
    const prefix = await prefixService.getGuildPrefix(message.guild.id);

    // Create a fake message object that mimics the target user
    const fakeMessage = {
      ...message,
      author: targetUser,
      member: targetMember || message.member,
      content: `${prefix}${commandToRun}`,
      reply: (content) => message.channel.send(content),
      react: (emoji) => message.react(emoji),
      delete: () => Promise.resolve(),
      channel: message.channel,
      guild: message.guild,
      client: client,
      createdTimestamp: Date.now(),
      id: message.id,
      // Flag to indicate this is an exec'd command
      _isExec: true,
      _execBy: message.author.id
    };

    // Notify that we're executing
    await embeds.info(message, `Executing \`${commandToRun}\` as **${targetUser.username}**`);

    // Process the command as the target user
    try {
      await processCommand(fakeMessage, false);
    } catch (error) {
      return embeds.deny(message, `Error executing command: ${error.message}`);
    }
  }
};
