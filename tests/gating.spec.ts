import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('wallet + trial gate', () => {
  test('enforces eligibility and safe spawns', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Without wallet, play opens gate overlay.
    await page.getByTestId('play-button').click();
    const gateOverlay = page.getByTestId('play-gate');
    await expect(gateOverlay).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);

    // Attach wallet stub and connect.
    await page.getByTestId('gate-connect-wallet').click();
    await expect(page.getByTestId('gate-connect-wallet')).toHaveCount(0);
    await expect(page.getByTestId('wallet-balance')).toBeVisible();

    // Play with free trial.
    await page.getByTestId('play-button').click();
    const playFree = page.getByTestId('gate-play-free');
    if (await playFree.isVisible()) {
      await playFree.click();
    }
    const stage = page.getByTestId('game-stage');
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('hud-root')).toBeVisible();
    await expect(page.getByTestId('hud-score')).toBeVisible();
    await expect(page.getByTestId('hud-combo')).toBeVisible();
    await expect(page.getByTestId('hud-timer')).toBeVisible();
    await expect(page.getByText('Shop')).toHaveCount(0);

    // Validate safe spawn zones from instrumented snapshot.
    const spawnSnapshotHandle = await page.waitForFunction(() => window.rubbleLastSpawnSnapshot ?? null);
    const spawnSnapshot = (await spawnSnapshotHandle.jsonValue()) as Array<{ x: number; y: number; r: number }>;
    const stageBox = await stage.boundingBox();
    expect(stageBox?.width ?? 0).toBeGreaterThan(200);
    expect(stageBox?.height ?? 0).toBeGreaterThan(200);
    const width = stageBox!.width;
    const height = stageBox!.height;
    const safeLeft = width * 0.08;
    const safeRight = width * 0.92;
    const safeTop = height * 0.12;
    for (const bubble of spawnSnapshot) {
      expect(bubble.x - bubble.r).toBeGreaterThanOrEqual(safeLeft - 2);
      expect(bubble.x + bubble.r).toBeLessThanOrEqual(safeRight + 2);
      expect(bubble.y - bubble.r).toBeGreaterThanOrEqual(safeTop - 2);
    }

    console.log('SPAWN: safeZonesRespected=true');

    // Pause and exit to home to consume the trial.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Exit to Home' }).click();
    await expect(page.getByTestId('play-button')).toBeVisible();

    // Attempt to play without eligibility after consuming trial.
    await page.getByTestId('play-button').click();
    await expect(page.getByText('Earn / Buy')).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);

    // Reduced motion smoke test.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.getByTestId('play-button')).toBeVisible();
  });
});
