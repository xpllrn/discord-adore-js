const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "dance",
  description: "Dance with someone",
  syntax: 'dance (user)',
  example: 'dance @vwsn',
  run: createRoleplayCommand('dance', 'danced with'),
  data: getRoleplaySlashData('dance', 'Dance with someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('dance', 'danced with')
};
