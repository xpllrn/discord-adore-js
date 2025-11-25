const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "glomp",
  description: "Glomp someone",
  syntax: 'glomp (user)',
  example: 'glomp @vwsn',
  run: createRoleplayCommand('glomp', 'glomped'),
  data: getRoleplaySlashData('glomp', 'Glomp someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('glomp', 'glomped')
};
