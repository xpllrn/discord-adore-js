const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "kiss",
  description: "Give someone a sweet kiss",
  syntax: 'kiss (user)',
  example: 'kiss @vwsn',
  run: createRoleplayCommand('kiss', 'kissed')
};
