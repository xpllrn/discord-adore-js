const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "sleep",
  description: "Sleep with someone",
  syntax: 'sleep (user)',
  example: 'sleep @vwsn',
  run: createRoleplayCommand('sleep', 'slept with')
};
