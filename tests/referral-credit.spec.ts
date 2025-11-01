import { test, expect, Page } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

async function waitForStores(page: Page) {
  await page.waitForFunction(() => {
    return Boolean((window as any).__rubbleStore && (window as any).__rubbleRewardBoostStore);
  });
}

test.describe('referral credit claims', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore storage issues
      }
    });
    await initWalletStub(page);
  });

  test('claiming referral bonus happens once per invitee', async ({ page }) => {
    const inviter = '0x9999999999999999999999999999999999999999';
    const requests: any[] = [];

    await page.route('**/api/referral/claim', async (route) => {
      const payload = await route.request().postDataJSON();
      requests.push(payload);
      const okResponse = {
        ok: true,
        reward: { type: 'boost', amount: 1 },
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okResponse) });
    });

    await page.goto(`${BASE_URL}?ref=${inviter}`, { waitUntil: 'domcontentloaded' });
    await waitForStores(page);

    await page.waitForRequest('**/api/referral/claim');

    const inviteBoosts = await page.evaluate(() => {
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!rewardStore) return [];
      return rewardStore.getState().boosts.map((boost: any) => boost.source);
    });
    expect(inviteBoosts).toContain('invite');

    expect(requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
      inviterAddress: inviter.toLowerCase(),
      inviteeAddress: MOCK_ADDRESS.toLowerCase(),
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForStores(page);
    await page.waitForTimeout(300);

    expect(requests.length).toBe(1);
  });
});
