# GitHub Push Notifications (Simple Way)

No server needed! GitHub can send webhooks directly to Discord.

## Setup (2 minutes)

### 1. Get Discord Webhook URL

1. Go to your Discord channel
2. Edit Channel → Integrations → Webhooks → New Webhook
3. Name it "GitHub" (optional)
4. Copy the webhook URL

### 2. Add to GitHub

1. Go to your repo → Settings → Webhooks → Add webhook
2. Paste your Discord webhook URL + `/github` at the end
   - Example: `https://discord.com/api/webhooks/123456/abcdef/github`
3. Content type: `application/json`
4. Select "Just the push event"
5. Add webhook

### 3. Done!

That's it. Every push will now show in your Discord channel with:
- Author profile picture and name
- Repository and branch
- Commit message
- Files changed
- Link to compare

## Customize (Optional)

If you want custom formatting, you can:
1. Use GitHub Actions to format the message
2. Use a service like Zapier/IFTTT
3. Or keep it simple with Discord's default GitHub integration (which looks pretty good)

## Default Discord Format

Discord automatically formats GitHub webhooks nicely:
- Shows commit author with avatar
- Links to commits
- Shows file changes
- Includes commit messages
- All without any code!
