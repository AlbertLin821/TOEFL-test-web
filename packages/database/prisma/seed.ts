import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient, Prisma } from '@prisma/client';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import argon2 from 'argon2';
import {
  READING_M1_FILL,
  READING_M1_CHOICES,
  READING_M2_FILL,
  READING_M2_CHOICES,
  LISTENING_M1,
  LISTENING_M2,
  BUILD_A_SENTENCE,
  WRITE_AN_EMAIL,
  ACADEMIC_DISCUSSION,
  LISTEN_AND_REPEAT,
  LISTEN_AND_REPEAT_INTRO,
  INTERVIEW,
  INTERVIEW_INTRO,
} from './seed-data.js';

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(REPO_ROOT, '.env') });
const AUDIO_ROOT = path.join(REPO_ROOT, '題目音檔');

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minio_local',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minio_local_dev',
  },
  forcePathStyle: true,
});
const ASSETS_BUCKET = process.env.S3_BUCKET_ASSETS ?? 'toefl-assets';

async function uploadAudio(relPath: string): Promise<{ storageKey: string; checksum: string }> {
  const abs = path.join(AUDIO_ROOT, relPath);
  if (!existsSync(abs)) {
    throw new Error(`Audio file not found: ${abs}`);
  }
  const body = readFileSync(abs);
  const checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  const storageKey = `exam-audio/practice-test-1/${checksum}-${path.basename(relPath).replace(/\s+/g, '_')}`;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: ASSETS_BUCKET, Key: storageKey }));
  } catch {
    await s3.send(
      new PutObjectCommand({
        Bucket: ASSETS_BUCKET,
        Key: storageKey,
        Body: body,
        ContentType: 'audio/mpeg',
      }),
    );
  }
  return { storageKey, checksum };
}

