import { expect, test } from '@playwright/test';

test('runs the default Bell circuit and keeps major panels visible', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('QUANTUM IDE')).toBeVisible();
  await expect(page.getByText('CIRCUIT DIAGRAM', { exact: true })).toBeVisible();
  await expect(page.getByText('STATE INSPECTOR', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /run program/i }).click();
  await expect(page.getByText(/Complete\./)).toBeVisible();
  await expect(page.getByText('MEASUREMENT RESULTS')).toBeVisible();

  await page.getByRole('button', { name: 'Analysis' }).click();
  await expect(page.getByText('ANALYSIS LAB')).toBeVisible();
  await expect(page.getByText('PAULI EXPECTATIONS')).toBeVisible();
});
