const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "wave",
  description: "Wave at someone",
  syntax: 'wave (user)',
  example: 'wave @vwsn',
  run: createRoleplayCommand('wave', 'waved at'),
  data: getRoleplaySlashData('wave', 'Wave at someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('wave', 'waved at')
};
