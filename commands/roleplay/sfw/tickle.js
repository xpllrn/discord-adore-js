const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "tickle",
  description: "Tickle someone",
  syntax: 'tickle (user)',
  example: 'tickle @vwsn',
  run: createRoleplayCommand('tickle', 'tickled')
};
