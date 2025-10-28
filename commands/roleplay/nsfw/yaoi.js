const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "yaoi",
  description: "`NSFW` yaoi roleplay command.",
  syntax: 'yaoi (user)',
  example: 'yaoi @vee',
  run: createNSFWRoleplayCommand('yaoi', 'did yaoi with')
};