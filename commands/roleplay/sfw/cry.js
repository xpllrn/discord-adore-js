const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "cry",
  description: "Cry at someone",
  syntax: 'cry (user)',
  example: 'cry @vwsn',
  run: createRoleplayCommand('cry', 'cried at'),
  data: getRoleplaySlashData('cry', 'Cry at someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('cry', 'cried at')
};
