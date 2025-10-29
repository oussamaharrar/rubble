import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('Boost gating integration', () => {
  test('reward boost enables play without tickets', async ({ page }) => {
    await initWalletStub(page);
    await page.addInitScript(() => {
      const now = Date.now();
      window.localStorage.setItem(
        'rubble:boosts',
        JSON.stringify([
          {
            id: 'test-boost',
            source: 'invite',
            grantedAt: now,
            consumedAt: null,
          },
        ])
      );
      window.localStorage.removeItem('rubble:tickets');
      window.localStorage.removeItem('rubble:lastClaimDate');
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('connect-wallet-home').click();
    await page.getByTestId('play-button').click();

    const stage = page.getByTestId('game-stage');
    await expect(stage).toBeVisible();
  });
});
