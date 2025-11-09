const BaseService = require('./core/BaseService');
const { DatabaseWriteError, ServiceError } = require('./core/errors');
const crypto = require('crypto');
const axios = require('axios');

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';
const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-private'
].join(' ');

/**
 * Spotify Service
 * Handles all Spotify-related operations including OAuth, token management, and API calls
 */
class SpotifyService extends BaseService {
  constructor() {
    super({
      modelName: 'User',
      keyField: 'UserID',
      database: 'global',
      ttl: 30 * 60 * 1000, // 30 minutes TTL
      maxSize: 5000
    });

    this.initialized = true;
  }

  // ===== OAUTH MANAGEMENT =====

  /**
   * Create an OAuth authentication session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} { stateToken, authUrl }
   */
  async createAuthSession(userId, guildId) {
    try {
      const stateToken = crypto.randomBytes(32).toString('hex');

      // Get or create user data
      let userData = await this.get(userId);
      if (!userData) {
        // Create minimal user data if doesn't exist
        const Model = this.getModel();
        await Model.updateOne(
          { UserID: userId },
          {
            $setOnInsert: {
              UserID: userId,
              SpotifyAuthSession: {
                stateToken,
                guildId,
                createdAt: new Date()
              }
            }
          },
          { upsert: true }
        );
      } else {
        // Update existing user with auth session
        userData.SpotifyAuthSession = {
          stateToken,
          guildId,
          createdAt: new Date()
        };
        await this.set(userId, userData);
      }

      // Build Spotify OAuth URL
      const authUrl = this.buildAuthUrl(stateToken);

      return { stateToken, authUrl };
    } catch (error) {
      throw new ServiceError('Failed to create auth session', error);
    }
  }

