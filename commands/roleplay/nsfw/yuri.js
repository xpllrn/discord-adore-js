const { createNSFWRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "yuri",
  description: "`NSFW` yuri roleplay command.",
  syntax: 'yuri (user)',
  example: 'yuri @vee',
  run: createNSFWRoleplayCommand('yuri', 'did yuri with')
};