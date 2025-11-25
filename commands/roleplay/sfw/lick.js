const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "lick",
  description: "Lick someone",
  syntax: 'lick (user)',
  example: 'lick @vwsn',
  run: createRoleplayCommand('lick', 'licked'),
  data: getRoleplaySlashData('lick', 'Lick someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('lick', 'licked')
};
