const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "sleep",
  description: "Sleep with someone",
  syntax: 'sleep (user)',
  example: 'sleep @vwsn',
  run: createRoleplayCommand('sleep', 'slept with')
};
