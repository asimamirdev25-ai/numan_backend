const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Numan Cables API',
      version: '1.0.0',
      description:
        'Ecommerce + Admin Portal API for Numan Cables (Pakistan). Currency PKR. Timezone Asia/Karachi.',
      contact: { name: 'Numan Cables' },
    },
    servers: [{ url: `${env.appUrl}/api/v1`, description: 'API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {},
            meta: {},
          },
        },
        SignupRequest: {
          type: 'object',
          required: ['name', 'phone', 'shopName', 'password'],
          properties: {
            name: { type: 'string', example: 'Ali Khan' },
            phone: { type: 'string', example: '03001234567' },
            shopName: { type: 'string', example: 'Khan Electricals' },
            password: { type: 'string', example: 'secret1' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['phone', 'password'],
          properties: {
            phone: { type: 'string', example: '03001234567' },
            password: { type: 'string' },
            remember: { type: 'boolean', default: false },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
