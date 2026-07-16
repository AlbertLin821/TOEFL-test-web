import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import '../src/config.js';
import { prisma } from '@toefl/database';
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

  it('POST /auth/register creates a student session with access to existing exams', async () => {
    const email = `registration-${randomUUID()}@example.com`;
    const agent = request.agent(app);

    try {
      const register = await agent.post('/api/v1/auth/register').send({
        name: 'Registration Test Student',
        email,
        password: 'Password123!',
      });

      expect(register.status).toBe(201);
      expect(register.body.user).toMatchObject({ email, role: 'student' });
      expect(register.headers['set-cookie']).toBeDefined();

      const exams = await agent.get('/api/v1/student/available-exams');
      expect(exams.status).toBe(200);
      expect(exams.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ exam_title: 'TOEFL-style Mock Test 01' })]),
      );

      const created = await prisma.user.findUnique({
        where: { email },
        include: { classMembers: true },
      });
      expect(created?.classMembers).toHaveLength(1);
    } finally {
      await agent.post('/api/v1/auth/logout');
      const created = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (created) {
        await prisma.auditLog.deleteMany({ where: { actorUserId: created.id } });
        await prisma.user.delete({ where: { id: created.id } });
      }
    }
  });

  it('POST /auth/register rejects an existing email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Duplicate Student',
      email: 'STUDENT@DEMO.LOCAL',
      password: 'Password123!',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
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
