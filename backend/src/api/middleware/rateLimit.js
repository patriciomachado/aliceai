const rateLimit = require('express-rate-limit');

const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // max 100 requests per IP address
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests, please attempt again after 1 minute.'
  }
});

module.exports = {
  apiRateLimiter
};
