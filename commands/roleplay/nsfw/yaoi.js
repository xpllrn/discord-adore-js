const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "yaoi",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'yaoi (user)',
  example: 'yaoi @user',
  run: createNSFWRoleplayCommand('yaoi', 'did yaoi with')
};