import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('end-of-run overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ address }) => {
      try {
        window.localStorage.clear();
        const key = (() => {
          const now = new Date();
          const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
          return `rubble:trial:${stamp}:${address.toLowerCase()}`;
        })();
        window.localStorage.setItem(key, 'available');
        window.localStorage.setItem('rubble:tickets', '0');
      } catch {
        /* ignore */
      }
    }, { address: MOCK_ADDRESS });
    await initWalletStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('overlay shows stats and actions and play again opens gate', async ({ page }) => {
    let onchainBest = 300;

    await page.route('**/api/leaderboard/me**', async (route) => {
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
          runId: 'server-run-2',
          token: 'token',
          payload: { address: MOCK_ADDRESS, nonce: 'def', issuedAt: Date.now() },
        }),
      });
    });

    await page.route('**/api/leaderboard/submit', async (route) => {
      onchainBest = 1200;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 1200 }),
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    const connectButton = page.getByTestId('connect-wallet-home');
    await connectButton.waitFor({ state: 'attached', timeout: 15000 }).catch(() => null);
    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click();
    }
    await page.getByTestId('play-button').click();
    await page.waitForSelector('[data-testid="game-stage"]');

    await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      const state = store.getState();
      store.setState({
        stats: { ...state.stats, score: 1200, bestCombo: 14, rareHits: 3 },
        treasureFound: true,
      });
      store.getState().endRun();
    });

    const overlay = page.getByTestId('end-of-run-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.getByText('Your Score')).toBeVisible();
    await expect(page.getByTestId('best-score-value')).toHaveText('1200');
    await expect(page.getByText('Congrats! Personal Best')).toBeVisible();
    await expect(page.getByText('Combo Master')).toBeVisible();
    await expect(page.getByText('Rare Hunter')).toBeVisible();
    await expect(page.getByText('Treasure Seeker')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share on Farcaster' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Leaderboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible();

    await page.getByRole('button', { name: 'Play Again' }).click();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();
  });
});
