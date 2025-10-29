import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

declare global {
  interface Window {
    __rubbleOriginalRandom?: () => number;
  }
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

function todayKey(prefix: string) {
  const today = new Date();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const day = `${today.getDate()}`.padStart(2, '0');
  return `${prefix}:${today.getFullYear()}-${month}-${day}`;
}

test.describe('daily reward flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    });
    await page.addInitScript(() => {
      const originalRandom = Math.random;
      Math.random = () => 0; // force boost reward branch
      window.__rubbleOriginalRandom = originalRandom;
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      if (window.__rubbleOriginalRandom) {
        Math.random = window.__rubbleOriginalRandom;
        delete window.__rubbleOriginalRandom;
      }
    }).catch(() => {
      // ignore if page closed
    });
  });

  test('claiming daily reward grants boost and disables gift', async ({ page }) => {
    await initWalletStub(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const giftButton = page.getByRole('button', { name: 'Claim daily reward' });
    await expect(giftButton).toBeVisible();

    await giftButton.click();
    await expect(page.getByText('You claimed today’s boost! 🎉')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Daily reward claimed' })).toBeDisabled();

    const key = await page.evaluate(() => {
      const prefix = 'rubble:lastClaimDate';
      return window.localStorage.getItem(prefix);
    });
    const expected = todayKey('rubble:lastClaimDate');
    expect(key).toContain(expected.split(':')[1]);

    const boostSources = await page.evaluate(() => {
      const store = window.__rubbleRewardBoostStore;
      return store ? store.getState().boosts.map((boost) => boost.source) : [];
    });
    expect(boostSources).toContain('daily');
  });
});
