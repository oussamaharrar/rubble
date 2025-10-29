import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('wallet + trial gate', () => {
  test('one-time connect, remember me, and eligibility gating', async ({ page }) => {
    await page.addInitScript(() => {
      const sentinel = '__rubble_e2e_init__';
      try {
        if (!window.sessionStorage.getItem(sentinel)) {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.sessionStorage.setItem(sentinel, '1');
        }
      } catch {
        // ignore
      }
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => Promise.resolve(),
        },
      });
    });
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Without wallet, play opens gate overlay.
    await page.getByTestId('play-button').click();
    const gateOverlay = page.getByTestId('play-gate');
    await expect(gateOverlay).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);

    // Connect wallet once.
    await page.getByTestId('gate-connect-wallet').click();
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.getByTestId('wallet-balance')).toBeVisible();

    // Copy address toast via header menu.
    await page.getByRole('button', { name: '⋯' }).click();
    await page.getByRole('menuitem', { name: 'Copy address' }).click();
    await expect(page.getByText('Address copied!')).toBeVisible();

    // Remember me keeps connection hidden on reload.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.locator('[aria-label^="Connected wallet"]')).toHaveCount(1);

    // Start a trial run.
    await page.getByTestId('play-button').click();
    const stage = page.getByTestId('game-stage');
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('hud-root')).toBeVisible();
    await expect(page.getByTestId('wallet-balance')).toHaveCount(0);

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

    // Next play opens no-runs dialog.
    await page.getByTestId('play-button').click();
    const noRunsDialog = page.getByTestId('no-runs-dialog');
    await expect(noRunsDialog).toBeVisible();
    await page.getByRole('button', { name: 'Invite a Friend' }).click();
    await expect(page.getByText('Boost granted!')).toBeVisible();
    await expect(page.getByTestId('no-runs-dialog')).toHaveCount(0);

    // Boost enables another run.
    await page.getByTestId('play-button').click();
    await expect(page.getByTestId('game-stage')).toBeVisible();
    await expect(page.getByTestId('wallet-balance')).toHaveCount(0);

    // Exit back to home.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Exit to Home' }).click();
    await expect(page.getByTestId('play-button')).toBeVisible();
  });
});
