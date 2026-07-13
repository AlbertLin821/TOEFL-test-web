import { PrismaClient } from '@prisma/client';

const email = process.argv[2] ?? 'student@demo.local';
const prisma = new PrismaClient();

async function resetAttempt(attemptId: string, fromStatus: string) {
  await prisma.gradingJob.deleteMany({ where: { attemptId } });
  await prisma.attemptSectionState.deleteMany({ where: { attemptId } });
  await prisma.response.deleteMany({ where: { attemptId } });
  await prisma.audioResponse.deleteMany({ where: { attemptId } });
  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      status: 'hardware_check',
      currentSectionId: null,
      currentItemId: null,
      lastSavedAt: null,
      submittedAt: null,
    },
  });
  console.log(`Reset attempt ${attemptId} (${fromStatus} -> hardware_check)`);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const active = await prisma.attempt.findMany({
    where: {
      studentId: user.id,
      status: { in: ['hardware_check', 'in_progress', 'not_started'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

  if (active.length > 0) {
    for (const attempt of active) {
      await resetAttempt(attempt.id, attempt.status);
    }
    console.log(`Done. Log in as ${email} and click "繼續硬體檢查".`);
    return;
  }

  const latestFinished = await prisma.attempt.findFirst({
    where: {
      studentId: user.id,
      status: { in: ['submitted', 'grading', 'completed', 'error'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

  if (!latestFinished) {
    console.log(`No attempts found for ${email}. Click "開始" on the exam list.`);
    return;
  }

  await resetAttempt(latestFinished.id, latestFinished.status);
  console.log(`Done. Log in as ${email} and click "繼續硬體檢查".`);
  console.log('With EXAM_DEBUG_START_AT_SPEAKING=true, the exam will jump to Speaking after hardware check.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
