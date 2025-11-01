import { test, expect, Page } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

async function waitForStores(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).__rubbleStore));
}

test.describe('end of run overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    });
    await initWalletStub(page);
  });

  test('displays summary data and allows replay gating', async ({ page }) => {
    await page.route('**/api/leaderboard/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 800, rank: null, season: 'S1' }),
      });
    });
    await page.route('**/api/leaderboard/submit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 1200, rank: null, season: 'S1', txHash: '0x1' }),
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
          score: 1200,
          bestCombo: 15,
          streak: 9,
          energyOrbsCollected: 5,
          entryMode: 'paid',
          rareHits: 2,
        },
        treasureFound: true,
        now: 55_000,
        phase: 'summary',
        startedAt: now,
      }));
    });

    await page.waitForResponse('**/api/leaderboard/submit');

    await expect(page.getByText('Your Score')).toBeVisible();
    await expect(page.locator('text=Your Score').locator('xpath=..')).toContainText('1,200');
    await expect(page.locator('text=Best Score').locator('xpath=..')).toContainText('1,200');
    await expect(page.getByText('Rank')).toBeVisible();
    await expect(page.getByText('Achievements')).toBeVisible();
    await expect(page.getByText('Combo Chain 10+')).toBeVisible();
    await expect(page.getByText('Rare Bubble Hit')).toBeVisible();
    await expect(page.getByText('Treasure Found')).toBeVisible();

    const replayButton = page.getByRole('button', { name: /Play Again/ });
    await expect(replayButton).toBeVisible();
    await replayButton.click();

    await page.waitForFunction(() => {
      const store = (window as any).__rubbleStore;
      return store?.getState().phase === 'gate';
    });
  });
});
