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

  test('submitting a score updates best score display after refresh', async ({ page }) => {
    let submitCount = 0;
    let bestFetchCount = 0;
    let onchainBest = 500;

    await page.route('**/api/leaderboard/me**', async (route) => {
      bestFetchCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: onchainBest, season: 'S1' }),
      });
    });

    await page.route('**/api/run/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          runId: 'server-run-1',
          token: 'mock-token',
          payload: { address: MOCK_ADDRESS, nonce: 'abc', issuedAt: Date.now() },
        }),
      });
    });

    await page.route('**/api/leaderboard/submit', async (route) => {
      submitCount += 1;
      onchainBest = 830;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 780 }),
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
    await expect(page.getByTestId('best-score-value')).toHaveText('830');
    expect(submitCount).toBe(1);
    expect(bestFetchCount).toBeGreaterThanOrEqual(2);
  });
});
