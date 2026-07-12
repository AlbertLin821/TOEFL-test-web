import {
  test,
  expect,
  loginAsStudent,
  installMediaMocks,
  startOrResumeAttempt,
  submitAttemptViaApi,
  waitForGradingComplete,
} from './helpers';

test.describe('E2E-001 full exam flow', () => {
  test.beforeEach(async ({ page }) => {
    await installMediaMocks(page);
  });

  test('student submits exam, waits for grading, views report and PDF', async ({ page }) => {
    await loginAsStudent(page);

    const reportLink = page.getByRole('link', { name: '查看報告' });
    const gradingLink = page.getByRole('link', { name: '查看批改狀態' });

    if (await reportLink.isVisible().catch(() => false)) {
      await reportLink.click();
    } else if (await gradingLink.isVisible().catch(() => false)) {
      await gradingLink.click();
      const attemptId = page.url().match(/exam\/([^/]+)/)?.[1];
      if (!attemptId) throw new Error('Unable to parse attempt id from grading URL');
      await waitForGradingComplete(page, attemptId);
      await page.getByRole('link', { name: '查看報告' }).click();
    } else {
      const started = await startOrResumeAttempt(page);
      test.skip(!started, 'No available exam attempt for demo student');
      await submitAttemptViaApi(page, started!.attemptId, started!.examVersionId);
      await page.goto(`/exam/${started!.attemptId}/grading`);
      await waitForGradingComplete(page, started!.attemptId);
      await page.getByRole('link', { name: '查看報告' }).click();
    }

    await expect(page.getByRole('heading', { name: '四技能英語模擬測驗報告' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Reading')).toBeVisible();
    await expect(page.getByText('Total')).toBeVisible();

    const pdfButton = page.getByRole('button', { name: 'Download PDF' });
    await expect(pdfButton).toBeVisible();

    const attemptId = page.url().match(/reports\/([^/?#]+)/)?.[1];
    if (!attemptId) throw new Error('Unable to parse attempt id from report URL');

    const pdfMeta = await page.request.get(`/api/v1/reports/${attemptId}/pdf`);
    expect(pdfMeta.ok()).toBeTruthy();
    const { download_url } = (await pdfMeta.json()) as { download_url: string };
    expect(download_url).toMatch(/reports|minio|localhost:9000|\.pdf/);

    const pdfRes = await page.request.get(download_url);
    expect(pdfRes.ok()).toBeTruthy();
    expect(pdfRes.headers()['content-type'] ?? '').toContain('pdf');
  });
});
