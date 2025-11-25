const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "yeet",
  description: "Yeet someone",
  syntax: 'yeet (user)',
  example: 'yeet @vwsn',
  run: createRoleplayCommand('yeet', 'yeeted'),
  data: getRoleplaySlashData('yeet', 'Yeet someone')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('yeet', 'yeeted')
};
