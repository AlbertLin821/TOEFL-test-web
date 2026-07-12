import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Auth API', () => {
  it('POST /auth/login succeeds with demo student', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@demo.local', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('student');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('GET /users/me requires auth', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});

describe('Tenant guard', () => {
  it('student cannot access teacher results without auth', async () => {
    const res = await request(app).get('/api/v1/teacher/results');
    expect(res.status).toBe(401);
  });
});
