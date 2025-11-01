import { test, expect, Page } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

async function waitForStores(page: Page) {
  await page.waitForFunction(() => {
    return Boolean((window as any).__rubbleStore);
  });
}

test.describe('onchain leaderboard integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ address }) => {
      try {
        window.localStorage.setItem('rubble:remember', '1');
        window.localStorage.setItem('rubble:address', address.toLowerCase());
      } catch {
        // ignore storage issues
      }
    }, { address: MOCK_ADDRESS });
    await initWalletStub(page);
  });

  test('submitting a score updates personal best display', async ({ page }) => {
    await page.route('**/api/leaderboard/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 900, rank: null, season: 'S1' }),
      });
    });
    await page.route('**/api/run/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'token-1', issuedAt: Date.now(), nonce: 'abc', season: 'S1' }),
      });
    });
    let submitPayload: any = null;
    await page.route('**/api/leaderboard/submit', async (route) => {
      submitPayload = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 1500, rank: null, season: 'S1', txHash: '0xabc' }),
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStores(page);

    await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      const now = Date.now();
      store.setState((state: any) => ({
        ...state,
        stats: {
          ...state.stats,
          score: 1500,
          bestCombo: 12,
          streak: 8,
          entryMode: 'paid',
          rareHits: 1,
        },
        now: 60_000,
        phase: 'summary',
        startedAt: now,
      }));
    });

    await page.waitForResponse('**/api/leaderboard/submit');

    await expect(page.getByText('Best Score')).toBeVisible();
    await expect(page.locator('text=Best Score').locator('xpath=..')).toContainText('1,500');
    await expect(page.getByText('Congrats! New personal best')).toBeVisible();
    expect(submitPayload).not.toBeNull();
    expect(submitPayload).toMatchObject({ address: MOCK_ADDRESS.toLowerCase(), score: 1500 });
  });
});
