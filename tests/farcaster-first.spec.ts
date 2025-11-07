import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('farcaster-first entry', () => {
  test('requires Farcaster identity before wallet linking', async ({ page }) => {
    await page.addInitScript(() => {
      const sentinel = '__rubble_e2e_init__farcaster__';
      try {
        if (!window.sessionStorage.getItem(sentinel)) {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.sessionStorage.setItem(sentinel, '1');
        }
      } catch {
        // ignore storage issues in tests
      }
    });

    await initWalletStub(page);

    let whoamiCalls = 0;
    await page.route('**/api/miniapp/whoami', async (route) => {
      whoamiCalls += 1;
      if (whoamiCalls === 1) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ ok: false }),
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ ok: true, fid: 1, username: 'user', pfpUrl: 'https://example.com/pfp.png' }),
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('farcaster-auth-card')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('wallet-link-card')).toBeVisible();

    await page.getByTestId('wallet-link-connect').click();

    await expect(page.getByTestId('wallet-link-card')).toHaveCount(0);

    await page.getByTestId('play-button').click();

    await expect(page.getByTestId('play-gate')).toBeVisible();
  });
});
