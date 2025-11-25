const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "wink",
  description: "Wink at someone",
  syntax: 'wink (user)',
  example: 'wink @vwsn',
  run: createRoleplayCommand('wink', 'winked at'),
  data: getRoleplaySlashData('wink', 'Wink at someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('wink', 'winked at')
};
