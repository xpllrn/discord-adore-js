const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "kiss",
  description: "Give someone a sweet kiss",
  syntax: 'kiss (user)',
  example: 'kiss @vwsn',
  run: createRoleplayCommand('kiss', 'kissed'),
  data: getRoleplaySlashData('kiss', 'Give someone a sweet kiss')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('kiss', 'kissed')
};
