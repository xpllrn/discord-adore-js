const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "yeet",
  description: "Yeet someone",
  syntax: 'yeet (user)',
  example: 'yeet @vwsn',
  run: createRoleplayCommand('yeet', 'yeeted')
};
