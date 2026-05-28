const Queue = require('bull');
const { redisUrl } = require('../config/redis');

// Initialize background message processor queue
const messageQueue = new Queue('message-processing', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true
  }
});

module.exports = {
  messageQueue
};
