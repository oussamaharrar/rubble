import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

function shareKey() {
  const now = new Date();
  return `rubble:shared:${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

test.describe('Invite sharing', () => {
  test('share button grants invite boost once per day', async ({ page }) => {
    await initWalletStub(page);
    await page.addInitScript(() => {
      window.localStorage.removeItem('rubble:boosts');
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('connect-wallet-home').click();

    const inviteButton = page.getByRole('button', { name: 'Invite' });
    await inviteButton.click();

    await page.waitForTimeout(100);

    const storageKey = shareKey();
    const sharedValue = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
    expect(sharedValue).toBe('claimed');

    const boostSources = await page.evaluate(() =>
      ((window as any).__rubbleBoostStore?.getState().boosts ?? []).map((item: { source: string }) => item.source)
    );
    expect(boostSources).toContain('invite');

    await inviteButton.click();
    await page.waitForTimeout(50);

    const boostSourcesAfter = await page.evaluate(() =>
      ((window as any).__rubbleBoostStore?.getState().boosts ?? []).filter(
        (item: { source: string }) => item.source === 'invite'
      ).length
    );
    expect(boostSourcesAfter).toBe(1);
  });
});
