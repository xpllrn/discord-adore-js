const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "slap",
  description: "Slap someone",
  syntax: 'slap (user)',
  example: 'slap @vwsn',
  run: createRoleplayCommand('slap', 'slapped'),
  data: getRoleplaySlashData('slap', 'Slap someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('slap', 'slapped')
};
