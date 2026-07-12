import { Redis } from 'ioredis';
import { nanoid } from 'nanoid';
import { config } from '../config.js';

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const SESSION_PREFIX = 'session:';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionData {
  userId: string;
}

export async function createSession(userId: string): Promise<string> {
  const token = nanoid(48);
  await redis.set(`${SESSION_PREFIX}${token}`, JSON.stringify({ userId }), 'EX', SESSION_TTL_SECONDS);
  return token;
}

export async function getSession(token: string): Promise<SessionData | null> {
  const raw = await redis.get(`${SESSION_PREFIX}${token}`);
  if (!raw) return null;
  await redis.expire(`${SESSION_PREFIX}${token}`, SESSION_TTL_SECONDS);
  return JSON.parse(raw) as SessionData;
}

export async function destroySession(token: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${token}`);
}

export const SESSION_COOKIE = 'toefl_session';
