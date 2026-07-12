import { test, expect, installMediaMocks, startOrResumeAttempt } from './helpers';

test.describe('E2E exam UI navigation', () => {
  test.beforeEach(async ({ page }) => {
    await installMediaMocks(page);
  });

  test('student navigates reading section items in exam UI', async ({ page }) => {
    const started = await startOrResumeAttempt(page);
    test.skip(!started, 'No available exam attempt for demo student');

    await page.getByRole('button', { name: 'Begin' }).first().click();
    await page.getByRole('button', { name: 'Begin' }).click();

    for (let i = 0; i < 8; i += 1) {
      const radio = page.locator('input[type="radio"]').first();
      if (await radio.isVisible().catch(() => false)) {
        await radio.check();
      }
      const next = page.getByRole('button', { name: 'Next' });
      if (!(await next.isVisible().catch(() => false))) break;
      if (!(await next.isEnabled().catch(() => false))) break;
      await next.click();
    }

    await expect(page.getByText('Saved').or(page.getByText('Saving...'))).toBeVisible({ timeout: 15_000 });
  });
});
