// util/redisClient.js
const { createClient } = require('redis');
require('dotenv').config();

// Redis connection configuration
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: Too many reconnection attempts, giving up');
        return new Error('Too many retries');
      }
      return Math.min(retries * 100, 3000);
    },
  },
};

// Create Redis client
const redisClient = createClient(redisConfig);

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis client reconnecting...');
});

// Connect to Redis
let isConnected = false;

async function connectRedis() {
  if (!isConnected) {
    try {
      await redisClient.connect();
      isConnected = true;
      console.log('✅ Redis connection established');
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      // Don't exit - app can work without Redis (graceful degradation)
      isConnected = false;
    }
  }
  return isConnected;
}

// Graceful shutdown
async function disconnectRedis() {
  if (isConnected) {
    try {
      await redisClient.quit();
      isConnected = false;
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error.message);
    }
  }
}

module.exports = {
  redisClient,
  connectRedis,
  disconnectRedis,
  isRedisConnected: () => isConnected,
};

