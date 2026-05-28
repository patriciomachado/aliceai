const redis = require('redis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = redis.createClient({
  url: redisUrl
});

let redisErrorLogged = false;
redisClient.on('error', (err) => {
  if (!redisErrorLogged) {
    console.error('Redis Client Error (suppressed subsequent logs to prevent flooding):', err.message || err);
    redisErrorLogged = true;
  }
});
redisClient.on('connect', () => {
  console.log('Redis connected successfully');
  redisErrorLogged = false;
});

// Connect asynchronously in backend lifecycle
if (process.env.NODE_ENV !== 'test') {
  redisClient.connect().catch(err => console.error('Could not connect to Redis:', err));
}

module.exports = {
  redisClient,
  redisUrl
};
