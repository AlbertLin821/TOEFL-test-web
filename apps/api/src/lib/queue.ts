import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from '@toefl/shared';
import { config } from '../config.js';

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const defaultJobOptions = {
  attempts: Number(process.env.AI_MAX_RETRIES ?? 3) + 1,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const gradingQueue = new Queue(QUEUE_NAMES.grading, { connection, defaultJobOptions });
export const emailQueue = new Queue(QUEUE_NAMES.email, { connection, defaultJobOptions });
