const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "blush",
  description: "Blush at someone",
  syntax: 'blush (user)',
  example: 'blush @vwsn',
  run: createRoleplayCommand('blush', 'blushed at')
};
