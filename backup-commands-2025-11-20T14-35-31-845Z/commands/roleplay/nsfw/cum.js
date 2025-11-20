const { createNSFWRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "cum",
  description: "`NSFW` cum roleplay command.",
  syntax: 'cum (user)',
  example: 'cum @vee',
  run: createNSFWRoleplayCommand('cum', 'came with')
};