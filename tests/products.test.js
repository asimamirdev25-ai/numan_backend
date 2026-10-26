const request = require('supertest');
const app = require('../src/app');
const { User, Category, Product, Settings } = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');

describe('Products / Categories / Stock API', () => {
  let adminToken;
  let categoryId;
  let productId;

  beforeEach(async () => {
    await Settings.create({ key: 'shop', requireApproval: true, shopName: 'Numan Cables' });

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

    const cat = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Electric Cable',
        description: 'Test category',
        isFeatured: true,
      });
    categoryId = cat.body.data._id;
  });

  it('creates a category (admin)', async () => {
    expect(categoryId).toBeDefined();
    const list = await request(app).get('/api/v1/categories');
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('creates a product with opening stock and stock movement', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '2.5mm Twin Earth',
        category: categoryId,
        price: 18500,
        unit: 'coil',
        stockQuantity: 20,
        lowStockThreshold: 5,
        attributes: [
          { key: 'gauge', value: '2.5mm²' },
          { key: 'cores', value: '2+E' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.stockQuantity).toBe(20);
    expect(res.body.data.priceFormatted).toContain('Rs.');
    expect(res.body.data.slug).toBeDefined();
    expect(res.body.data.sku).toBeDefined();
    productId = res.body.data._id;

    const movements = await request(app)
      .get(`/api/v1/products/${productId}/stock-movements`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(movements.status).toBe(200);
    expect(movements.body.data.length).toBeGreaterThanOrEqual(1);
    expect(movements.body.data[0].type).toBe('add');
  });

  it('adjusts stock (add / deduct) and blocks oversell', async () => {
    const created = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Flex Wire 1mm',
        category: categoryId,
        price: 10000,
        stockQuantity: 5,
      });
    productId = created.body.data._id;

    const add = await request(app)
      .post(`/api/v1/products/${productId}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'add', quantity: 3, reason: 'New delivery' });
    expect(add.status).toBe(200);
    expect(add.body.data.product.stockQuantity).toBe(8);

    const deduct = await request(app)
      .post(`/api/v1/products/${productId}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'deduct', quantity: 2, reason: 'Damaged' });
    expect(deduct.status).toBe(200);
    expect(deduct.body.data.product.stockQuantity).toBe(6);

    const oversell = await request(app)
      .post(`/api/v1/products/${productId}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'deduct', quantity: 100, reason: 'Bad' });
    expect(oversell.status).toBe(400);
  });

  it('lists public products with search and filters', async () => {
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Armoured SWA 16mm',
        category: categoryId,
        price: 125000,
        stockQuantity: 50,
        isFeatured: true,
      });

    const list = await request(app).get('/api/v1/products').query({
      search: 'Armoured',
      minPrice: 1000,
    });
    expect(list.status).toBe(200);
    expect(list.body.meta).toBeDefined();
  });

  it('soft-deletes a product', async () => {
    const created = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Temp Product',
        category: categoryId,
        price: 1000,
        stockQuantity: 1,
      });

    const del = await request(app)
      .delete(`/api/v1/products/${created.body.data._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const publicList = await request(app).get('/api/v1/products');
    const ids = publicList.body.data.map((p) => p._id);
    expect(ids).not.toContain(created.body.data._id);
  });

  it('lists low stock products', async () => {
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Low Stock Item',
        category: categoryId,
        price: 5000,
        stockQuantity: 2,
        lowStockThreshold: 10,
      });

    const res = await request(app)
      .get('/api/v1/products/admin/low-stock')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
