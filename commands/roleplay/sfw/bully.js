const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "bully",
  description: "Bully someone",
  syntax: 'bully (user)',
  example: 'bully @vwsn',
  run: createRoleplayCommand('bully', 'bullied'),
  data: getRoleplaySlashData('bully', 'Bully someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('bully', 'bullied')
};
