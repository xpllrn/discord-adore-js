require('dotenv').config();

// Silent validation - store results for later display
const requiredEnvVars = [
  'BOT_TOKEN',
  'DEV_ID',
  'SERVER_ID',
  'USER_DATABASE',
  'GUILD_DATABASE'
];

const recommendedEnvVars = [
  'CLIENT_ID',
  'ERROR_WEBHOOK_URL',
  'GUILD_WEBHOOK_URL',
  'PREMIUM_ROLE_ID'
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
    ownerId: process.env.DEV_ID?.split(',')[0], // Primary owner (first ID)
    ownerIds: process.env.DEV_ID?.split(',').map(id => id.trim()) || [], // All owner IDs
    devServerId: process.env.SERVER_ID,
    clientId: process.env.CLIENT_ID,

    defaultPrefix: ',',
    supportServer: 'https://dsc.gg/s-invite',
    inviteLink: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1427958895250378762'}&permissions=8&integration_type=0&scope=bot+applications.commands`
  },

  database: {
    // Database setup - using USER_DATABASE and GUILD_DATABASE
    userConnection: process.env.USER_DATABASE,
    guildConnection: process.env.GUILD_DATABASE
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
    premiumRoleId: process.env.PREMIUM_ROLE_ID || null
  },

  // Colors Configuration
  colors: {
    cooldown: '#a5cae9',
    success: '#51e395',
    error: '#f44336',
    warn: '#f29c1e',
    info: '#96968c',
    spotify: '#1DB954',
    embed: '#96968c',
  },

  // Emojis Configuration
  emojis: {
    cooldown: '<:cooldown:1441276341986005126>',
    success: '<:approve:1441260467514511461>',
    error: '<:error:1441260303559032933>',
    warn: '<:warning:1441260398681653381>',
    left: '<:left:1439540967215599768>',
    right: '<:right:1439540986299551775>',
    cancel: '<:cancel:1439546265733173299>',
    choose: '<:skipto:1439540990783258735>',
    loading: '<a:loading:1439560863618175057>',

    lastfm: '<:lastfm:1439540983971840112>',
    spotify: '<:spotify:1443252410414796884>',
    google: '<:google:1439546269847650345>',
    music: '<:music:1443893612239912991>',
    join: '<:linked:1431572346216513639>',
    leave: '<:aired:1431572306777604187>',
    cross: '<:deny:1430425037004869682>',
    circle: '<:staff:1430425098657202258>',
    ticket: '🎫',

    // Level Progress Bar Emojis
    blueLeftRounded: '<:blue_left_rounded:1439546259366215680>',
    blue: '<:blue:1439546263669440562>',
    blueRightRounded: '<:blue_right_rounded:1439546261517766747>',
    whiteLeftRounded: '<:white_left_rounded:1439546284414603274>',
    white: '<:white:1439546288562634944>',
    whiteRightRounded: '<:white_right_rounded:1439546286180405289>',

    // Voice Manager Emojis
    vmLock: '<:lock:1445338182127452311>',
    vmUnlock: '<:unlock:1445338201211404348>',
    vmHide: '<:hide:1445338180134899733>',
    vmUnhide: '<:unhide:1445338198917255350>',
    vmIncrease: '<:plus:1445338191329497120>',
    vmDecrease: '<:minus:1445338187269537904>',
    vmKick: '<:kick:1445338184752959561>',
    vmClaim: '<:claim:1445338178184679504>',
    vmTransfer: '<:transfer:1445338196027113545>',
    vmRename: '<:rename:1445338193711857767>',
    vmInfo: '<:info:1439540965655445606>',
    
    // Server Info Emojis
    nextline: '<:nextline:1445350467465908264>'
  },

  // Voice Manager Button Labels
  vmLabels: {
    lock: 'Lock',
    unlock: 'Unlock',
    hide: 'Hide',
    unhide: 'Unhide',
    kick: 'Kick',
    claim: 'Claim',
    transfer: 'Transfer',
    increase: 'Increase',
    decrease: 'Decrease',
    rename: 'Name'
  },

  // Voice Manager Button Descriptions
  vmDescriptions: {
    lock: '**`Lock`** the voice channel',
    unlock: '**`Unlock`** the voice channel',
    hide: '**`Hide`** the voice channel',
    unhide: '**`Unhide`** the voice channel',
    kick: '**`Kick`** a user from channel',
    claim: '**`Claim`** an abandoned channel',
    transfer: '**`Transfer`** ownership',
    increase: '**`Increase`** the user limit',
    decrease: '**`Decrease`** the user limit',
    rename: '**`Rename`** the voice channel'
  },

  // Continue with other emojis
  otherEmojis: {

    // Roblox Badge Emojis
    online: '<a:online:1441833868045979670>',
    robloxWelcomeToTheClub: '<:welcometothebuilderclub:1441832474970951850>',
    robloxWarrior: '<:warrior:1441832471720235089>',
    robloxVeteran: '<:veteran:1441832469161840721>',
    robloxPremium: '<:premium:1441832466519162980>',
    robloxInviter: '<:inviter:1441832463705051228>',
    robloxHomestead: '<:homestead:1441832461536592033>',
    robloxFriendship: '<:friendship:1441832459078602762>',
    robloxCombat: '<:combat:1441832456985514165>',
    robloxBricksmith: '<:bricksmith:1441832454750212146>',
    robloxBloxxer: '<:bloxxer:1441832452283961354>',

    // BlackTea Game Emojis
    blacktea: '<:empty:1442011316897321041>',
    wordtea: '<:wordtea:1442011593771716698>',
    gold: '<:Gold:1442013191331643444>',
    silver: '<:silver:1442013193537847478>',
    bronze: '<:bronze:1442013188580315158>',

    // Discord Badge Emojis
    staff: '<:discordstaff:1445269112174411837>',
    partner: '<:discordmod:1445269107355291738>',
    hypesquadEvents: '<:discordearlysupporter:1445269102443630744>',
    bughunterLevel1: '<:discordbughunter1:1445269096894828575>',
    bughunterLevel2: '<:discordbughunter2:1445269099083989092>',
    hypesquadBravery: '<:hypesquadbravery:1445269114276024381>',
    hypesquadBrilliance: '<:hypesquadbrilliance:1445269117278883910>',
    hypesquadBalance: '<:hypesquadbalance:1445270099199131658>',
    earlySupporter: '<:discordearlysupporter:1445269102443630744>',
    activeDeveloper: '<:activedeveloper:1445269070462193684>',
    verifiedBot: '<:premiumbot:1445268222403149975>',
    verifiedDeveloper: '<:discordbotdev:1445269094688620646>',
    nitro: '<:discordnitro:1445269109477478430>',
    boostLevel1: '<:discordboost1:1445269074530537594>',
    boostLevel2: '<:discordboost2:1445269076493730004>',
    boostLevel3: '<:discordboost3:1445269078905192621>',
    boostLevel4: '<:discordboost4:1445269081191219210>',
    boostLevel5: '<:discordboost5:1445269083363872849>',
    boostLevel6: '<:discordboost6:1445269085784117361>',
    boostLevel7: '<:discordboost7:1445269088116019270>',
    boostLevel8: '<:discordboost8:1445269090242662452>',
    boostLevel9: '<:discordboost9:1445269092360650824>',
    automod: '<:automod:1445269072588574851>',
    quest: '<:quest:1445268224911609997>',
    username: '<:username:1445268231282491554>',
    lootbox: '<:discordlootbox:1445269105031778435>',
    
    // Nitro Tier Badges
    bronzeNitro: '<:bronzenitro:1445268539564101795>',
    diamondNitro: '<:diamondnitro:1445268210399182898>',
    emeraldNitro: '<:emeraldnitro:1445268212269977701>',
    rubyNitro: '<:rubynitro:1445268227071672421>',
    platinumNitro: '<:platinumnitro:1445268220264190033>',
    opalNitro: '<:opalnitro:1445268217978163344>',
    goldNitro: '<:goldnitro:1445268214656532570>',
    
    // Server Badges
    crown: '<:Crown:1445270747668021278>'

  },



};
