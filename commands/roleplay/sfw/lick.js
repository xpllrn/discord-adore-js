const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "lick",
  description: "Lick someone",
  syntax: 'lick (user)',
  example: 'lick @vwsn',
  run: createRoleplayCommand('lick', 'licked')
};
