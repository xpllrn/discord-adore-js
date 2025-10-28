const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "slap",
  description: "Slap someone",
  syntax: 'slap (user)',
  example: 'slap @vwsn',
  run: createRoleplayCommand('slap', 'slapped')
};
