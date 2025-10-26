const express = require('express');
const { getService } = require('@services');

const app = express();
const PORT = process.env.BOT_API_PORT || 3000;
const HOST = process.env.BOT_API_HOST || '0.0.0.0';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Import routes
const spotifyRoutes = require('./routes/spotify');
app.use('/api/spotify', spotifyRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

let server = null;

/**
 * Start the API server
 * @returns {Promise<void>}
 */
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      server = app.listen(PORT, HOST, () => {
        console.log(`✅ Bot API server listening on ${HOST}:${PORT}`);
        resolve();
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use`);
        } else {
          console.error('❌ API server error:', error);
        }
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop the API server
 * @returns {Promise<void>}
 */
function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('✅ Bot API server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  app,
  startServer,
  stopServer
};
