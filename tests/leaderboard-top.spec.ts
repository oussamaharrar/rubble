import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

test.describe('leaderboard top panel', () => {
  test('renders KV cached top items', async ({ page }) => {
    const topItems = [
      { address: MOCK_ADDRESS, bestScore: 512 },
      { address: '0x2222222222222222222222222222222222222222', bestScore: 408 },
      { address: '0x3333333333333333333333333333333333333333', bestScore: 256 },
    ];

    await page.route('**/api/leaderboard/top', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, items: topItems, updatedAt: '2024-02-01T12:00:00.000Z' }),
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
      window.localStorage.setItem('rubble:remember', '1');
      window.localStorage.setItem('rubble:address', address);
      window.localStorage.setItem('rubble:tickets', '3');
    }, { address: MOCK_ADDRESS });

    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Scoreboard' }).click();

    const leaderboardDialog = page.getByRole('dialog', { name: 'Leaderboard' });
    await expect(leaderboardDialog).toBeVisible();

    await expect(leaderboardDialog.getByText('1. 512')).toBeVisible();
    await expect(leaderboardDialog.getByText(short('0x2222222222222222222222222222222222222222'))).toBeVisible();
    await expect(leaderboardDialog.getByText(short('0x3333333333333333333333333333333333333333'))).toBeVisible();
    await expect(leaderboardDialog.getByTestId('best-score-value')).toHaveText('512');
  });

  test('falls back to personal rank when KV is unavailable', async ({ page }) => {
    let meCalls = 0;
    await page.route('**/api/leaderboard/top', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, items: [] }),
      });
    });

    await page.route('**/api/leaderboard/me**', async (route) => {
      meCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 98, season: 'S1' }),
      });
    });

    await page.addInitScript(({ address }) => {
      window.localStorage.setItem('rubble:remember', '1');
      window.localStorage.setItem('rubble:address', address);
      window.localStorage.setItem('rubble:tickets', '3');
    }, { address: MOCK_ADDRESS });

    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Scoreboard' }).click();

    const leaderboardDialog = page.getByRole('dialog', { name: 'Leaderboard' });
    await expect(leaderboardDialog).toBeVisible();
    await expect(leaderboardDialog.getByText('Your Rank Only')).toBeVisible();
    await expect(leaderboardDialog.getByTestId('best-score-value')).toHaveText('98');
    expect(meCalls).toBeGreaterThan(0);
  });
});
