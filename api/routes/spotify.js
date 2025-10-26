const express = require('express');
const router = express.Router();
const { getService } = require('@services');

// Rate limiting map (simple in-memory rate limiting)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Simple rate limiting middleware
 */
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    });
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  
  next();
}

/**
 * API key authentication middleware
 */
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key'
    });
  }
  
  if (apiKey !== process.env.BOT_WEBSITE_API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  next();
}

/**
 * POST /api/spotify/callback
 * Receives OAuth callback from Bot Website
 */
router.post('/callback', rateLimiter, authenticateApiKey, async (req, res) => {
  try {
    const { code, state } = req.body;
    
    // Validate request body
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Missing code or state parameter'
      });
    }
    
    console.log(`[Spotify OAuth] Received callback with state: ${state}`);
    
    const spotifyService = getService('spotify');
    
    // Get auth session
    const authSession = await spotifyService.getAuthSession(state);
    
    if (!authSession) {
      console.log(`[Spotify OAuth] Invalid or expired state token: ${state}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired state token'
      });
    }
    
    console.log(`[Spotify OAuth] Valid auth session found for user: ${authSession.userId}`);
    
    try {
      // Exchange authorization code for tokens
      const tokens = await spotifyService.exchangeCodeForTokens(code);
      console.log(`[Spotify OAuth] Successfully exchanged code for tokens`);
      
      // Store tokens
      await spotifyService.storeTokens(
        authSession.userId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresIn
      );
      console.log(`[Spotify OAuth] Tokens stored for user: ${authSession.userId}`);
      
      // Get Spotify user profile and store ID
      const profile = await spotifyService.getUserProfile(tokens.accessToken);
      await spotifyService.storeSpotifyUserId(authSession.userId, profile.id);
      console.log(`[Spotify OAuth] Spotify user ID stored: ${profile.id}`);
      
      // Delete auth session
      await spotifyService.deleteAuthSession(state);
      console.log(`[Spotify OAuth] Auth session deleted`);
      
      // Notify user in Discord (via client)
      try {
        const client = global.discordClient;
        if (client) {
          const user = await client.users.fetch(authSession.userId);
          if (user) {
            await user.send({
              embeds: [{
                color: 0x1DB954, // Spotify green
                title: '✅ Spotify Linked Successfully',
                description: `Your Spotify account **${profile.display_name || profile.id}** has been linked!\n\nYou can now use Spotify commands like \`,play\``,
                timestamp: new Date(),
                footer: {
                  text: 'Spotify Integration'
                }
              }]
            }).catch(err => {
              console.log(`[Spotify OAuth] Could not DM user: ${err.message}`);
            });
          }
        }
      } catch (error) {
        console.error('[Spotify OAuth] Error notifying user:', error.message);
      }
      
      return res.json({
        success: true,
        userId: authSession.userId
      });
      
    } catch (error) {
      console.error('[Spotify OAuth] Token exchange failed:', error.message);
      
      // Delete auth session on failure
      await spotifyService.deleteAuthSession(state);
      
      return res.status(400).json({
        success: false,
        error: error.message || 'Token exchange failed'
      });
    }
    
  } catch (error) {
    console.error('[Spotify OAuth] Callback error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
