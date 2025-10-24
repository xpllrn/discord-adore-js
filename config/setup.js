require('dotenv').config();

// Silent validation - store results for later display
const requiredEnvVars = [
  'BOT_TOKEN',
  'DEV_ID',
  'SERVER_ID',
  'GLOBAL_CONNECTION',
  'LOCAL_CONNECTION'
];

const recommendedEnvVars = [
  'CLIENT_ID',
  'ERROR_WEBHOOK_URL',
  'GUILD_WEBHOOK_URL',
  'PREMIUM_ROLE_ID',
  'DEV_ROLE_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
const missingRecommendedVars = recommendedEnvVars.filter(envVar => !process.env[envVar]);

// Export validation results for use in ready event
const validationResults = {
  missingRequired: missingEnvVars,
  missingRecommended: missingRecommendedVars,
  hasErrors: missingEnvVars.length > 0,
  hasWarnings: missingRecommendedVars.length > 0
};

module.exports = {
  // Environment validation results
  validation: validationResults,

  bot: {
    token: process.env.BOT_TOKEN,
    ownerId: process.env.DEV_ID,
    devServerId: process.env.SERVER_ID,
    clientId: process.env.CLIENT_ID,

    defaultPrefix: ',',
    supportServer: 'https://dsc.gg/s-invite',
    inviteLink: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1427958895250378762'}&permissions=8&integration_type=0&scope=bot+applications.commands`
  },

  database: {
    // Multi-tenant database setup - using GLOBAL_CONNECTION and LOCAL_CONNECTION
    globalConnection: process.env.GLOBAL_CONNECTION,
    localConnection: process.env.LOCAL_CONNECTION
  },



  apis: {
    lastfm: process.env.LASTFM_API_KEY,
    deepinfra: process.env.DEEP_API
  },

  logging: {
    errorWebhookUrl: process.env.ERROR_WEBHOOK_URL || null,
    guildWebhookUrl: process.env.GUILD_WEBHOOK_URL || null
  },

  // Permission system configuration
  permissions: {
    premiumRoleId: process.env.PREMIUM_ROLE_ID || null,
    devRoleId: process.env.DEV_ROLE_ID || null
  },

  // Colors Configuration
  colors: {
    cooldown: '#a5eb78',
    success: '#a4ec7c',
    error: '#fc6464',
    warn: '#fbd03b',
    info: '#e1d4da',
    embed: '#e1d4da'
  },

  // Emojis Configuration
  emojis: {
    cooldown: '<:cooldown:1431069309412839436>',
    success: '<:approve:1431069283840168107>',
    error: '<:deny:1431069291402236084>',
    warn: '<:warning:1431069300751335477>',
    left: '<:left:1431069325908770907>',
    right: '<:right:1431069334113091746>',
    cancel: '<:cancel:1431069317969215620>',
    choose: '<:skipto:1431069342346248275>',
    loading: '<a:loading:1431069298603855964>',

    lastfm: '<:lastfm:1431071057317593088>',
    join: '<:linked:1431407175367921788>',
    leave: '<:aired:1431407170225967145>',
    cross: '<:deny:1430425037004869682>',
    circle: '<:staff:1430425098657202258>',
    ticket: '🎫',

    // Voice Manager Emojis
    vmLock: '<:lock:1430503055752953887>',
    vmUnlock: '<:unlock:1430503064808198184>',
    vmHide: '<:ghost:1430503073565900961>',
    vmUnhide: '<:unghost:1430503081925279754>',
    vmIncrease: '<:increase:1430503123159482544>',
    vmDecrease: '<:decrease:1430503131346895001>',
    vmInfo: '<:info:1430503114879799356>',
    vmRename: '<:rename:1431402284386091121>',

    // Level Progress Bar Emojis
    blueLeftRounded: '<:blue_left_rounded:1430514041599819837>',
    blue: '<:blue:1430514035572342784>',
    blueRightRounded: '<:blue_right_rounded:1430514028924375051>',
    whiteLeftRounded: '<:white_left_rounded:1430514053620699198>',
    white: '<:white:1430514047853527091>',
    whiteRightRounded: '<:white_right_rounded:1430514060054630420>',

    // Custom Emojis
    google: '<:google:1431407479610277958>'

  },



};
