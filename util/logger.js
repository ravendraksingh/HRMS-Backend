// util/logger.js
// Pino logger configuration for development environment

const pino = require('pino');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create logger instance
// In development, use pino-pretty for readable output
// In production, use standard JSON output
const logger = pino({
  level: process.env.LOG_LEVEL || (NODE_ENV === 'development' ? 'debug' : 'info'),
  transport: NODE_ENV === 'development' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
        }
      }
    : undefined, // Production uses default JSON output
});

module.exports = logger;

