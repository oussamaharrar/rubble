import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';
const INVITER = '0x9999999999999999999999999999999999999999';

test.describe('referral credit claim', () => {
  test('dedupes repeated invite claims per pair', async ({ page }) => {
    let claimCount = 0;
    await page.route('**/api/referral/claim', async (route) => {
      claimCount += 1;
      if (claimCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, reward: { type: 'boost', amount: 1 } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, reason: 'duplicate' }),
      });
    });

    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // ignore
      }
    });

    await initWalletStub(page);
    await page.goto(`${BASE_URL}?ref=${INVITER}`, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('play-button').click();
    await page.getByTestId('gate-connect-wallet').click();

    await expect(page.getByText('Referral boost unlocked! +1 boost.')).toBeVisible();

    const boostCountAfterSuccess = await page.evaluate(() => {
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!rewardStore) return 0;
      return rewardStore.getState().boosts.length;
    });
    expect(boostCountAfterSuccess).toBeGreaterThan(0);

    await page.evaluate(() => {
      try {
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith('referral:')) {
            window.localStorage.removeItem(key);
          }
        });
      } catch {
        // ignore
      }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('play-button').click();
    await page.getByTestId('gate-connect-wallet').click();

    const boostCountAfterDuplicate = await page.evaluate(() => {
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!rewardStore) return 0;
      return rewardStore.getState().boosts.length;
    });

    expect(claimCount).toBeGreaterThanOrEqual(2);
    expect(boostCountAfterDuplicate).toBe(boostCountAfterSuccess);
  });
});
