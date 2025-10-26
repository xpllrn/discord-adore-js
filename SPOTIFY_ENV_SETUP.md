# Quick Environment Setup for Spotify Integration

## What You Need to Configure

### 1. Generate Your Keys

Run these commands to generate secure keys:

```bash
# Generate Spotify Encryption Key
openssl rand -hex 32

# Generate Bot Website API Key  
openssl rand -hex 32
```

Save both outputs - you'll need them in the next steps.

### 2. Bot Environment Variables (.env file)

Add these to your `adore_bot/.env` file:

```env
# Spotify API Credentials (from Spotify Developer Dashboard)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=https://adore.vly.site/spotify/callback

# Security Keys (generated above)
SPOTIFY_ENCRYPTION_KEY=paste_first_openssl_output_here
BOT_WEBSITE_API_KEY=paste_second_openssl_output_here

# Bot API Configuration
BOT_API_PORT=3000
BOT_API_HOST=0.0.0.0
```

### 3. Website Environment Variables

Your website at `https://adore.vly.site` needs these variables:

**Variable Name:** `BOT_API_URL`  
**Value:** Your bot's public API URL (e.g., `https://your-bot-domain.com` or ngrok URL)

**Variable Name:** `BOT_API_KEY`  
**Value:** Same value as `BOT_WEBSITE_API_KEY` from step 2

### 4. Spotify Developer Dashboard

1. Go to: https://developer.spotify.com/dashboard
2. Create a new app (or use existing)
3. Add Redirect URI: `https://adore.vly.site/spotify/callback`
4. Copy your Client ID and Client Secret to step 2 above

## Testing Checklist

- [ ] Bot starts without errors
- [ ] API server shows: `✅ Bot API server listening on 0.0.0.0:3000`
- [ ] Website has `BOT_API_URL` and `BOT_API_KEY` configured
- [ ] Spotify app has redirect URI configured
- [ ] Run `,spotify link` in Discord
- [ ] Click authorization link
- [ ] Authorize on Spotify
- [ ] Receive success message
- [ ] Run `,play test song` to verify playback

## Quick Test

```bash
# Test bot API is accessible
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}
```

## Common Issues

**"Invalid redirect URI"**
→ Check Spotify app settings, must be exactly: `https://adore.vly.site/spotify/callback`

**"Invalid API key"**
→ Verify `BOT_WEBSITE_API_KEY` (bot) matches `BOT_API_KEY` (website)

**"No active device"**
→ User must open Spotify on a device first

**"Premium required"**
→ Playback control requires Spotify Premium subscription

## Need Help?

See `SPOTIFY_SETUP.md` for detailed setup instructions and troubleshooting.
