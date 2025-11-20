const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "cuddle",
  description: "Cuddle with someone",
  syntax: 'cuddle (user)',
  example: 'cuddle @vwsn',
  run: createRoleplayCommand('cuddle', 'cuddled')
};
