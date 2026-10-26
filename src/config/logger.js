const winston = require('winston');
const env = require('./env');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}]: ${stack || message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: env.isProd ? 'info' : 'debug',
  defaultMeta: { service: 'numan-cables-api' },
  transports: [
    new winston.transports.Console({
      format: env.isProd ? combine(timestamp(), errors({ stack: true }), json()) : consoleFormat,
      silent: env.isTest,
    }),
  ],
});

module.exports = logger;
