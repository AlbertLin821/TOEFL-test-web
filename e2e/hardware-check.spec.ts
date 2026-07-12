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
    await expect(page).toHaveURL(/\/hardware/);
    await completeHardwareCheck(page);
    await expect(page).not.toHaveURL(/\/hardware/);
    await expect(page.getByRole('button', { name: 'Begin' }).first()).toBeVisible();
  });
});
