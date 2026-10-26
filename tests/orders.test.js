const request = require('supertest');
const app = require('../src/app');
const {
  User,
  Category,
  Product,
  Settings,
  Order,
  LedgerEntry,
} = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');

describe('Orders / Payments / Ledger', () => {
  let adminToken;
  let customerToken;
  let customerId;
  let product;
  let adminId;

  beforeEach(async () => {
    await Settings.create({
      key: 'shop',
      requireApproval: false,
      taxPercent: 0,
      deliveryCharges: 0,
      paymentInstructions: { jazzcash: '03001234567' },
    });

    const adminHash = await User.hashPassword('Admin@12345');
    const admin = await User.create({
      name: 'Admin',
      shopName: 'Numan Cables',
      phone: '+923001111111',
      passwordHash: adminHash,
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    adminId = admin._id;

    const custHash = await User.hashPassword('secret1');
    const customer = await User.create({
      name: 'Shop Owner',
      shopName: 'City Electrical',
      phone: '+923002222222',
      passwordHash: custHash,
      role: ROLES.CUSTOMER,
      status: USER_STATUS.ACTIVE,
      openingBalance: 0,
    });
    customerId = customer._id;

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      phone: '03001111111',
      password: 'Admin@12345',
    });
    adminToken = adminLogin.body.data.accessToken;

    const custLogin = await request(app).post('/api/v1/auth/login').send({
      phone: '03002222222',
      password: 'secret1',
    });
    customerToken = custLogin.body.data.accessToken;

    const category = await Category.create({
      name: 'Electric Cable',
      slug: 'electric-cable',
      isActive: true,
    });

    product = await Product.create({
      name: 'Test Twin Earth 2.5',
      slug: 'test-twin-earth-25',
      sku: 'NC-TEST-25',
      category: category._id,
      price: 10000,
      unit: 'coil',
      stockQuantity: 50,
      lowStockThreshold: 5,
      minOrderQty: 1,
      isActive: true,
      createdBy: adminId,
    });
  });

  it('creates order, deducts stock, and posts ledger debit', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: product._id.toString(), quantity: 2 }],
        shippingAddress: { city: 'Lahore', line1: 'Hall Road' },
        customerNote: 'Please call before delivery',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.order.orderNumber).toMatch(/^NC-\d{4}-\d{6}$/);
    expect(res.body.data.order.total).toBe(20000);
    expect(res.body.data.order.status).toBe('pending');
    expect(res.body.data.order.paymentStatus).toBe('awaiting_payment');
    expect(res.body.data.paymentInstructions).toBeDefined();

    const refreshed = await Product.findById(product._id);
    expect(refreshed.stockQuantity).toBe(48);

    const ledger = await request(app)
      .get('/api/v1/ledger/mine')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(ledger.status).toBe(200);
    expect(ledger.body.meta.summary.currentBalance).toBe(20000);
  });

  it('records partial then full payment and updates paymentStatus', async () => {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: product._id.toString(), quantity: 1 }],
      });
    const orderId = orderRes.body.data.order._id;

    const partial = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customerId.toString(),
        orderId,
        amount: 4000,
        method: 'jazzcash',
        reference: 'JC-111',
      });

    expect(partial.status).toBe(201);
    expect(partial.body.data.receiptNumber).toMatch(/^RC-\d{4}-\d{6}$/);

    let order = await Order.findById(orderId);
    expect(order.amountPaid).toBe(4000);
    expect(order.paymentStatus).toBe('partially_paid');
    expect(order.balanceDue).toBe(6000);

    const rest = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customerId.toString(),
        orderId,
        amount: 6000,
        method: 'cash',
      });
    expect(rest.status).toBe(201);

    order = await Order.findById(orderId);
    expect(order.paymentStatus).toBe('paid');
    expect(order.balanceDue).toBe(0);

    const ledger = await LedgerEntry.find({ customer: customerId }).sort({
      createdAt: 1,
    });
    const credits = ledger.filter((e) => e.credit > 0);
    expect(credits.length).toBeGreaterThanOrEqual(2);
    expect(ledger[ledger.length - 1].balance).toBe(0);
  });

  it('puts overpayment on customer credit balance', async () => {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: product._id.toString(), quantity: 1 }],
      });
    const orderId = orderRes.body.data.order._id;

    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customerId.toString(),
        orderId,
        amount: 12000,
        method: 'bank_transfer',
      });

    const order = await Order.findById(orderId);
    expect(order.paymentStatus).toBe('paid');
    expect(order.amountPaid).toBe(10000);

    const user = await User.findById(customerId);
    expect(user.creditBalance).toBe(2000);
  });

  it('cancels order and restores stock', async () => {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: product._id.toString(), quantity: 3 }],
      });
    const orderId = orderRes.body.data.order._id;

    let p = await Product.findById(product._id);
    expect(p.stockQuantity).toBe(47);

    const cancel = await request(app)
      .post(`/api/v1/orders/admin/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer requested' });

    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('cancelled');

    p = await Product.findById(product._id);
    expect(p.stockQuantity).toBe(50);
  });

  it('blocks pending customers from placing orders', async () => {
    const hash = await User.hashPassword('secret1');
    await User.create({
      name: 'Pending',
      shopName: 'Pending Shop',
      phone: '+923003333333',
      passwordHash: hash,
      role: ROLES.CUSTOMER,
      status: USER_STATUS.PENDING,
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      phone: '03003333333',
      password: 'secret1',
    });

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({
        items: [{ productId: product._id.toString(), quantity: 1 }],
      });
    expect(res.status).toBe(403);
  });

  it('never trusts client price', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: product._id.toString(),
            quantity: 1,
            price: 1,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.order.total).toBe(10000);
  });
});
