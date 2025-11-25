const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');
const { ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "headpat",
  description: "Give someone a nice headpat",
  syntax: 'headpat (user)',
  example: 'headpat @vwsn',
  run: createRoleplayCommand('pat', 'headpatted'),
  data: getRoleplaySlashData('headpat', 'Give someone a nice headpat')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),
  execute: executeRoleplaySlash('pat', 'headpatted')
};
