const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "smug",
  description: "Be smug at someone",
  syntax: 'smug (user)',
  example: 'smug @vwsn',
  run: createRoleplayCommand('smug', 'smugged at')
};
