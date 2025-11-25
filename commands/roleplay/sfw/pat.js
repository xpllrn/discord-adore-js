const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "pat",
  description: "Give someone a gentle pat",
  syntax: 'pat (user)',
  example: 'pat @vwsn',
  run: createRoleplayCommand('pat', 'patted'),
  data: getRoleplaySlashData('pat', 'Give someone a gentle pat')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('pat', 'patted')
};
