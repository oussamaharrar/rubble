import { test, expect, Page } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

declare global {
  interface Window {
    __rubbleOriginalRandom?: () => number;
  }
}

async function waitForStores(page: Page) {
  await page.waitForFunction(() => {
    return Boolean((window as any).__rubbleStore && (window as any).__rubbleRewardBoostStore);
  });
}

test.describe('gating integration with reward boosts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ address }) => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
      const now = new Date();
      const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
        now.getUTCDate()
      ).padStart(2, '0')}`;
      const key = `rubble:trial:${stamp}:${address.toLowerCase()}`;
      window.localStorage.setItem(key, 'used');
      window.localStorage.setItem('rubble:tickets', '0');
    }, { address: MOCK_ADDRESS });
    await page.addInitScript(() => {
      (window as any).__rubbleOriginalRandom = Math.random;
      Math.random = () => 0;
    });
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStores(page);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      if (window.__rubbleOriginalRandom) {
        Math.random = window.__rubbleOriginalRandom;
        delete window.__rubbleOriginalRandom;
      }
    }).catch(() => {
      // ignore if page already closed
    });
  });

  test('daily reward boost enables a single gated play', async ({ page }) => {
    const playButton = page.getByRole('button', { name: "PLAY Bubble’it!" });
    await expect(playButton).toBeVisible();

    await playButton.click();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForStores(page);

    const giftButton = page.getByRole('button', { name: 'Claim daily reward' });
    await giftButton.click();
    await expect(page.getByText('You claimed today’s boost! 🎉')).toBeVisible();

    const boostBeforePlay = await page.evaluate(() => {
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!rewardStore) return [];
      return rewardStore.getState().boosts.map((boost: any) => boost.source);
    });
    expect(boostBeforePlay).toContain('daily');

    const playAfterReward = page.getByRole('button', { name: "PLAY Bubble’it!" });
    await playAfterReward.click();

    await expect(page.getByTestId('game-stage')).toBeVisible();

    const boostState = await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      return {
        rewardBoostUsed: store?.getState().rewardBoostUsed ?? null,
        hasDaily: rewardStore ? rewardStore.getState().boosts.some((boost: any) => boost.source === 'daily') : false,
        phase: store?.getState().phase ?? null,
      };
    });
    expect(boostState.rewardBoostUsed).toBe('daily');
    expect(boostState.hasDaily).toBeFalsy();
    expect(boostState.phase === 'playing' || boostState.phase === 'intro').toBeTruthy();

    await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      store?.getState().endRun();
    });
    await page.waitForTimeout(250);

    const playAgainButton = page.getByRole('button', { name: "PLAY Bubble’it!" });
    await playAgainButton.click();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();
  });
});
