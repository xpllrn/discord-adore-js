const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "bonk",
  description: "Bonk someone",
  syntax: 'bonk (user)',
  example: 'bonk @vwsn',
  run: createRoleplayCommand('bonk', 'bonked'),
  data: getRoleplaySlashData('bonk', 'Bonk someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('bonk', 'bonked')
};
