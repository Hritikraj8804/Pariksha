const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info', // Log messages with level 'info' and above
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(), // Optional: Also log to console
    new winston.transports.File({ filename: path.join(__dirname, 'logs', 'access.log') }),
  ],
});

module.exports = logger;