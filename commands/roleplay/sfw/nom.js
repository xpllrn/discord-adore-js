const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "nom",
  description: "Nom on someone",
  syntax: 'nom (user)',
  example: 'nom @vwsn',
  run: createRoleplayCommand('nom', 'nommed'),
  data: getRoleplaySlashData('nom', 'Nom on someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('nom', 'nommed')
};
