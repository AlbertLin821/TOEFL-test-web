import { test, expect, loginAsStudent } from './helpers';

test.describe('E2E login', () => {
  test('student can login and see available exams', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.getByRole('heading', { name: '可作答考試' })).toBeVisible();
    await expect(page.getByText('TOEFL-style Mock Test 01').first()).toBeVisible();
  });
});
