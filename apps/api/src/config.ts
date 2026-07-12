import path from 'node:path';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

// Load the repo-root .env when running from apps/api (hybrid local dev).
const rootEnv = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: existsSync(rootEnv) ? rootEnv : undefined });

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret-do-not-use-in-production',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? 'minio_local',
    secretKey: process.env.S3_SECRET_KEY ?? 'minio_local_dev',
    bucketAssets: process.env.S3_BUCKET_ASSETS ?? 'toefl-assets',
    bucketRecordings: process.env.S3_BUCKET_RECORDINGS ?? 'toefl-recordings',
    bucketReports: process.env.S3_BUCKET_REPORTS ?? 'toefl-reports',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  },
  platformName: process.env.PLATFORM_NAME ?? 'TOEFL-style Mock Test Platform',
};
