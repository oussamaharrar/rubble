import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('farcaster-first connect flow', () => {
  test('prompts Farcaster first, then wallet connect before play', async ({ page }) => {
    await page.addInitScript(() => {
      const sentinel = '__rubble_e2e_init__farcaster_connect__';
      try {
        if (!window.sessionStorage.getItem(sentinel)) {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.sessionStorage.setItem(sentinel, '1');
        }
      } catch {
        // ignore test storage errors
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
        body: JSON.stringify({
          ok: true,
          fid: 42,
          username: 'user',
          displayName: 'Test User',
          pfpUrl: 'https://example.com/avatar.png',
        }),
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('farcaster-auth-card')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });

    const walletLinkCard = page.getByTestId('wallet-link-card');
    await expect(walletLinkCard).toBeVisible();
    const connectButton = page.getByTestId('wallet-link-connect');
    await expect(connectButton).toBeVisible();

    await connectButton.click();

    await expect(walletLinkCard).toHaveCount(0);

    const identityChip = page.locator('[aria-label^="Connected wallet"]');
    await expect(identityChip).toContainText('@user');
    await expect(identityChip).toContainText('…');

    await page.getByTestId('play-button').click();

    await expect(page.getByTestId('play-gate')).toBeVisible();
    await expect(page.getByTestId('gate-play-free')).toBeVisible();

    // close gate and ensure remembered wallet retains short badge
    await page.getByRole('button', { name: 'Close' }).click();

    const remembered = await page.evaluate(() => window.localStorage.getItem('rubble:address'));
    expect(remembered?.toLowerCase()).toBe(MOCK_ADDRESS.toLowerCase());
  });
});
