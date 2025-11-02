import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('end-of-run overlay', () => {
  test('shows achievements and allows replay', async ({ page }) => {
    await page.route('**/api/run/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, runId: 'run-42', token: 'token-42' }),
      });
    });

    let bestCounter = 0;
    await page.route('**/api/leaderboard/me**', async (route) => {
      bestCounter += 1;
      const bestScore = bestCounter === 1 ? 120 : 200;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore, season: 'S1' }),
      });
    });

    await page.route('**/api/leaderboard/submit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 200 }),
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

    await page.getByTestId('play-button').click();
    await page.waitForSelector('[data-testid="game-stage"]');

    await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      if (!store) return;
      const state = store.getState();
      store.setState({
        ...state,
        stats: {
          ...state.stats,
          score: 200,
          bestCombo: 14,
          rareHits: 3,
        },
        treasureFound: true,
      });
      store.getState().endRun();
    });

    const overlay = page.getByTestId('end-of-run-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.getByText('Your Score')).toBeVisible();
    await expect(page.getByTestId('best-score-value')).toHaveText('200');
    await expect(page.getByText('Congrats! Personal Best.')).toBeVisible();

    await expect(page.getByText('Combo Master')).toBeVisible();
    await expect(page.getByText('Rare Hunter')).toBeVisible();
    await expect(page.getByText('Treasure Seeker')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Share on Farcaster' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Leaderboard' })).toBeVisible();
    const playAgainButton = page.getByRole('button', { name: 'Play Again' });
    await expect(playAgainButton).toBeVisible();

    await playAgainButton.click();
    await page.waitForSelector('[data-testid="game-stage"]');
  });
});
