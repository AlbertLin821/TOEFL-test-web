import { randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';
import type { Express } from 'express';
import type { PrismaClient } from '@toefl/database';

const rootEnv = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: existsSync(rootEnv) ? rootEnv : undefined });

async function canConnect(url: string, timeoutMs = 700) {
  return new Promise<boolean>((resolve) => {
    const parsed = new URL(url);
    const socket = net.createConnection({
      host: parsed.hostname,
      port: Number(parsed.port),
    });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

const databaseUrl = process.env.DATABASE_URL ?? '';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const missingDependencies: string[] = [];

if (!databaseUrl) {
  missingDependencies.push('DATABASE_URL');
} else if (!(await canConnect(databaseUrl))) {
  const parsed = new URL(databaseUrl);
  missingDependencies.push(`Postgres ${parsed.hostname}:${parsed.port}`);
}

if (!(await canConnect(redisUrl))) {
  const parsed = new URL(redisUrl);
  missingDependencies.push(`Redis ${parsed.hostname}:${parsed.port}`);
}

if (missingDependencies.length > 0) {
  describe.skip(`Auth API integration (missing ${missingDependencies.join(', ')})`, () => {
    it('requires local integration services', () => {});
  });
} else {
  let app: Express;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const [appModule, databaseModule] = await Promise.all([
      import('../src/app.js'),
      import('@toefl/database'),
    ]);
    app = appModule.createApp();
    prisma = databaseModule.prisma;
  });

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
}
