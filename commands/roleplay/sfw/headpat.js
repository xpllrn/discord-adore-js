const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "headpat",
  description: "Give someone a nice headpat",
  syntax: 'headpat (user)',
  example: 'headpat @vwsn',
  run: createRoleplayCommand('pat', 'headpatted'),
  data: getRoleplaySlashData('headpat', 'Give someone a nice headpat'),
  execute: executeRoleplaySlash('pat', 'headpatted')
};
