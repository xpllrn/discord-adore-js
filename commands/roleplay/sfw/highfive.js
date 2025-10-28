const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "highfive",
  aliases: ['hi5'],
  description: "Give someone a high five",
  syntax: 'highfive (user)',
  example: 'highfive @vwsn',
  run: createRoleplayCommand('highfive', 'high-fived')
};
