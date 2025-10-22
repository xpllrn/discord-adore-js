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
    supportServer: 'https://discord.gg/QT2gZv264Q',
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
    cooldown: '<:cooldown:1430501194375233657>',
    success: '<:approve:1430425024006848534>',
    error: '<:deny:1430425037004869682>',
    warn: '<:warning:1430425136351416421>',
    left: '<:left:1430425122166280304>',
    right: '<:right:1430425080638345317>',
    cancel: '<:cancel:1430500787481743494>',
    choose: '<:skipto:1430425092340322427>',
    loading: '<a:loading:1430501187748368574>',
    lastfm: '<:p_lastfm:1430425060904009771>',
    join: '<:online:1430425074850332722>',
    leave: '<:offline:1430425068957073408>',
    cross: '<:deny:1430425037004869682>',
    circle: '<:staff:1430425098657202258>',
    ticket: '🎫',

    // Voice Manager Emojis
    vmLock: '<:lock~1:1430503055752953887>',
    vmUnlock: '<:unlock~1:1430503064808198184>',
    vmHide: '<:ghost~1:1430503073565900961>',
    vmUnhide: '<:unghost:1430503081925279754>',
    vmClaim: '<:claim:1430503090028675113>',
    vmDisconnect: '<:disconnect:1430503098043859086>',
    vmActivity: '<:activity:1430503106440990740>',
    vmInfo: '<:info:1430503114879799356>',
    vmIncrease: '<:increase:1430503123159482544>',
    vmDecrease: '<:decrease:1430503131346895001>',

    // Level Progress Bar Emojis
    blueLeftRounded: '<:blue_left_rounded:1430514041599819837>',
    blue: '<:blue:1430514035572342784>',
    blueRightRounded: '<:blue_right_rounded:1430514028924375051>',
    whiteLeftRounded: '<:white_left_rounded:1430514053620699198>',
    white: '<:white:1430514047853527091>',
    whiteRightRounded: '<:white_right_rounded:1430514060054630420>',

    // Custom Emojis
    naaILovedick: '<:0069_heh:1428025640598372573>',
    google: '<:CodeXPray:1428026399049908246>'

  },



};
