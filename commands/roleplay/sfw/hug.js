const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "hug",
  description: "Give someone a warm hug",
  syntax: 'hug (user)',
  example: 'hug @vwsn',
  run: createRoleplayCommand('hug', 'hugged'),
  data: getRoleplaySlashData('hug', 'Give someone a warm hug')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('hug', 'hugged')
};
