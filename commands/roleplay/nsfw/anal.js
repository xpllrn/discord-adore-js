const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "anal",
  description: "`NSFW` anal roleplay command.",
  syntax: 'anal (user)',
  example: 'anal @vee',
  run: createNSFWRoleplayCommand('anal', 'did anal with')
};