const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "pat",
  description: "Give someone a gentle pat",
  syntax: 'pat (user)',
  example: 'pat @vwsn',
  run: createRoleplayCommand('pat', 'patted'),
  data: getRoleplaySlashData('pat', 'Give someone a gentle pat'),
  execute: executeRoleplaySlash('pat', 'patted')
};
