import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('onchain leaderboard integration', () => {
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

  test('submitting a score updates best score display', async ({ page }) => {
    let submitCount = 0;

    await page.route('**/api/leaderboard/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 500, season: 'S1' }),
      });
    });

    await page.route('**/api/run/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          token: 'mock-token',
          payload: { address: MOCK_ADDRESS, nonce: 'abc', issuedAt: Date.now() },
          runId: 'abc',
        }),
      });
    });

    await page.route('**/api/leaderboard/submit', async (route) => {
      submitCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 800 }),
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('connect-wallet-home').click();
    await page.getByTestId('play-button').click();

    await page.waitForSelector('[data-testid="game-stage"]');

    await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      const state = store.getState();
      store.setState({
        stats: { ...state.stats, score: 780, bestCombo: 12, rareHits: 2 },
      });
      store.getState().endRun();
    });

    const overlay = page.getByTestId('end-of-run-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId('best-score-value')).toHaveText('800');
    expect(submitCount).toBe(1);
  });
});
