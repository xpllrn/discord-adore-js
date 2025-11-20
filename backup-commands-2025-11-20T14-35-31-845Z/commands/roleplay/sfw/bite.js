const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "bite",
  description: "Bite someone",
  syntax: 'bite (user)',
  example: 'bite @vwsn',
  run: createRoleplayCommand('bite', 'bit')
};
