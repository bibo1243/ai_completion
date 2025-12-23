import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  // Expect a title "to contain" a substring.
  // Since we have a redirect to /login if not authenticated
  await expect(page).toHaveURL(/.*login/);
});
