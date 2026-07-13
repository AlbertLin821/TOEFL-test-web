import { test as base, expect, type Page } from '@playwright/test';

export const DEMO_STUDENT = {
  email: 'student@demo.local',
  password: 'Password123!',
};

export async function installMediaMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mockStream = {
      getTracks: () => [{ stop: () => undefined }],
    } as MediaStream;

    navigator.mediaDevices.getUserMedia = async () => mockStream;

    class MockMediaRecorder {
      state: RecordingState = 'inactive';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;

      start() {
        this.state = 'recording';
        window.setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['e2e-audio'], { type: 'audio/webm' }) } as BlobEvent);
          this.stop();
        }, 80);
      }

      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    window.MediaRecorder = MockMediaRecorder as typeof MediaRecorder;

    const OrigAudio = window.Audio;
    window.Audio = class extends OrigAudio {
      play() {
        window.setTimeout(() => {
          this.dispatchEvent(new Event('ended'));
        }, 50);
        return Promise.resolve();
      }
    } as typeof Audio;
  });
}

export async function loginAsStudent(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(DEMO_STUDENT.email);
  await page.locator('input[type="password"]').fill(DEMO_STUDENT.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/student\/exams/);
}

export async function completeHardwareCheck(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Adjust the volume' })).toBeVisible();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Adjusting the Microphone' })).toBeVisible();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText('Your microphone volume has been successfully adjusted.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click();
}

export async function advanceExamToSubmit(page: Page): Promise<void> {
  for (let step = 0; step < 2500; step += 1) {
    if (page.url().includes('/grading')) return;

    const stopSpeaking = page.getByRole('button', { name: 'Stop Speaking' });
    if (await stopSpeaking.isVisible().catch(() => false)) {
      await stopSpeaking.click();
      await page.waitForTimeout(400);
      continue;
    }

    if (await page.getByText('Uploading recording...').isVisible().catch(() => false)) {
      await page.waitForTimeout(500);
      continue;
    }

    if (await page.getByText('Playing prompt...').isVisible().catch(() => false)) {
      await page.waitForTimeout(100);
      continue;
    }

    const begin = page.getByRole('button', { name: 'Begin' });
    if (await begin.isVisible().catch(() => false)) {
      await begin.click();
      await page.waitForTimeout(150);
      continue;
    }

    const next = page.getByRole('button', { name: 'Next' });
    if (await next.isVisible().catch(() => false)) {
      if (await next.isEnabled().catch(() => false)) {
        await next.click();
        await page.waitForTimeout(150);
        continue;
      }
    }

    const radio = page.locator('input[type="radio"]').first();
    if (await radio.isVisible().catch(() => false)) {
      await radio.check().catch(() => undefined);
    }

    const blank = page.locator('input.border-b-2').first();
    if (await blank.isVisible().catch(() => false)) {
      await blank.fill('sample').catch(() => undefined);
    }

    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible().catch(() => false)) {
      const value = await textarea.inputValue().catch(() => '');
      if (!value.trim()) {
        await textarea.fill('E2E automated writing response for mock grading.');
      }
    }

    await page.waitForTimeout(150);
  }

  throw new Error('Exam navigation did not reach grading page within step limit');
}

export async function submitAttemptViaApi(page: Page, attemptId: string, examVersionId: string): Promise<void> {
  const examRes = await page.request.get(`/api/v1/exam-versions/${examVersionId}`);
  expect(examRes.ok()).toBeTruthy();
  const exam = (await examRes.json()) as {
    sections: {
      modules: {
        items: { id: string; item_type: string; content: Record<string, unknown> }[];
      }[];
    }[];
  };

  for (const section of exam.sections) {
    for (const mod of section.modules) {
      for (const item of mod.items) {
        let response_json: unknown = {};
        if (item.item_type === 'reading_fill_blank') {
          const count = Number(item.content.blank_count ?? 10);
          response_json = { blanks: Array.from({ length: count }, () => 'sample') };
        } else if (item.item_type.endsWith('single_choice')) {
          response_json = { selected_option_index: 0 };
        } else if (item.item_type === 'writing_sentence_order') {
          response_json = { ordered_tokens: [...((item.content.tokens as string[]) ?? [])] };
        } else if (item.item_type === 'writing_email' || item.item_type === 'writing_academic_discussion') {
          response_json = { text: 'E2E automated writing response for mock grading pipeline.' };
        }

        const saveRes = await page.request.patch(`/api/v1/attempts/${attemptId}/response`, {
          data: { exam_item_id: item.id, response_json },
        });
        expect(saveRes.ok()).toBeTruthy();

        if (item.item_type.startsWith('speaking_')) {
          const audioRes = await page.request.post(`/api/v1/attempts/${attemptId}/audio`, {
            multipart: {
              exam_item_id: item.id,
              duration_ms: '3000',
              audio: {
                name: 'recording.webm',
                mimeType: 'audio/webm',
                buffer: Buffer.from('e2e-fake-audio'),
              },
            },
          });
          expect(audioRes.ok()).toBeTruthy();
        }
      }
    }
  }

  const submitRes = await page.request.post(`/api/v1/attempts/${attemptId}/submit`);
  expect(submitRes.ok()).toBeTruthy();
}

export async function startOrResumeAttempt(page: Page): Promise<{ attemptId: string; examVersionId: string } | null> {
  await loginAsStudent(page);

  const reportLink = page.getByRole('link', { name: '查看報告' });
  if (await reportLink.isVisible().catch(() => false)) {
    return null;
  }

  const continueButton = page.getByRole('button', { name: '繼續' });
  const startButton = page.getByRole('button', { name: '開始' });

  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  } else if (await startButton.isVisible().catch(() => false)) {
    await startButton.click();
    await completeHardwareCheck(page);
  } else {
    return null;
  }

  if (page.url().includes('/hardware')) {
    await page.goto(page.url().replace('/hardware', ''));
  }

  if (await page.getByRole('heading', { name: 'Hardware Check' }).isVisible().catch(() => false)) {
    await completeHardwareCheck(page);
  }

  const attemptId = page.url().match(/\/exam\/([^/]+)/)?.[1];
  if (!attemptId) throw new Error('Unable to parse attempt id from exam URL');

  const attemptRes = await page.request.get(`/api/v1/attempts/${attemptId}`);
  expect(attemptRes.ok()).toBeTruthy();
  const attempt = (await attemptRes.json()) as { exam_version_id: string };
  return { attemptId, examVersionId: attempt.exam_version_id };
}

export async function waitForGradingComplete(page: Page, attemptId: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/attempts/${attemptId}/grading-status`);
        if (!res.ok()) return 'error';
        const body = (await res.json()) as { attempt_status: string };
        return body.attempt_status;
      },
      { timeout: 300_000, intervals: [2000, 3000, 5000] },
    )
    .toBe('completed');
}

export const test = base;
export { expect };
