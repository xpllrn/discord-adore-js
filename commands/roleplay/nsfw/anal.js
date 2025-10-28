const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "anal",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'anal (user)',
  example: 'anal @user',
  run: createNSFWRoleplayCommand('anal', 'did anal with')
};