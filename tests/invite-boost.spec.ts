import { test, expect, Page } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

async function waitForStores(page: Page) {
  await page.waitForFunction(() => {
    return Boolean((window as any).__rubbleRewardBoostStore && (window as any).__rubbleStore);
  });
}

test.describe('invite sharing rewards', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore storage issues
      }
    });
    await page.addInitScript(() => {
      const originalOpen = window.open;
      (window as any).__originalOpen = originalOpen;
      window.open = ((
        _url?: string,
        _target?: string,
        _features?: string
      ) => {
        const stub: any = { closed: false };
        setTimeout(() => {
          stub.closed = true;
        }, 50);
        return stub as Window;
      }) as typeof window.open;
    });
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStores(page);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      if ((window as any).__originalOpen) {
        window.open = (window as any).__originalOpen;
        delete (window as any).__originalOpen;
      }
    }).catch(() => {
      // ignore if page unavailable
    });
  });

  test('sharing grants single invite boost per day', async ({ page }) => {
    const inviteButton = page.getByRole('button', { name: 'Invite' });
    await expect(inviteButton).toBeVisible();

    await inviteButton.click();

    await expect(page.getByText('Thanks for sharing! +1 Boost added 🎁')).toBeVisible();

    await expect(inviteButton).toBeDisabled();

    const sources = await page.evaluate(() => {
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!rewardStore) return [];
      return rewardStore.getState().boosts.map((boost: any) => boost.source);
    });
    expect(sources.filter((source: string) => source === 'invite').length).toBe(1);

    const shareKey = await page.evaluate(() => {
      const now = new Date();
      const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
        now.getUTCDate()
      ).padStart(2, '0')}`;
      const key = `rubble:shared:${stamp}`;
      return { key, value: window.localStorage.getItem(key) };
    });
    expect(shareKey.value).toBe('done');

    const sourcesAfter = await page.evaluate(() => {
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!rewardStore) return [];
      return rewardStore.getState().boosts.map((boost: any) => boost.source);
    });
    expect(sourcesAfter.filter((source: string) => source === 'invite').length).toBe(1);
  });
});
