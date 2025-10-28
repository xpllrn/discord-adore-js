const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "threesome",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'threesome (user)',
  example: 'threesome @user',
  run: createNSFWRoleplayCommand('threesome_ffm', 'had a threesome with')
};