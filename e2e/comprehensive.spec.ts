import { test, expect } from '@playwright/test';

test.describe('Task Management System E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('User can login', async ({ page }) => {
    // Should be redirected to login page
    await expect(page).toHaveURL(/\/login/);
    
    // Fill in credentials (assuming test user exists or mock)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Click login
    await page.click('button[type="submit"]');
    
    // Should navigate to dashboard
    // Note: In a real test, we might need to mock Supabase auth response
  });

  test('User can create a task', async ({ page }) => {
    // Assume logged in state (requires setup)
    
    // Click inbox
    await page.click('text=Inbox');
    
    // Type new task
    await page.keyboard.type('New E2E Task');
    await page.keyboard.press('Enter');
    
    // Verify task appears
    await expect(page.locator('text=New E2E Task')).toBeVisible();
  });

  test('User can create a journal entry', async ({ page }) => {
    // Navigate to journal
    await page.click('text=Journal');
    
    // Click add button
    await page.click('button:has-text("plus")'); // Adjust selector as needed
    
    // Verify editor opens
    await expect(page.locator('textarea')).toBeVisible();
    
    // Type content
    await page.fill('textarea', '# My Journal\n\nTesting journal entry.');
    
    // Click save
    await page.click('text=Save');
    
    // Verify entry in list
    await expect(page.locator('text=My Journal')).toBeVisible();
  });

  test('User can use Calendar', async ({ page }) => {
    // Navigate to calendar
    await page.click('text=Calendar');
    
    // Verify calendar view
    await expect(page.locator('.grid-cols-7')).toBeVisible();
  });
});
