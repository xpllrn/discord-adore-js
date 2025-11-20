#!/usr/bin/env node

/**
 * Migration Preview Script
 * 
 * This script shows what WOULD happen during migration without actually moving files.
 * Use this to verify the migration plan before running the actual migration.
 */

const fs = require('fs');
const path = require('path');

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Same migration map as migrate-commands.js
const migrationMap = {
  // CORE
  'commands/essentials/help.js': 'commands/core/help.js',
  'commands/essentials/ping.js': 'commands/core/ping.js',
  'commands/essentials/prefix.js': 'commands/core/prefix.js',
  'commands/service/botinfo.js': 'commands/core/botinfo.js',
  'commands/service/invite.js': 'commands/core/invite.js',
  
  // MODERATION
  'commands/purge/purge.js': 'commands/moderation/purge/purge.js',
  'commands/purge/cleanup.js': 'commands/moderation/purge/cleanup.js',
  
  // FUN/ECONOMY
  'commands/gamble/bal.js': 'commands/fun/economy/balance/bal.js',
  'commands/gamble/deposit.js': 'commands/fun/economy/balance/deposit.js',
  'commands/gamble/withdraw.js': 'commands/fun/economy/balance/withdraw.js',
  'commands/gamble/transfer.js': 'commands/fun/economy/balance/transfer.js',
  'commands/gamble/leaderboard.js': 'commands/fun/economy/balance/leaderboard.js',
  'commands/gamble/daily.js': 'commands/fun/economy/earning/daily.js',
  'commands/gamble/crime.js': 'commands/fun/economy/earning/crime.js',
  'commands/gamble/slut.js': 'commands/fun/economy/earning/slut.js',
  'commands/gamble/rob.js': 'commands/fun/economy/earning/rob.js',
  'commands/gamble/pray.js': 'commands/fun/economy/earning/pray.js',
  'commands/gamble/curse.js': 'commands/fun/economy/earning/curse.js',
  'commands/gamble/pick.js': 'commands/fun/economy/earning/pick.js',
  'commands/gamble/vote.js': 'commands/fun/economy/earning/vote.js',
  'commands/gamble/coinflip.js': 'commands/fun/economy/gambling/coinflip.js',
  'commands/gamble/slot.js': 'commands/fun/economy/gambling/slot.js',
  'commands/gamble/ttt.js': 'commands/fun/economy/gambling/ttt.js',
  'commands/gamble/store.js': 'commands/fun/economy/shop/store.js',
  'commands/gamble/buy.js': 'commands/fun/economy/shop/buy.js',
  'commands/gamble/sell.js': 'commands/fun/economy/shop/sell.js',
  'commands/gamble/use.js': 'commands/fun/economy/shop/use.js',
  'commands/gamble/inventory.js': 'commands/fun/economy/shop/inventory.js',
  'commands/gamble/store/_index.js': 'commands/fun/economy/shop/_index.js',
  'commands/gamble/store/items.js': 'commands/fun/economy/shop/items.js',
  'commands/gamble/marry.js': 'commands/fun/economy/marriage/marry.js',
  'commands/gamble/divorce.js': 'commands/fun/economy/marriage/divorce.js',
  'commands/gamble/married.js': 'commands/fun/economy/marriage/married.js',
  'commands/gamble/edaters.js': 'commands/fun/economy/marriage/edaters.js',
  'commands/fun/rps.js': 'commands/fun/games/rps.js',
  'commands/miscellaneous/8ball.js': 'commands/fun/games/8ball.js',
  'commands/miscellaneous/advice.js': 'commands/fun/random/advice.js',
  'commands/miscellaneous/yomama.js': 'commands/fun/random/yomama.js',
  'commands/miscellaneous/quote.js': 'commands/fun/random/quote.js',
  'commands/fun/blacktea.js': 'commands/fun/random/blacktea.js',
  'commands/miscellaneous/define.js': 'commands/fun/search/define.js',
  'commands/miscellaneous/urban.js': 'commands/fun/search/urban.js',
  'commands/miscellaneous/youtube.js': 'commands/fun/search/youtube.js',
  'commands/miscellaneous/img.js': 'commands/fun/search/img.js',
  
  // PROFILES
  'commands/server/profiles/avatar.js': 'commands/profiles/user/avatar.js',
  'commands/server/profiles/banner.js': 'commands/profiles/user/banner.js',
  'commands/server/profiles/savatar.js': 'commands/profiles/user/savatar.js',
  'commands/server/profiles/sbanner.js': 'commands/profiles/user/sbanner.js',
  'commands/information/userinfo.js': 'commands/profiles/user/userinfo.js',
  'commands/server/profiles/guildicon.js': 'commands/profiles/server/guildicon.js',
  'commands/server/profiles/guildbanner.js': 'commands/profiles/server/guildbanner.js',
  'commands/server/profiles/guildsplash.js': 'commands/profiles/server/guildsplash.js',
  'commands/server/theme/seticon.js': 'commands/profiles/server/seticon.js',
  'commands/server/theme/setbanner.js': 'commands/profiles/server/setbanner.js',
  'commands/server/theme/setsplash.js': 'commands/profiles/server/setsplash.js',
  'commands/utility/emoji.js': 'commands/profiles/expressions/emoji.js',
  'commands/utility/enlarge.js': 'commands/profiles/expressions/enlarge.js',
  'commands/utility/sticker.js': 'commands/profiles/expressions/sticker.js',
  'commands/server/steal/steal.js': 'commands/profiles/expressions/steal.js',
  'commands/server/steal/sticker.js': 'commands/profiles/expressions/stealsticker.js',
  
  // INFORMATION
  'commands/information/afk.js': 'commands/information/user/afk.js',
  'commands/information/birthday.js': 'commands/information/user/birthday.js',
  'commands/information/timezone.js': 'commands/information/user/timezone.js',
  'commands/information/names.js': 'commands/information/history/names.js',
  'commands/information/servernames.js': 'commands/information/history/servernames.js',
  'commands/information/guildnamehistory.js': 'commands/information/history/guildnamehistory.js',
  
  // SERVER
  'commands/server/autoroles/autorole.js': 'commands/server/roles/autorole.js',
  'commands/server/autoroles/buttonrole.js': 'commands/server/roles/buttonrole.js',
  'commands/server/autoroles/reactionrole.js': 'commands/server/roles/reactionrole.js',
  'commands/server/boostrole.js': 'commands/server/roles/boostrole.js',
  'commands/server/channel/lock.js': 'commands/server/channels/lock.js',
  'commands/server/channel/unlock.js': 'commands/server/channels/unlock.js',
  'commands/server/channel/hide.js': 'commands/server/channels/hide.js',
  'commands/server/channel/unhide.js': 'commands/server/channels/unhide.js',
  'commands/server/channel/pin.js': 'commands/server/channels/pin.js',
  'commands/server/channel/topic.js': 'commands/server/channels/topic.js',
  'commands/server/channel/firstmessage.js': 'commands/server/channels/firstmessage.js',
  'commands/server/channel/naughty.js': 'commands/server/channels/naughty.js',
  'commands/server/names/forcenick.js': 'commands/server/members/forcenick.js',
  'commands/server/names/rename.js': 'commands/server/members/rename.js',
  'commands/server/boost.js': 'commands/server/boost/boost.js',
  'commands/server/boostlost.js': 'commands/server/boost/boostlost.js',
  'commands/server/autoreact.js': 'commands/server/automation/autoreact.js',
  'commands/server/autoresponder.js': 'commands/server/automation/autoresponder.js',
  'commands/server/alias.js': 'commands/server/automation/alias.js',
  'commands/server/message.js': 'commands/server/automation/message.js',
  'commands/server/confession.js': 'commands/server/features/confession.js',
  'commands/server/ticket.js': 'commands/server/features/ticket.js',
  'commands/server/starboard.js': 'commands/server/features/starboard.js',
  'commands/server/voicemaster.js': 'commands/server/features/voicemaster.js',
  'commands/server/giveaways.js': 'commands/server/features/giveaways.js',
  'commands/server/vanity.js': 'commands/server/features/vanity.js',
  'commands/server/welcome.js': 'commands/server/events/welcome.js',
  'commands/server/leave.js': 'commands/server/events/leave.js',
  'commands/server/settings.js': 'commands/server/settings/settings.js',
  'commands/server/logs.js': 'commands/server/settings/logs.js',
  'commands/server/customize.js': 'commands/server/settings/customize.js',
  'commands/server/webhook.js': 'commands/server/settings/webhook.js',
  'commands/antinuke/antinuke.js': 'commands/server/antinuke/antinuke.js',
  
  // MUSIC
  'commands/spotify/spotify.js': 'commands/music/spotify/spotify.js',
  'commands/lastfm/fm.js': 'commands/music/lastfm/fm.js',
  
  // SOCIAL
  'commands/socials/tiktok.js': 'commands/social/tiktok.js',
  'commands/socials/valorant.js': 'commands/social/valorant.js',
  
  // UTILITY
  'commands/miscellaneous/say.js': 'commands/utility/messages/say.js',
  'commands/utility/responder.js': 'commands/utility/messages/responder.js',
  'commands/essentials/copyembed.js': 'commands/utility/embeds/copyembed.js',
  'commands/essentials/createembed.js': 'commands/utility/embeds/createembed.js',
  'commands/snipes/snipe.js': 'commands/utility/snipes/snipe.js',
  'commands/snipes/editsnipe.js': 'commands/utility/snipes/editsnipe.js',
  'commands/snipes/reactionsnipe.js': 'commands/utility/snipes/reactionsnipe.js',
  'commands/snipes/clearsnipe.js': 'commands/utility/snipes/clearsnipe.js',
  'commands/utility/translate.js': 'commands/utility/tools/translate.js',
  'commands/utility/remind.js': 'commands/utility/tools/remind.js',
  'commands/utility/count.js': 'commands/utility/tools/count.js',
  'commands/service/note.js': 'commands/utility/tools/note.js',
  'commands/service/swear.js': 'commands/utility/tools/swear.js',
  'commands/miscellaneous/sprint.js': 'commands/utility/misc/sprint.js',
  
  // PREMIUM
  'commands/premium/ask.js': 'commands/premium/ai/ask.js',
  'commands/premium/askvm.js': 'commands/premium/ai/askvm.js',
  'commands/premium/tts.js': 'commands/premium/voice/tts.js',
  
  // DEV
  'commands/dev/blacklist.js': 'commands/dev/admin/blacklist.js',
  'commands/dev/clear.js': 'commands/dev/admin/clear.js',
  'commands/dev/eco.js': 'commands/dev/admin/eco.js',
  'commands/dev/restart.js': 'commands/dev/admin/restart.js',
  'commands/dev/fetch.js': 'commands/dev/admin/fetch.js',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function groupByCategory(map) {
  const groups = {};
  
  for (const [oldPath, newPath] of Object.entries(map)) {
    const category = newPath.split('/')[1]; // Get first folder after commands/
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({ oldPath, newPath });
  }
  
  return groups;
}

function main() {
  log('='.repeat(80), 'bright');
  log('MIGRATION PREVIEW - DRY RUN', 'bright');
  log('='.repeat(80), 'bright');
  
  log('\n📋 This is a preview. No files will be moved.\n', 'cyan');
  
  const groups = groupByCategory(migrationMap);
  const categories = Object.keys(groups).sort();
  
  let totalFiles = 0;
  let existingFiles = 0;
  let missingFiles = 0;
  
  for (const category of categories) {
    const files = groups[category];
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    
    log(`\n${'='.repeat(80)}`, 'cyan');
    log(`📁 ${categoryName.toUpperCase()} (${files.length} files)`, 'bright');
    log('='.repeat(80), 'cyan');
    
    for (const { oldPath, newPath } of files) {
      totalFiles++;
      const exists = fs.existsSync(oldPath);
      
      if (exists) {
        existingFiles++;
        log(`✓ ${oldPath}`, 'green');
        log(`  → ${newPath}`, 'blue');
      } else {
        missingFiles++;
        log(`✗ ${oldPath} (NOT FOUND)`, 'red');
        log(`  → ${newPath}`, 'yellow');
      }
    }
  }
  
  // Summary
  log('\n' + '='.repeat(80), 'cyan');
  log('SUMMARY', 'bright');
  log('='.repeat(80), 'cyan');
  log(`\n📊 Total files to migrate: ${totalFiles}`, 'cyan');
  log(`✅ Files found: ${existingFiles}`, 'green');
  log(`❌ Files missing: ${missingFiles}`, missingFiles > 0 ? 'red' : 'green');
  
  if (missingFiles > 0) {
    log(`\n⚠️  Warning: ${missingFiles} files are missing!`, 'yellow');
    log('These files may have been moved or deleted already.', 'yellow');
  }
  
  log('\n💡 To run the actual migration:', 'cyan');
  log('   node migrate-commands.js', 'bright');
  
  log('\n' + '='.repeat(80), 'cyan');
}

main();
