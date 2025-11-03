import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

const KV_ITEMS = [
  { address: '0x1111111111111111111111111111111111111111', bestScore: 420 },
  { address: '0x2222222222222222222222222222222222222222', bestScore: 360 },
  { address: '0x3333333333333333333333333333333333333333', bestScore: 300 },
];

test.describe('leaderboard top panel', () => {
  test('shows cached top entries when KV is available', async ({ page }) => {
    await page.route('**/api/leaderboard/top', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, items: KV_ITEMS, updatedAt: '2024-04-01T12:00:00.000Z' }),
      });
    });

    await page.route('**/api/leaderboard/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 512, season: 'S1' }),
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

    await page.getByRole('button', { name: 'Scoreboard' }).click();

    const list = page.getByTestId('leaderboard-top-list');
    await expect(list).toBeVisible();
    await expect(page.getByTestId('leaderboard-best-score')).toHaveText('512');
    await expect(page.getByTestId('leaderboard-row-0')).toContainText('0x1111…1111');
    await expect(page.getByTestId('leaderboard-row-1')).toContainText('0x2222…2222');
    await expect(page.getByTestId('leaderboard-row-2')).toContainText('0x3333…3333');
  });

  test('falls back to personal best when KV is missing', async ({ page }) => {
    await page.route('**/api/leaderboard/top', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, items: [] }),
      });
    });

    await page.route('**/api/leaderboard/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 256, season: 'S2' }),
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

    await page.getByRole('button', { name: 'Scoreboard' }).click();

    await expect(page.getByText('Your Rank Only')).toBeVisible();
    await expect(page.getByTestId('leaderboard-best-score')).toHaveText('256');
  });
});
