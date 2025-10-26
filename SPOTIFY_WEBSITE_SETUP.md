# Spotify Website Setup Guide

## Overview

Your Spotify OAuth flow now works like this:

1. User runs `,spotify` command in Discord
2. Bot generates auth URL with state token
3. User clicks link → Goes to Spotify OAuth
4. Spotify redirects to `https://adore.vly.site/spotify/callback`
5. Website receives code/state and forwards to bot API
6. Bot exchanges code for tokens and stores them
7. User gets success message in Discord

## Files Created

### 1. `/api/public/spotify/callback.html`
- Receives OAuth callback from Spotify
- Extracts `code` and `state` from URL
- Sends POST request to `/api/spotify/callback` with API key
- Shows success/error message to user

### 2. `/api/public/index.html`
- Simple landing page for your domain
- Shows bot is online

## Server Configuration

The Express server now serves static files from `/api/public/`:
- `https://adore.vly.site/` → `index.html`
- `https://adore.vly.site/spotify/callback` → `spotify/callback.html`

## Spotify Dashboard Settings

Your current settings are correct:
- **Redirect URI**: `https://adore.vly.site/spotify/callback` ✅
- **Client ID**: `4125dd3cd6a1458d92c7ab4aacca9722` ✅
- **Client Secret**: Set in `.env` ✅

## Testing

1. Restart your bot to load the new static file serving
2. Run `,spotify` command in Discord
3. Click the authorization link
4. You should see the callback page with a loading spinner
5. After a moment, you'll see either:
   - ✅ Success message (account linked)
   - ❌ Error message (with details)

## Troubleshooting

### "Connection Failed" Error
- Check that your bot API is running on port 3000
- Verify the API key in `callback.html` matches `BOT_WEBSITE_API_KEY` in `.env`
- Check bot logs for errors

### "Invalid or expired state token"
- State tokens expire after 10 minutes
- User needs to generate a new link with `,spotify`

### "Network error"
- Check that `https://adore.vly.site` is accessible
- Verify your reverse proxy/nginx is forwarding to port 3000
- Check firewall settings

## Security Notes

- The API key is embedded in the HTML (client-side)
- This is acceptable because:
  - The callback endpoint is rate-limited
  - The state token is single-use and expires
  - The API key only works for this specific endpoint
- For production, consider using a backend proxy instead

## Next Steps

1. Restart your bot
2. Test the OAuth flow
3. If it works, you're all set!
4. If not, check the troubleshooting section above
