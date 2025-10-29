import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

test.describe('Daily reward', () => {
  test('claiming reward updates storage and disables button', async ({ page }) => {
    await initWalletStub(page);
    await page.addInitScript(() => {
      window.localStorage.removeItem('rubble:lastClaimDate');
      window.localStorage.removeItem('rubble:boosts');
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('connect-wallet-home').click();

    const giftButton = page.getByTestId('daily-reward-button');
    await expect(giftButton).toBeVisible();
    await giftButton.click();

    await page.waitForTimeout(100);

    const lastClaim = await page.evaluate(() => window.localStorage.getItem('rubble:lastClaimDate'));
    expect(lastClaim).toBe(todayKey());

    await expect(giftButton).toBeDisabled();
  });
});
