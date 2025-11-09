const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "yeet",
  description: "Yeet someone",
  syntax: 'yeet (user)',
  example: 'yeet @vwsn',
  run: createRoleplayCommand('yeet', 'yeeted')
};
