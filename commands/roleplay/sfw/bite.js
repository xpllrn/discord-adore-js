const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "bite",
  description: "Bite someone",
  syntax: 'bite (user)',
  example: 'bite @vwsn',
  run: createRoleplayCommand('bite', 'bit'),
  data: getRoleplaySlashData('bite', 'Bite someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('bite', 'bit')
};
