import { test, expect } from '@playwright/test';

test.describe('App smoke', () => {
  test('unauthenticated navigation is gated to the sign-in page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('sign-in page renders the GitHub provider button', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page).toHaveTitle(/Sign\s*[Ii]n/);
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
  });

  test('protected dashboard route redirects to sign-in for guests', async ({ page }) => {
    await page.goto('/dashboard/repos');
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});