const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB } = require('./config/db');
const app = require('./app');

process.env.TZ = env.tz;

const start = async () => {
  try {
    await connectDB();
    const server = app.listen(env.port, () => {
      logger.info(`Numan Cables API listening on port ${env.port} (${env.nodeEnv})`);
      logger.info(`Docs: ${env.appUrl}/api/docs`);
      logger.info(`Timezone: ${env.tz}`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received, shutting down...`);
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server', { message: err.message, stack: err.stack });
    process.exit(1);
  }
};

start();
