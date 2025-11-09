const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "facepalm",
  description: "Facepalm at someone",
  syntax: 'facepalm (user)',
  example: 'facepalm @vwsn',
  run: createRoleplayCommand('facepalm', 'facepalmed at')
};
