import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

const INVITER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

test.describe('referral credit flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await initWalletStub(page);
  });

  test('referral claim succeeds once and duplicates are ignored', async ({ page }) => {
    let claimCount = 0;

    await page.route('**/api/referral/claim', async (route) => {
      claimCount += 1;
      if (claimCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, reward: { type: 'boost', amount: 2 } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, reason: 'duplicate' }),
        });
      }
    });

    await page.goto(`${BASE_URL}?ref=${INVITER}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('connect-wallet-home').click();

    await expect.poll(() => claimCount).toBe(1);

    const inviteBoosts = await page.evaluate(() => {
      const store = (window as any).__rubbleRewardBoostStore;
      if (!store) return 0;
      return store
        .getState()
        .boosts.filter((boost: any) => boost.source === 'invite').length;
    });
    expect(inviteBoosts).toBe(2);

    const duplicate = await page.evaluate(async (inviter, invitee) => {
      const response = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviterAddress: inviter, inviteeAddress: invitee }),
      });
      return response.json();
    }, INVITER, MOCK_ADDRESS);

    expect(duplicate.reason).toBe('duplicate');
    expect(claimCount).toBe(2);

    const inviteBoostsAfter = await page.evaluate(() => {
      const store = (window as any).__rubbleRewardBoostStore;
      if (!store) return 0;
      return store
        .getState()
        .boosts.filter((boost: any) => boost.source === 'invite').length;
    });
    expect(inviteBoostsAfter).toBe(2);
  });
});
