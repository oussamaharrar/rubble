import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('Rare and treasure bubbles', () => {
  test('rare bubble tap awards high score and visual pop', async ({ page }) => {
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('connect-wallet-home').click();
    await page.getByTestId('play-button').click();

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await page.evaluate(() => {
      const store = (window as any).__rubbleGameStore;
      if (!store) throw new Error('game store missing');
      const now = Date.now();
      store.setState({
        phase: 'playing',
        now,
        bubbles: [
          {
            id: 'test-rare',
            x: 200,
            y: 280,
            r: 46,
            color: 'pink',
            vx: 0,
            vy: 0,
            createdAt: now,
            kind: 'rare',
          },
        ],
      });
    });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const clickX = (box?.x ?? 0) + 200;
    const clickY = (box?.y ?? 0) + 280;
    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(100);

    const score = await page.evaluate(() => (window as any).__rubbleGameStore?.getState().stats.score ?? 0);
    expect(score).toBeGreaterThanOrEqual(25);
  });

  test('treasure bubble grants boost entry', async ({ page }) => {
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('connect-wallet-home').click();
    await page.getByTestId('play-button').click();

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await page.evaluate(() => {
      const game = (window as any).__rubbleGameStore;
      const boosts = (window as any).__rubbleBoostStore;
      if (!game || !boosts) throw new Error('stores missing');
      const now = Date.now();
      boosts.setState({ boosts: [] });
      game.setState({
        phase: 'playing',
        now,
        bubbles: [
          {
            id: 'test-treasure',
            x: 220,
            y: 320,
            r: 48,
            color: 'yellow',
            vx: 0,
            vy: 0,
            createdAt: now,
            kind: 'treasure',
          },
        ],
      });
    });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const clickX = (box?.x ?? 0) + 220;
    const clickY = (box?.y ?? 0) + 320;
    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(120);

    const boostSources = await page.evaluate(() =>
      ((window as any).__rubbleBoostStore?.getState().boosts ?? []).map((item: { source: string }) => item.source)
    );
    expect(boostSources).toContain('treasure');
  });
});
