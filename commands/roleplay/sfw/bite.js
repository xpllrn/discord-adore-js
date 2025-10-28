const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "bite",
  description: "Bite someone",
  syntax: 'bite (user)',
  example: 'bite @vwsn',
  run: createRoleplayCommand('bite', 'bit')
};
