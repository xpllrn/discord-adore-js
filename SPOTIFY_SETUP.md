# Spotify Integration Setup Guide

## Overview

This guide will help you set up the Spotify integration for your Discord bot. The integration allows users to link their Spotify accounts and control playback through Discord commands.

## Prerequisites

- Spotify Developer Account
- Bot Website deployed at: `https://adore.vly.site/spotify/callback`
- Bot API accessible (for OAuth callbacks)

## Step 1: Create Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an App"
3. Fill in the details:
   - **App Name**: Adore Bot (or your bot name)
   - **App Description**: Discord bot with Spotify integration
   - **Redirect URI**: `https://adore.vly.site/spotify/callback`
4. Click "Create"
5. Note down your **Client ID** and **Client Secret**

## Step 2: Configure Redirect URI

1. In your Spotify app settings, click "Edit Settings"
2. Under "Redirect URIs", add:
   ```
   https://adore.vly.site/spotify/callback
   ```
3. Click "Add"
4. Click "Save"

## Step 3: Generate Encryption Keys

You need to generate two secure keys:

### Spotify Encryption Key (32 bytes)
```bash
openssl rand -hex 32
```
This will output something like: `a1b2c3d4e5f6...` (64 characters)

### Bot Website API Key (32 bytes)
```bash
openssl rand -hex 32
```
This will output another 64-character hex string.

## Step 4: Configure Environment Variables

Add these variables to your `.env` file:

```env
# Spotify Integration
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=https://adore.vly.site/spotify/callback
SPOTIFY_ENCRYPTION_KEY=output_from_openssl_rand_hex_32

# Bot API Configuration
BOT_API_PORT=3000
BOT_API_HOST=0.0.0.0
BOT_WEBSITE_API_KEY=output_from_openssl_rand_hex_32
```

### Important Notes:
- `SPOTIFY_ENCRYPTION_KEY` must be exactly 64 hex characters (32 bytes)
- `BOT_WEBSITE_API_KEY` is a shared secret between your bot and website
- Keep these keys secure and never commit them to version control

## Step 5: Configure Bot Website

Your website at `https://adore.vly.site` needs these environment variables:

```env
BOT_API_URL=https://your-bot-api-domain.com
BOT_API_KEY=same_as_BOT_WEBSITE_API_KEY_above
```

### Where to add these:
1. Go to your website hosting platform (Vercel/Netlify/etc.)
2. Navigate to Environment Variables or Settings
3. Add:
   - `BOT_API_URL`: The public URL where your bot's API is accessible
   - `BOT_API_KEY`: The same value as `BOT_WEBSITE_API_KEY` from Step 4

## Step 6: Expose Bot API

Your bot needs to be accessible from the internet for the website to send OAuth callbacks.

### Option A: Using ngrok (for testing)
```bash
ngrok http 3000
```
Then use the ngrok URL as your `BOT_API_URL` (e.g., `https://abc123.ngrok.io`)

### Option B: Deploy to a server
Deploy your bot to a server with a public IP or domain, then use that URL.

### Option C: Use Railway/Render/Heroku
These platforms automatically provide a public URL for your bot.

## Step 7: Test the Integration

1. Start your bot:
   ```bash
   npm start
   ```

2. Check that the API server started:
   ```
   ✅ Bot API server listening on 0.0.0.0:3000
   ```

3. In Discord, run:
   ```
   ,spotify link
   ```

4. Click the authorization link

5. Authorize on Spotify

6. You should be redirected to a success page

7. Check Discord for a DM confirming the link

8. Test playback:
   ```
   ,play never gonna give you up
   ```

## Troubleshooting

### "Invalid redirect URI" error
- Make sure the redirect URI in Spotify app settings exactly matches: `https://adore.vly.site/spotify/callback`
- No trailing slashes
- Must be HTTPS

### "Invalid API key" error
- Verify `BOT_WEBSITE_API_KEY` in bot `.env` matches `BOT_API_KEY` in website config
- Both should be the same 64-character hex string

### "Failed to create auth session" error
- Check that MongoDB is running and connected
- Verify the SpotifyAuthSession model is loaded

### "No active device" error
- User needs to open Spotify on a device (phone, computer, web player)
- The device must be active (playing or paused, not closed)

### "Premium required" error
- Spotify playback control requires Spotify Premium
- Free users can link accounts but cannot use playback commands

### Bot API not accessible
- Check firewall rules allow incoming connections on port 3000
- Verify `BOT_API_HOST` is set to `0.0.0.0` (not `localhost`)
- Test with: `curl http://your-bot-url:3000/health`

## Commands

### User Commands

- `,spotify link` - Link your Spotify account
- `,spotify unlink` - Unlink your Spotify account
- `,play <song name>` - Play a song by name
- `,play @user` - Play what another user is listening to

### Examples

```
,spotify link
,spotify unlink
,play never gonna give you up
,play bohemian rhapsody
,play @username
```

## Security Notes

1. **Never share your encryption keys** - They protect user tokens
2. **Rotate API keys periodically** - Update both bot and website simultaneously
3. **Use HTTPS** - Required by Spotify OAuth
4. **Monitor API logs** - Watch for suspicious activity
5. **Rate limiting** - The API has built-in rate limiting (10 req/min per IP)

## Architecture Overview

```
User → Discord Bot → Spotify API
         ↓              ↑
    Database      OAuth Flow
         ↓              ↑
    Bot Website ←→ Spotify OAuth
```

1. User runs `,spotify link` in Discord
2. Bot generates state token and OAuth URL
3. User clicks URL and authorizes on Spotify
4. Spotify redirects to Bot Website
5. Bot Website forwards auth code to Bot API
6. Bot exchanges code for tokens and stores them encrypted
7. User can now use playback commands

## Support

If you encounter issues:

1. Check bot logs for errors
2. Verify all environment variables are set correctly
3. Test the OAuth flow step by step
4. Check Spotify API status: https://developer.spotify.com/status

## Additional Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Authorization Guide](https://developer.spotify.com/documentation/general/guides/authorization-guide/)
- [Spotify Scopes Reference](https://developer.spotify.com/documentation/general/guides/scopes/)
