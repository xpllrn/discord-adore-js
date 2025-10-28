const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "yuri",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'yuri (user)',
  example: 'yuri @user',
  run: createNSFWRoleplayCommand('yuri', 'did yuri with')
};