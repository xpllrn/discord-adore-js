const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "kill",
  description: "Kill someone (roleplay)",
  syntax: 'kill (user)',
  example: 'kill @vwsn',
  run: createRoleplayCommand('kill', 'killed'),
  data: getRoleplaySlashData('kill', 'Kill someone (roleplay)')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('kill', 'killed')
};
