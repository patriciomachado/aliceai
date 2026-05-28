const cors = require('cors');
require('dotenv').config();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3001',
  'http://localhost:3000',
  'https://app.alice.ai',
  'https://alice.ai'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or locally-triggered testing calls
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS guidelines'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Workspace-Id']
};

module.exports = cors(corsOptions);
