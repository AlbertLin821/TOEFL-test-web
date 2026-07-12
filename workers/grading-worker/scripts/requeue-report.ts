import { prisma } from '@toefl/database';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from '@toefl/shared';

async function main() {
  const attemptId = process.argv[2] ?? '4f3e6dc0-e283-4dce-b650-8804fb8eaced';
  const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAMES.grading, { connection });
  const job = await prisma.gradingJob.create({ data: { attemptId, jobType: 'report_generation' } });
  await queue.add('report_generation', { gradingJobId: job.id, attemptId });
  console.log('Requeued', job.id, attemptId);
  await queue.close();
  await connection.quit();
}

main().finally(() => prisma.$disconnect());