  /**
   * Build Spotify OAuth authorization URL
   * @param {string} stateToken - State token for CSRF protection
   * @returns {string} Authorization URL
   */
  buildAuthUrl(stateToken) {
    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      state: stateToken,
      scope: SPOTIFY_SCOPES,
      show_dialog: 'false'
    });

    return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
  }

  /**
   * Get an OAuth authentication session by state token
   * @param {string} stateToken - State token
   * @returns {Promise<Object|null>} Auth session or null
   */
  async getAuthSession(stateToken) {
    try {
      const Model = this.getModel();
      const user = await Model.findOne({
        'SpotifyAuthSession.stateToken': stateToken
      }).lean();

      if (!user || !user.SpotifyAuthSession) {
        return null;
      }

      // Return session with userId for compatibility
      return {
        stateToken: user.SpotifyAuthSession.stateToken,
        userId: user.UserID,
        guildId: user.SpotifyAuthSession.guildId,
        createdAt: user.SpotifyAuthSession.createdAt
      };
    } catch (error) {
      console.error('Error getting auth session:', error.message);
      return null;
    }
  }

  /**
   * Delete an OAuth authentication session
   * @param {string} userId - Discord user ID
   * @returns {Promise<void>}
   */
  async deleteAuthSession(userId) {
    try {
      const userData = await this.get(userId);
      if (userData && userData.SpotifyAuthSession) {
        userData.SpotifyAuthSession = {
          stateToken: null,
          guildId: null,
          createdAt: null
        };
        await this.set(userId, userData);
      }
    } catch (error) {
      console.error('Error deleting auth session:', error.message);
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   * @param {string} code - Authorization code from Spotify
   * @returns {Promise<Object>} { accessToken, refreshToken, expiresIn }
   */
  async exchangeCodeForTokens(code) {
    try {
      const response = await axios.post(
        `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(
              process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
            ).toString('base64')
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      if (error.response) {
        throw new ServiceError(`Spotify token exchange failed: ${error.response.data.error_description || error.response.data.error}`);
      }
      throw new ServiceError('Failed to exchange authorization code', error);
    }
  }

  // ===== TOKEN MANAGEMENT =====

  /**
   * Get valid access token for user (auto-refreshes if expired)
   * @param {string} userId - Discord user ID
   * @returns {Promise<string|null>} Access token or null if not linked
   */
  async getAccessToken(userId) {
    try {
      const userData = await this.get(userId);

      if (!userData || !userData.SpotifyAccessToken || !userData.SpotifyRefreshToken) {
        return null;
      }

      // Check if token is expired or expiring soon (within 5 minutes)
      const now = new Date();
      const expiry = new Date(userData.SpotifyTokenExpiry);
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiry <= fiveMinutesFromNow) {
        // Token expired or expiring soon, refresh it
        const newTokens = await this.refreshAccessToken(userData.SpotifyRefreshToken);

        // Store new tokens
        await this.storeTokens(
          userId,
          newTokens.accessToken,
          userData.SpotifyRefreshToken,
          newTokens.expiresIn
        );

        return newTokens.accessToken;
      }

      // Token is still valid, return it
      return userData.SpotifyAccessToken;
    } catch (error) {
      console.error('Error getting access token:', error.message);
      return null;
    }
  }

  /**
   * Refresh an expired access token
   * @param {string} refreshToken - Refresh token (decrypted)
   * @returns {Promise<Object>} { accessToken, expiresIn }
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(
        `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(
              process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
            ).toString('base64')
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      if (error.response) {
        throw new ServiceError(`Spotify token refresh failed: ${error.response.data.error_description || error.response.data.error}`);
      }
      throw new ServiceError('Failed to refresh access token', error);
    }
  }

  /**
   * Store Spotify tokens for a user
   * @param {string} userId - Discord user ID
   * @param {string} accessToken - Access token (plain text)
   * @param {string} refreshToken - Refresh token (plain text)
   * @param {number} expiresIn - Seconds until expiry
   * @returns {Promise<void>}
   */
  async storeTokens(userId, accessToken, refreshToken, expiresIn) {
    try {
      const expiry = new Date(Date.now() + expiresIn * 1000);

      // Get existing user data
      const userData = await this.get(userId);
      if (!userData) {
        throw new ServiceError('User data not found');
      }

      // Update with Spotify tokens
      userData.SpotifyAccessToken = accessToken;
      userData.SpotifyRefreshToken = refreshToken;
      userData.SpotifyTokenExpiry = expiry;
      userData.SpotifyLinkedAt = new Date();

      // Save updated data
      await this.set(userId, userData);
    } catch (error) {
      throw new ServiceError('Failed to store Spotify tokens', error);
    }
  }

  /**
   * Store Spotify user profile information
   * @param {string} userId - Discord user ID
   * @param {string} spotifyUserId - Spotify user ID
   * @returns {Promise<void>}
   */
  async storeSpotifyUserId(userId, spotifyUserId) {
    try {
      const userData = await this.get(userId);
      if (!userData) {
        throw new ServiceError('User data not found');
      }

      userData.SpotifyUserId = spotifyUserId;
      await this.set(userId, userData);
    } catch (error) {
      throw new ServiceError('Failed to store Spotify user ID', error);
    }
  }

  /**
   * Revoke Spotify tokens for a user (unlink account)
   * @param {string} userId - Discord user ID
   * @returns {Promise<void>}
   */
  async revokeTokens(userId) {
    try {
      const userData = await this.get(userId);
      if (!userData) {
        throw new ServiceError('User data not found');
      }

      userData.SpotifyAccessToken = null;
      userData.SpotifyRefreshToken = null;
      userData.SpotifyTokenExpiry = null;
      userData.SpotifyUserId = null;
      userData.SpotifyLinkedAt = null;

      await this.set(userId, userData);
    } catch (error) {
      throw new ServiceError('Failed to revoke Spotify tokens', error);
    }
  }

  /**
   * Check if user has linked Spotify account
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if linked
   */
  async isLinked(userId) {
    try {
      const userData = await this.get(userId);
      return !!(userData && userData.SpotifyAccessToken && userData.SpotifyRefreshToken);
    } catch (error) {
      return false;
    }
  }

  // ===== SPOTIFY API INTERACTIONS =====

  /**
   * Get client credentials access token for app-only requests
   * @returns {Promise<string>} Access token
   */
  async getClientCredentialsToken() {
    try {
      const response = await axios.post(
        `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
        new URLSearchParams({
          grant_type: 'client_credentials'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(
              process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
            ).toString('base64')
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('[Spotify] Client credentials error:', error.response?.data || error.message);
      throw new ServiceError('Failed to get Spotify client credentials token');
    }
  }

  /**
   * Search for tracks on Spotify
   * @param {string} query - Search query
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Array>} Array of track objects
   */
  async searchTrack(query, accessToken) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/search`, {
        params: {
          q: query,
          type: 'track',
          limit: 5
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.tracks.items;
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Get user's currently playing track
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Object|null>} Currently playing track or null
   */
  async getCurrentlyPlaying(accessToken) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.status === 204 || !response.data) {
        return null; // Nothing playing
      }

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 204) {
        return null;
      }
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Start playback of a track
   * @param {string} trackUri - Spotify track URI (spotify:track:xxx)
   * @param {string} accessToken - Valid access token
   * @returns {Promise<void>}
   */
  async startPlayback(trackUri, accessToken) {
    try {
      await axios.put(
        `${SPOTIFY_API_BASE}/me/player/play`,
        {
          uris: [trackUri]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Pause playback
   * @param {string} accessToken - Valid access token
   * @returns {Promise<void>}
   */
  async pausePlayback(accessToken) {
    try {
      await axios.put(
        `${SPOTIFY_API_BASE}/me/player/pause`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Skip to next track
   * @param {string} accessToken - Valid access token
   * @returns {Promise<void>}
   */
  async skipToNext(accessToken) {
    try {
      await axios.post(
        `${SPOTIFY_API_BASE}/me/player/next`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Skip to previous track
   * @param {string} accessToken - Valid access token
   * @returns {Promise<void>}
   */
  async skipToPrevious(accessToken) {
    try {
      await axios.post(
        `${SPOTIFY_API_BASE}/me/player/previous`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Set playback volume
   * @param {number} volumePercent - Volume percentage (0-100)
   * @param {string} accessToken - Valid access token
   * @returns {Promise<void>}
   */
  async setVolume(volumePercent, accessToken) {
    try {
      await axios.put(
        `${SPOTIFY_API_BASE}/me/player/volume?volume_percent=${volumePercent}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Set repeat mode
   * @param {string} state - 'track', 'context', or 'off'
   * @param {string} accessToken - Valid access token
   * @returns {Promise<void>}
   */
  async setRepeatMode(state, accessToken) {
    try {
      await axios.put(
        `${SPOTIFY_API_BASE}/me/player/repeat?state=${state}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Set shuffle mode
   * @param {boolean} state - true or false
   * @param {string} accessToken - Valid access token
   * @returns {Promise<void>}
   */
  async setShuffleMode(state, accessToken) {
    try {
      await axios.put(
        `${SPOTIFY_API_BASE}/me/player/shuffle?state=${state}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Get user's active devices
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Array>} Array of device objects
   */
  async getActiveDevices(accessToken) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/devices`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.devices || [];
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  /**
   * Get Spotify user profile
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(accessToken) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      this.handleSpotifyApiError(error);
    }
  }

  // ===== ERROR HANDLING =====

  /**
   * Handle Spotify API errors
   * @param {Error} error - Axios error
   * @throws {ServiceError} Formatted error
   */
  handleSpotifyApiError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          throw new ServiceError('TOKEN_EXPIRED', 'Spotify token expired or invalid');
        case 403:
          if (data.error && data.error.reason === 'PREMIUM_REQUIRED') {
            throw new ServiceError('PREMIUM_REQUIRED', 'Spotify Premium is required for this feature');
          }
          throw new ServiceError('PLAYBACK_ERROR', 'Failed to control playback');
        case 404:
          if (error.config.url.includes('/player')) {
            throw new ServiceError('NO_ACTIVE_DEVICE', 'No active Spotify device found');
          }
          throw new ServiceError('NOT_FOUND', 'Resource not found');
        case 429:
          throw new ServiceError('RATE_LIMIT', 'Too many requests to Spotify API');
        default:
          throw new ServiceError('SPOTIFY_API_ERROR', `Spotify API error: ${status}`);
      }
    }

    throw new ServiceError('NETWORK_ERROR', 'Failed to connect to Spotify API', error);
  }

  // ===== BASE SERVICE IMPLEMENTATION =====

  async writeToDatabase(key, data) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };
      const updateData = { ...data };
      delete updateData._id;
      await Model.updateOne(query, { $set: updateData }, { upsert: true });
    } catch (error) {
      throw new DatabaseWriteError(`Failed to write Spotify data for ${key}`, error);
    }
  }

  async readFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };
      const doc = await Model.findOne(query).lean();
      return doc || null;
    } catch (error) {
      console.error(`Error reading Spotify data for ${key}:`, error.message);
      return null;
    }
  }

  async deleteFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };
      await Model.deleteOne(query);
    } catch (error) {
      throw new DatabaseWriteError(`Failed to delete Spotify data for ${key}`, error);
    }
  }
}

module.exports = SpotifyService;
