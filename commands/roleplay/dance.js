const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "dance",
  description: "Dance with someone",
  syntax: 'dance (user)',
  example: 'dance @vwsn',
  run: createRoleplayCommand('dance', 'danced with')
};
