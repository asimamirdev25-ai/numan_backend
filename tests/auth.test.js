const request = require('supertest');
const app = require('../src/app');
const { User, Settings } = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');

describe('Auth API', () => {
  beforeEach(async () => {
    await Settings.create({
      key: 'shop',
      requireApproval: true,
      shopName: 'Numan Cables',
    });
  });

  describe('POST /api/v1/auth/signup', () => {
    it('creates a pending customer and returns tokens + WhatsApp verify', async () => {
      const res = await request(app).post('/api/v1/auth/signup').send({
        name: 'Ali Khan',
        phone: '03001234567',
        shopName: 'Khan Electricals',
        password: 'secret1',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.phone).toBe('+923001234567');
      expect(res.body.data.user.status).toBe(USER_STATUS.PENDING);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.verification.whatsappUrl).toContain('wa.me');
      expect(res.body.data.verification.code).toHaveLength(6);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects duplicate phone', async () => {
      await request(app).post('/api/v1/auth/signup').send({
        name: 'Ali',
        phone: '03001112233',
        shopName: 'Shop A',
        password: 'secret1',
      });

      const res = await request(app).post('/api/v1/auth/signup').send({
        name: 'Ali 2',
        phone: '0300-1112233',
        shopName: 'Shop B',
        password: 'secret1',
      });

      expect(res.status).toBe(409);
    });

    it('rejects short password', async () => {
      const res = await request(app).post('/api/v1/auth/signup').send({
        name: 'Ali',
        phone: '03009998877',
        shopName: 'Shop',
        password: '123',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await User.hashPassword('secret1');
      await User.create({
        name: 'Active User',
        shopName: 'Active Shop',
        phone: '+923008887766',
        passwordHash,
        role: ROLES.CUSTOMER,
        status: USER_STATUS.ACTIVE,
      });
    });

    it('logs in with phone + password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        phone: '03008887766',
        password: 'secret1',
        remember: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.shopName).toBe('Active Shop');
    });

    it('rejects wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        phone: '03008887766',
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Admin approval flow', () => {
    let adminToken;
    let customerId;

    beforeEach(async () => {
      const passwordHash = await User.hashPassword('Admin@12345');
      await User.create({
        name: 'Admin',
        shopName: 'Numan Cables',
        phone: '+923001111111',
        passwordHash,
        role: ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
      });

      const login = await request(app).post('/api/v1/auth/login').send({
        phone: '03001111111',
        password: 'Admin@12345',
      });
      adminToken = login.body.data.accessToken;

      const signup = await request(app).post('/api/v1/auth/signup').send({
        name: 'Pending User',
        phone: '03002223344',
        shopName: 'Pending Shop',
        password: 'secret1',
      });
      customerId = signup.body.data.user.id;
    });

    it('lists pending customers with verification code', async () => {
      const res = await request(app)
        .get('/api/v1/auth/admin/customers/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].verificationCode).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('approves a pending customer', async () => {
      const res = await request(app)
        .post(`/api/v1/auth/admin/customers/${customerId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.status).toBe(USER_STATUS.ACTIVE);

      const count = await request(app)
        .get('/api/v1/auth/admin/customers/pending/count')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(count.body.data.count).toBe(0);
    });

    it('admin creates customer as active with temp password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Retail Shop',
          shopName: 'Retail Shop',
          phone: '03005556677',
          city: 'Lahore',
          openingBalance: 5000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.status).toBe(USER_STATUS.ACTIVE);
      expect(res.body.data.user.mustChangePassword).toBe(true);
      expect(res.body.data.temporaryPassword).toBeDefined();
    });
  });

  describe('Token refresh & logout', () => {
    it('refreshes access token from cookie', async () => {
      const signup = await request(app).post('/api/v1/auth/signup').send({
        name: 'Refresh User',
        phone: '03003334455',
        shopName: 'Refresh Shop',
        password: 'secret1',
      });

      const cookies = signup.headers['set-cookie'];
      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(refresh.status).toBe(200);
      expect(refresh.body.data.accessToken).toBeDefined();
    });
  });

  describe('OTP (disabled by default)', () => {
    it('returns error when OTP_ENABLED=false', async () => {
      const res = await request(app).post('/api/v1/auth/otp/send').send({
        phone: '03001234567',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/disabled/i);
    });
  });
});
