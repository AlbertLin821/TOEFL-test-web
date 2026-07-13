import { test, expect, loginAsStudent, installMediaMocks, completeHardwareCheck } from './helpers';

test.describe('E2E hardware check', () => {
  test.beforeEach(async ({ page }) => {
    await installMediaMocks(page);
  });

  test('student can pass hardware check after starting exam', async ({ page }) => {
    await loginAsStudent(page);

    const startButton = page.getByRole('button', { name: '開始' });
    test.skip(!(await startButton.isVisible().catch(() => false)), 'No available exam to start');

    await startButton.click();
    await expect(page).toHaveURL(/\/exam\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Hardware Check' })).toBeVisible();
    await completeHardwareCheck(page);
    await expect(page.getByRole('button', { name: 'Begin' }).first()).toBeVisible();
  });
});
