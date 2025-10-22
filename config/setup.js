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
  'DEV_ROLE_ID',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'LAVALINK_HOST',
  'LAVALINK_PORT',
  'LAVALINK_PASSWORD',
  'LAVALINK_SECURE'
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

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
  },

  lavalink: {
    host: process.env.LAVALINK_HOST,
    port: process.env.LAVALINK_PORT,
    password: process.env.LAVALINK_PASSWORD,
    secure: process.env.LAVALINK_SECURE
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
    cooldown: '<:warning:1430425136351416421>',
    success: '<:approve:1430425024006848534>',
    error: '<:deny:1430425037004869682>',
    warn: '<:warning:1430425136351416421>',
    left: '<:left:1430425122166280304>',
    right: '<:right:1430425080638345317>',
    cancel: '<:cancel:1379296264008634486>',
    choose: '<:p_discrim:1430425048828739626>',
    loading: '<:aired:1430425030218481696>',
    lastfm: '<:p_lastfm:1430425060904009771>',
    join: '<:online:1430425074850332722>',
    leave: '<:offline:1430425068957073408>',
    cross: '<:deny:1430425037004869682>',
    circle: '<:staff:1430425098657202258>',
    ticket: '🎫',

    // Voice Manager Emojis
    vmLock: '<:lock:1386222503999049838>',
    vmUnlock: '<:unlock:1386222513490624512>',
    vmHide: '<:hide:1386222497283833876>',
    vmUnhide: '<:unhide:1386222511167115334>',
    vmRename: '<:rename:1386222506322563073>',
    vmClaim: '<:crown:1386222492280029305>',
    vmIncrease: '<:increase:1386222499544563826>',
    vmDecrease: '<:decrease:1386222494729371709>',
    vmDelete: '<:trash:1386222508948062310>',
    vmInfo: '<:infomation:1386222501498978456>',

    // Level Progress Bar Emojis
    blueLeftRounded: '<:blue_left_rounded:1386722842002985082>',
    blue: '<:blue:1386722849007468544>',
    blueRightRounded: '<:blue_right_rounded:1386722855038750892>',
    whiteLeftRounded: '<:white_left_rounded:1386722861833650388>',
    white: '<:white:1386722868062060598>',
    whiteRightRounded: '<:white_right_rounded:1386722874554847293>',

    // Custom Emojis
    naaILovedick: '<:0069_heh:1428025640598372573>',
    google: '<:CodeXPray:1428026399049908246>'

  },



};
