const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "highfive",
  aliases: ['hi5'],
  description: "Give someone a high five",
  syntax: 'highfive (user)',
  example: 'highfive @vwsn',
  run: createRoleplayCommand('highfive', 'high-fived'),
  data: getRoleplaySlashData('highfive', 'Give someone a high five'),
  execute: executeRoleplaySlash('highfive', 'high-fived')
};
