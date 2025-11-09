const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "slap",
  description: "Slap someone",
  syntax: 'slap (user)',
  example: 'slap @vwsn',
  run: createRoleplayCommand('slap', 'slapped')
};
