const { request, app, bcrypt, jwt } = require('./setup');

describe('Auth API', () => {
  let adminToken;

  beforeAll(async () => {
    // Log in as seeded admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@luminari-labs.space', password: 'admin123' });
    adminToken = loginRes.body.token;
  });

  test('Public registration is disabled (returns 403)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Public User', email: 'public@test.com', password: 'password123' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Registration is disabled. Please contact the administrator.');
  });

  test('Register new user via admin', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test User', email: 'test@test.com', password: 'password123', role: 'employee' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('test@test.com');
  });

  test('Login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('Login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });

  test('Register with invalid email via admin', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', email: 'invalid', password: 'password123' });
    expect(res.statusCode).toBe(400);
  });
});

describe('QR API', () => {
  let adminToken;
  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@luminari-labs.space', password: 'admin123' });
    adminToken = loginRes.body.token;
  });

  test('Generate QR token as admin', async () => {
    const res = await request(app)
      .get('/api/qr/current')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.expires_at).toBeDefined();
  });

  test('Reject QR generation for non-admin', async () => {
    // Create an employee user
    await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'User', email: 'user@test.com', password: 'password123', role: 'employee' });

    // Log in as employee
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'password123' });
    const userToken = loginRes.body.token;

    const qrRes = await request(app)
      .get('/api/qr/current')
      .set('Authorization', `Bearer ${userToken}`);
    expect(qrRes.statusCode).toBe(403);
  });
});

describe('Rate Limiting', () => {
  test('Rate limit on login', async () => {
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'ratelimit@test.com', password: 'password' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ratelimit@test.com', password: 'password' });
    expect(res.statusCode).toBe(429);
  });
});
