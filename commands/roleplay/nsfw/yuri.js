const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "yuri",
  description: "`NSFW` yuri roleplay command.",
  syntax: 'yuri (user)',
  example: 'yuri @vee',
  run: createNSFWRoleplayCommand('yuri', 'did yuri with')
};