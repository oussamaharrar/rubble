import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('leaderboard submission', () => {
  test('records best score and shows end-of-run overlay', async ({ page }) => {
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const connectButton = page.getByTestId('connect-wallet-home');
    if (await connectButton.isVisible()) {
      await connectButton.click();
    }
    await expect(page.getByTestId('wallet-balance')).toBeVisible();

    const beforeResponse = await page.request.get(`/api/leaderboard/me?address=${MOCK_ADDRESS}`);
    const beforeJson = (await beforeResponse.json()) as { ok: boolean; bestScore?: number };
    expect(beforeJson.ok).toBeTruthy();
    expect(beforeJson.bestScore ?? 0).toBe(0);

    await page.getByTestId('play-button').click();
    await expect(page.getByTestId('game-stage')).toBeVisible();

    const score = 4321;
    await page.evaluate((value) => {
      const store = window.__rubbleStore;
      if (!store) return;
      const state = store.getState();
      store.setState({
        stats: {
          ...state.stats,
          score: value,
          bestCombo: 12,
          streak: 9,
          energyOrbsCollected: state.stats.energyOrbsCollected + 1,
        },
        rareHits: 2,
        treasureFound: true,
      });
      state.setPhase('summary');
    }, score);

    await page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/leaderboard/submit') && response.request().method() === 'POST'
    );

    const overlay = page.getByTestId('end-of-run-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText('Best Score')).toBeVisible();
    const formattedScore = new Intl.NumberFormat('en-US').format(score);
    await expect(overlay.getByText(formattedScore)).toBeVisible();

    const afterResponse = await page.request.get(`/api/leaderboard/me?address=${MOCK_ADDRESS}`);
    const afterJson = (await afterResponse.json()) as { ok: boolean; bestScore?: number };
    expect(afterJson.ok).toBeTruthy();
    expect(afterJson.bestScore).toBe(score);
  });
});
