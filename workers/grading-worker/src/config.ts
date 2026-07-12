import path from 'node:path';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

const rootEnv = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: existsSync(rootEnv) ? rootEnv : undefined });

export const workerConfig = {
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  aiMode: (process.env.AI_MODE ?? 'mock') as 'mock' | 'real',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  gradingModel: process.env.OPENAI_GRADING_MODEL ?? 'gpt-4o-mini',
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'whisper-1',
  aiMaxRetries: Number(process.env.AI_MAX_RETRIES ?? 3),
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  platformName: process.env.PLATFORM_NAME ?? 'TOEFL-style Mock Test Platform',
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? 'no-reply@toefl-mock.local',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? 'minio_local',
    secretKey: process.env.S3_SECRET_KEY ?? 'minio_local_dev',
    bucketRecordings: process.env.S3_BUCKET_RECORDINGS ?? 'toefl-recordings',
    bucketReports: process.env.S3_BUCKET_REPORTS ?? 'toefl-reports',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  },
};