async function main() {
  console.log('Seeding database...');
  const password = await argon2.hash('Password123!');

  // ---- Organization + users ----
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-english-center' },
    update: {},
    create: {
      name: 'Demo English Center',
      slug: 'demo-english-center',
      planType: 'pro',
      studentQuota: 200,
      examQuota: 500,
      aiCreditQuota: 500,
    },
  });

  const upsertUser = (email: string, name: string, role: 'platform_admin' | 'org_admin' | 'teacher' | 'student', orgId?: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash: password, organizationId: orgId ?? null },
    });

  const platformAdmin = await upsertUser('admin@platform.local', 'Platform Admin', 'platform_admin');
  const orgAdmin = await upsertUser('orgadmin@demo.local', 'Org Admin', 'org_admin', org.id);
  const teacher = await upsertUser('teacher@demo.local', 'Teacher Chen', 'teacher', org.id);
  const student = await upsertUser('student@demo.local', 'Student Lin', 'student', org.id);

  const klass = await prisma.class.findFirst({ where: { organizationId: org.id, name: 'TOEFL Class A' } })
    ?? await prisma.class.create({
      data: { organizationId: org.id, name: 'TOEFL Class A', teacherId: teacher.id },
    });

  await prisma.classMember.upsert({
    where: { classId_userId: { classId: klass.id, userId: student.id } },
    update: {},
    create: { classId: klass.id, userId: student.id },
  });

  // ---- Exam paper (idempotent: skip if already seeded) ----
  const existingPaper = await prisma.examPaper.findFirst({ where: { title: 'TOEFL-style Mock Test 01' } });
  if (existingPaper) {
    console.log('Exam paper already seeded, skipping exam creation.');
    return;
  }

  const paper = await prisma.examPaper.create({
    data: {
      title: 'TOEFL-style Mock Test 01',
      description: 'Full four-skill mock test based on Practice Test 1. Not an official TOEFL test.',
      status: 'published',
      organizationId: null,
      createdBy: platformAdmin.id,
    },
  });

  const version = await prisma.examVersion.create({
    data: {
      examPaperId: paper.id,
      versionNo: 'v1.0',
      status: 'published',
      totalScore: 120,
      publishedAt: new Date(),
    },
  });

  // ================= READING =================
  const reading = await prisma.examSection.create({
    data: { examVersionId: version.id, sectionType: 'reading', title: 'Reading Section', orderNo: 1, scoreMax: 30 },
  });

  const readingModules = [
    { title: 'Reading Module 1', fill: READING_M1_FILL, choices: READING_M1_CHOICES },
    { title: 'Reading Module 2', fill: READING_M2_FILL, choices: READING_M2_CHOICES },
  ];

  for (let m = 0; m < readingModules.length; m++) {
    const rm = readingModules[m];
    const mod = await prisma.examModule.create({
      data: {
        sectionId: reading.id,
        moduleType: 'reading_module',
        title: rm.title,
        description:
          'You can use Next and Back to move to the next question or return to previous questions within the same module. You will not be able to return to this module once you have moved on.',
        orderNo: m + 1,
        timeLimitSeconds: 20 * 60,
        allowBack: true,
        allowReview: true,
        allowReplay: false,
      },
    });

    const fillItem = await prisma.examItem.create({
      data: {
        moduleId: mod.id,
        itemType: 'reading_fill_blank',
        orderNo: 1,
        gradingType: 'auto',
        scoreMax: new Prisma.Decimal(10),
        contentJson: {
          instructions: rm.fill.instructions,
          template: rm.fill.template,
          blank_count: rm.fill.answers.length,
          question_label: 'Questions 1-10',
        },
      },
    });
    await prisma.answerKey.create({
      data: {
        examItemId: fillItem.id,
        answerJson: { answers: rm.fill.answers, case_sensitive: false },
        scoringRuleJson: { type: 'per_blank_partial' },
      },
    });

    for (let i = 0; i < rm.choices.length; i++) {
      const c = rm.choices[i];
      const item = await prisma.examItem.create({
        data: {
          moduleId: mod.id,
          itemType: 'reading_single_choice',
          orderNo: i + 2,
          gradingType: 'auto',
          scoreMax: new Prisma.Decimal(1),
          contentJson: {
            instructions: c.instructions ?? null,
            stimulus_title: c.stimulusTitle ?? null,
            stimulus_text: c.stimulusText ?? null,
            question_text: c.questionText,
            options: c.options,
            question_number: i + 11,
          },
        },
      });
      await prisma.answerKey.create({
        data: {
          examItemId: item.id,
          answerJson: { correct_option_index: c.correctIndex },
        },
      });
    }
  }

  // ================= LISTENING =================
  const listening = await prisma.examSection.create({
    data: { examVersionId: version.id, sectionType: 'listening', title: 'Listening Section', orderNo: 2, scoreMax: 30 },
  });

  const listeningModules = [
    { title: 'Listening Module 1', items: LISTENING_M1 },
    { title: 'Listening Module 2', items: LISTENING_M2 },
  ];

  for (let m = 0; m < listeningModules.length; m++) {
    const lm = listeningModules[m];
    const mod = await prisma.examModule.create({
      data: {
        sectionId: listening.id,
        moduleType: 'listening_module',
        title: lm.title,
        description:
          'You can use Next to move to the next question. You WILL NOT be able to return to previous questions.',
        orderNo: m + 1,
        timeLimitSeconds: null,
        allowBack: false,
        allowReview: false,
        allowReplay: false,
      },
    });

    for (let i = 0; i < lm.items.length; i++) {
      const c = lm.items[i];
      const item = await prisma.examItem.create({
        data: {
          moduleId: mod.id,
          itemType: 'listening_single_choice',
          orderNo: i + 1,
          gradingType: 'auto',
          timeLimitSeconds: 20,
          scoreMax: new Prisma.Decimal(1),
          contentJson: {
            instructions: c.instructions ?? null,
            question_text: c.questionText ?? null,
            options: c.options,
            question_number: i + 1,
            group_audio: c.groupAudio ?? false,
            play_once: true,
          },
        },
      });
      await prisma.answerKey.create({
        data: { examItemId: item.id, answerJson: { correct_option_index: c.correctIndex } },
      });
      if (c.audioFile) {
        const { storageKey, checksum } = await uploadAudio(c.audioFile);
        await prisma.examAsset.create({
          data: {
            examItemId: item.id,
            assetType: 'audio',
            storageKey,
            mimeType: 'audio/mpeg',
            checksum,
          },
        });
      }
    }
  }

  // ================= WRITING =================
  const writing = await prisma.examSection.create({
    data: { examVersionId: version.id, sectionType: 'writing', title: 'Writing Section', orderNo: 3, scoreMax: 30 },
  });

  const basMod = await prisma.examModule.create({
    data: {
      sectionId: writing.id,
      moduleType: 'writing_build_sentence',
      title: 'Build a Sentence',
      description:
        'Move the words in the boxes to create grammatical sentences. A clock will show you how much time you have to complete this task.',
      orderNo: 1,
      timeLimitSeconds: 6 * 60,
      allowBack: true,
      allowReview: false,
      allowReplay: false,
    },
  });

  for (let i = 0; i < BUILD_A_SENTENCE.length; i++) {
    const q = BUILD_A_SENTENCE[i];
    const item = await prisma.examItem.create({
      data: {
        moduleId: basMod.id,
        itemType: 'writing_sentence_order',
        orderNo: i + 1,
        gradingType: 'auto',
        scoreMax: new Prisma.Decimal(1),
        contentJson: {
          question_text: q.questionText,
          prefix: q.prefix ?? null,
          suffix: q.suffix ?? null,
          tokens: q.tokens,
          question_number: i + 1,
        },
      },
    });
    await prisma.answerKey.create({
      data: {
        examItemId: item.id,
        answerJson: { correct_order: q.correctOrder, accepted_sentences: [q.acceptedSentence] },
      },
    });
  }

  const emailMod = await prisma.examModule.create({
    data: {
      sectionId: writing.id,
      moduleType: 'writing_email',
      title: 'Write an Email',
      description: WRITE_AN_EMAIL.instructions,
      orderNo: 2,
      timeLimitSeconds: 7 * 60,
      allowBack: false,
      allowReview: false,
      allowReplay: false,
    },
  });

  const emailItem = await prisma.examItem.create({
    data: {
      moduleId: emailMod.id,
      itemType: 'writing_email',
      orderNo: 1,
      gradingType: 'ai',
      timeLimitSeconds: 7 * 60,
      scoreMax: new Prisma.Decimal(30),
      contentJson: {
        instructions: WRITE_AN_EMAIL.instructions,
        scenario: WRITE_AN_EMAIL.scenario,
        task_points: WRITE_AN_EMAIL.taskPoints,
        to: WRITE_AN_EMAIL.to,
        subject: WRITE_AN_EMAIL.subject,
      },
    },
  });
  await prisma.answerKey.create({
    data: {
      examItemId: emailItem.id,
      answerJson: {
        task_type: 'writing_email',
        prompt_summary: `${WRITE_AN_EMAIL.scenario} Tasks: ${WRITE_AN_EMAIL.taskPoints.join(' ')}`,
      },
    },
  });

  const discMod = await prisma.examModule.create({
    data: {
      sectionId: writing.id,
      moduleType: 'writing_academic_discussion',
      title: 'Write for an Academic Discussion',
      description: ACADEMIC_DISCUSSION.instructions,
      orderNo: 3,
      timeLimitSeconds: 10 * 60,
      allowBack: false,
      allowReview: false,
      allowReplay: false,
    },
  });

  const discItem = await prisma.examItem.create({
    data: {
      moduleId: discMod.id,
      itemType: 'writing_academic_discussion',
      orderNo: 1,
      gradingType: 'ai',
      timeLimitSeconds: 10 * 60,
      scoreMax: new Prisma.Decimal(30),
      contentJson: {
        instructions: ACADEMIC_DISCUSSION.instructions,
        context: ACADEMIC_DISCUSSION.context,
        professor_question: ACADEMIC_DISCUSSION.professorQuestion,
        student_posts: ACADEMIC_DISCUSSION.studentPosts,
        min_words: ACADEMIC_DISCUSSION.minWords,
      },
    },
  });
  await prisma.answerKey.create({
    data: {
      examItemId: discItem.id,
      answerJson: {
        task_type: 'writing_academic_discussion',
        prompt_summary: ACADEMIC_DISCUSSION.professorQuestion,
      },
    },
  });

  // ================= SPEAKING =================
  const speaking = await prisma.examSection.create({
    data: { examVersionId: version.id, sectionType: 'speaking', title: 'Speaking Section', orderNo: 4, scoreMax: 30 },
  });

  const lrDirections = await uploadAudio(LISTEN_AND_REPEAT_INTRO.directionsAudio);
  const lrMod = await prisma.examModule.create({
    data: {
      sectionId: speaking.id,
      moduleType: 'speaking_listen_repeat',
      title: 'Listen and Repeat',
      description: `${LISTEN_AND_REPEAT_INTRO.instructions}\n\n${LISTEN_AND_REPEAT_INTRO.scenario}`,
      orderNo: 1,
      allowBack: false,
      allowReview: false,
      allowReplay: false,
    },
  });
  await prisma.examAsset.create({
    data: {
      examItemId: null,
      assetType: 'audio',
      storageKey: lrDirections.storageKey,
      mimeType: 'audio/mpeg',
      checksum: lrDirections.checksum,
    },
  });

  for (let i = 0; i < LISTEN_AND_REPEAT.length; i++) {
    const q = LISTEN_AND_REPEAT[i];
    const item = await prisma.examItem.create({
      data: {
        moduleId: lrMod.id,
        itemType: 'speaking_listen_repeat',
        orderNo: i + 1,
        gradingType: 'ai',
        timeLimitSeconds: q.responseSeconds,
        scoreMax: new Prisma.Decimal(30),
        contentJson: {
          question_number: i + 1,
          response_seconds: q.responseSeconds,
          highlight_image: i >= 2,
          directions_audio_key: i === 0 ? lrDirections.storageKey : null,
        },
      },
    });
    const { storageKey, checksum } = await uploadAudio(q.audioFile);
    await prisma.examAsset.create({
      data: { examItemId: item.id, assetType: 'audio', storageKey, mimeType: 'audio/mpeg', checksum },
    });
    await prisma.answerKey.create({
      data: {
        examItemId: item.id,
        answerJson: {
          task_type: 'speaking_listen_repeat',
          expected_key_content: q.expectedText,
          response_time_seconds: q.responseSeconds,
        },
      },
    });
  }

  const ivDirections = await uploadAudio(INTERVIEW_INTRO.directionsAudio);
  const ivMod = await prisma.examModule.create({
    data: {
      sectionId: speaking.id,
      moduleType: 'speaking_interview',
      title: 'Take an Interview',
      description: `${INTERVIEW_INTRO.instructions}\n\n${INTERVIEW_INTRO.scenario}`,
      orderNo: 2,
      allowBack: false,
      allowReview: false,
      allowReplay: false,
    },
  });
  await prisma.examAsset.create({
    data: {
      examItemId: null,
      assetType: 'audio',
      storageKey: ivDirections.storageKey,
      mimeType: 'audio/mpeg',
      checksum: ivDirections.checksum,
    },
  });

  for (let i = 0; i < INTERVIEW.length; i++) {
    const q = INTERVIEW[i];
    const item = await prisma.examItem.create({
      data: {
        moduleId: ivMod.id,
        itemType: 'speaking_interview',
        orderNo: i + 1,
        gradingType: 'ai',
        timeLimitSeconds: q.responseSeconds,
        scoreMax: new Prisma.Decimal(30),
        contentJson: {
          question_number: i + 1,
          question_text: q.questionText,
          response_seconds: q.responseSeconds,
          directions_audio_key: i === 0 ? ivDirections.storageKey : null,
        },
      },
    });
    const { storageKey, checksum } = await uploadAudio(q.audioFile);
    await prisma.examAsset.create({
      data: { examItemId: item.id, assetType: 'audio', storageKey, mimeType: 'audio/mpeg', checksum },
    });
    await prisma.answerKey.create({
      data: {
        examItemId: item.id,
        answerJson: {
          task_type: 'speaking_interview',
          question_text: q.questionText,
          expected_key_content: 'A relevant, developed answer to the interview question.',
          response_time_seconds: q.responseSeconds,
        },
      },
    });
  }

  // ---- Assignment: open now for the demo class ----
  const now = new Date();
  const closes = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.examAssignment.create({
    data: {
      organizationId: org.id,
      examVersionId: version.id,
      classId: klass.id,
      assignedBy: teacher.id,
      opensAt: now,
      closesAt: closes,
      maxAttempts: 3,
      status: 'active',
    },
  });

  console.log('Seed completed.');
  console.log('Accounts (password: Password123!):');
  console.log('  platform admin: admin@platform.local');
  console.log('  org admin:      orgadmin@demo.local');
  console.log('  teacher:        teacher@demo.local');
  console.log('  student:        student@demo.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
