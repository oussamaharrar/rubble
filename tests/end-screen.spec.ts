import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('end of run screen', () => {
  test('displays achievements and gating actions', async ({ page }) => {
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const connectButton = page.getByTestId('connect-wallet-home');
    if (await connectButton.isVisible()) {
      await connectButton.click();
    }

    await page.getByTestId('play-button').click();
    await expect(page.getByTestId('game-stage')).toBeVisible();

    const score = 6789;
    await page.evaluate((value) => {
      const store = window.__rubbleStore;
      if (!store) return;
      const state = store.getState();
      store.setState({
        stats: {
          ...state.stats,
          score: value,
          bestCombo: 15,
          streak: 12,
          energyOrbsCollected: state.stats.energyOrbsCollected + 2,
        },
        rareHits: 3,
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
    const formattedScore = new Intl.NumberFormat('en-US').format(score);
    await expect(overlay.getByText('Your Score')).toBeVisible();
    await expect(overlay.getByText(formattedScore)).toBeVisible();
    await expect(overlay.getByText('Best Score')).toBeVisible();
    await expect(overlay.getByText('Combo 10+')).toBeVisible();
    await expect(overlay.getByText('Rare Bubble Hunter')).toBeVisible();
    await expect(overlay.getByText('Treasure Diver')).toBeVisible();
    await expect(overlay.getByRole('button', { name: 'Share on Farcaster' })).toBeVisible();
    await expect(overlay.getByRole('button', { name: 'Play Again' })).toBeVisible();
    await expect(overlay.getByRole('button', { name: 'View Leaderboard' })).toBeVisible();

    await overlay.getByRole('button', { name: 'Play Again' }).click();
    await expect(overlay).not.toBeVisible();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();
  });
});
