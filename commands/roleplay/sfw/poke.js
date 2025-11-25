const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "poke",
  description: "Poke someone",
  syntax: 'poke (user)',
  example: 'poke @vwsn',
  run: createRoleplayCommand('poke', 'poked'),
  data: getRoleplaySlashData('poke', 'Poke someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('poke', 'poked')
};
