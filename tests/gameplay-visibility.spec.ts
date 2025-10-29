import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('Bubble’it! layout', () => {
  test('stage renders with HUD overlay during gameplay', async ({ page }) => {
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const playButton = page.getByTestId('play-button');
    await expect(playButton).toBeVisible();
    const connectButton = page.getByTestId('connect-wallet-home');
    await expect(connectButton).toBeVisible();
    await connectButton.click();
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.getByTestId('wallet-balance')).toBeVisible();
    await playButton.click();

    const stage = page.getByTestId('game-stage');
    await expect(stage).toBeVisible();
    const stageBox = await stage.boundingBox();
    expect(stageBox?.width ?? 0).toBeGreaterThan(200);
    expect(stageBox?.height ?? 0).toBeGreaterThan(200);

    const hud = page.getByTestId('hud-root');
    await expect(hud).toBeVisible();
    const hudBox = await hud.boundingBox();
    expect(hudBox?.width ?? 0).toBeGreaterThan(120);

    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    expect(overflow).toBe('hidden');
  });
});
