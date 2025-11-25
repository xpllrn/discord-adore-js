const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "blush",
  description: "Blush at someone",
  syntax: 'blush (user)',
  example: 'blush @vwsn',
  run: createRoleplayCommand('blush', 'blushed at'),
  data: getRoleplaySlashData('blush', 'Blush at someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('blush', 'blushed at')
};
