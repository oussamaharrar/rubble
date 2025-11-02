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
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
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

    await page.getByTestId('connect-wallet-home').click();
    await expect(page.locator('[aria-label^="Connected wallet"]')).toHaveCount(1);
    await page.waitForTimeout(100);

    await playButton.click();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await waitForStores(page);
    if (await page.getByTestId('connect-wallet-home').isVisible()) {
      await page.getByTestId('connect-wallet-home').click();
      await page.waitForTimeout(100);
    }

    const giftButton = page.getByTestId('daily-reward-button');
    await giftButton.click();
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const rewardStore = (window as any).__rubbleRewardBoostStore;
          if (!rewardStore) return false;
          return rewardStore
            .getState()
            .boosts.some((boost: any) => boost.source === 'daily');
        });
      })
      .toBe(true);

    const boostBeforePlay = await page.evaluate(() => {
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!rewardStore) return [];
      return rewardStore.getState().boosts.map((boost: any) => boost.source);
    });
    expect(boostBeforePlay).toContain('daily');

    const playAfterReward = page.getByRole('button', { name: "PLAY Bubble’it!" });
    await playAfterReward.click();

    await expect(page.getByTestId('game-stage')).toBeVisible({ timeout: 20000 });

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

    const overlayPlayAgain = page.getByRole('button', { name: 'Play Again' });
    await overlayPlayAgain.click();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();
  });
});
