import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('leaderboard submit flow', () => {
  test('refreshes best score after server-side submit', async ({ page }) => {
    await page.route('**/api/run/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, runId: 'run-1', token: 'token-1' }),
      });
    });

    let leaderboardMeCalls = 0;
    await page.route('**/api/leaderboard/me**', async (route) => {
      leaderboardMeCalls += 1;
      const bestScore = leaderboardMeCalls === 1 ? 120 : 180;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore, season: 'S1' }),
      });
    });

    let submitPayload: Record<string, unknown> | null = null;
    await page.route('**/api/leaderboard/submit', async (route) => {
      submitPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 180 }),
      });
    });

    await page.addInitScript(({ address }) => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
      window.localStorage.setItem('rubble:remember', '1');
      window.localStorage.setItem('rubble:address', address);
      window.localStorage.setItem('rubble:tickets', '3');
    }, { address: MOCK_ADDRESS });

    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const playButton = page.getByTestId('play-button');
    await expect(playButton).toBeVisible();
    await playButton.click();

    await page.waitForSelector('[data-testid="game-stage"]');

    await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      if (!store) return;
      const state = store.getState();
      store.setState({
        ...state,
        stats: {
          ...state.stats,
          score: 180,
          bestCombo: 15,
          rareHits: 2,
        },
        treasureFound: true,
      });
      store.getState().endRun();
    });

    const overlay = page.getByTestId('end-of-run-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId('best-score-value')).toHaveText('180');

    expect(submitPayload).not.toBeNull();
    expect(submitPayload?.score).toBe(180);
    expect(leaderboardMeCalls).toBeGreaterThanOrEqual(2);
  });
});
