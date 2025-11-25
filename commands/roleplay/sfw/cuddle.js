const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "cuddle",
  description: "Cuddle with someone",
  syntax: 'cuddle (user)',
  example: 'cuddle @vwsn',
  run: createRoleplayCommand('cuddle', 'cuddled'),
  data: getRoleplaySlashData('cuddle', 'Cuddle with someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('cuddle', 'cuddled')
};
