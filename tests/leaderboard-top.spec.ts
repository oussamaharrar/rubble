import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

function addWalletInit(page: import('@playwright/test').Page) {
  return page.addInitScript(({ address }) => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
    window.localStorage.setItem('rubble:remember', '1');
    window.localStorage.setItem('rubble:address', address);
    window.localStorage.setItem('rubble:tickets', '1');
  }, { address: MOCK_ADDRESS });
}

test.describe('leaderboard top panel', () => {
  test('renders cached top leaderboard entries when available', async ({ page }) => {
    const topItems = [
      { address: '0xaaaabbbbccccddddeeeeffff0000111122223333', bestScore: 999 },
      { address: '0xbbbbccccddddeeeeffff00001111222233334444', bestScore: 750 },
      { address: '0xccccddddeeeeffff000011112222333344445555', bestScore: 600 },
    ];
    await page.route('**/api/leaderboard/top', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, items: topItems, updatedAt: new Date('2024-08-01T12:00:00Z').toISOString() }),
      });
    });
    await page.route('**/api/leaderboard/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, bestScore: 420, season: 'S1' }),
      });
    });

    await addWalletInit(page);
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Leaderboard' }).click();
    const modal = page.getByTestId('leaderboard-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('leaderboard-top-list')).toBeVisible();

    const firstItem = modal.getByTestId('leaderboard-item-0');
    await expect(firstItem).toContainText('999');
    await expect(firstItem).toContainText('0xaaaa…3333');

    const secondItem = modal.getByTestId('leaderboard-item-1');
    await expect(secondItem).toContainText('750');
    await expect(secondItem).toContainText('0xbbbb…4444');

    const thirdItem = modal.getByTestId('leaderboard-item-2');
    await expect(thirdItem).toContainText('600');
    await expect(thirdItem).toContainText('0xcccc…5555');

    await expect(modal.getByTestId('leaderboard-best-value')).toHaveText('420');
  });

  test('falls back to personal best when cached top entries missing', async ({ page }) => {
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
        body: JSON.stringify({ ok: true, bestScore: 512, season: 'S2' }),
      });
    });

    await addWalletInit(page);
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Leaderboard' }).click();
    const modal = page.getByTestId('leaderboard-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Your Rank Only')).toBeVisible();
    await expect(modal.getByTestId('leaderboard-best-value')).toHaveText('512');
  });
});
