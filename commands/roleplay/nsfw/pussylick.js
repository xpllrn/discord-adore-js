const { createNSFWRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "pussylick",
  description: "`NSFW` pussylick roleplay command.",
  syntax: 'pussylick (user)',
  example: 'pussylick @vee',
  run: createNSFWRoleplayCommand('pussylick', 'licked')
};