const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "run",
  description: "Run from someone",
  syntax: 'run (user)',
  example: 'run @vwsn',
  run: createRoleplayCommand('run', 'ran from')
};
