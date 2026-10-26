const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const logger = require('./config/logger');
const swaggerSpec = require('./config/swagger');
const { globalLimiter } = require('./middlewares/rateLimit');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');

const app = express();

// Behind proxy (nginx) – needed for rate limit / cookies / IP
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());
app.use(globalLimiter);

if (!env.isTest) {
  app.use(
    morgan(env.isProd ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http ? logger.http(msg.trim()) : logger.info(msg.trim()) },
    })
  );
}

app.use('/uploads', express.static(path.resolve(process.cwd(), env.upload.dir)));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Numan Cables API',
    data: {
      docs: '/api/docs',
      health: '/api/v1/health',
      version: 'v1',
    },
    meta: null,
  });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/v1', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
