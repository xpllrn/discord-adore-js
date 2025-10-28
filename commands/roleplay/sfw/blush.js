const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "blush",
  description: "Blush at someone",
  syntax: 'blush (user)',
  example: 'blush @vwsn',
  run: createRoleplayCommand('blush', 'blushed at')
};
