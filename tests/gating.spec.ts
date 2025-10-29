import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('wallet + trial gate', () => {
  test('gates play, remembers wallet, and keeps gameplay HUD clean', async ({ page }) => {
    await page.addInitScript(() => {
      if (window.name !== 'rubble-playwright') {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.name = 'rubble-playwright';
      }
    });
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // No wallet: gate overlay blocks gameplay.
    await expect(page.getByTestId('identity-chip')).toHaveCount(0);
    await page.getByTestId('play-button').click();
    const gateOverlay = page.getByTestId('play-gate');
    await expect(gateOverlay).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);
    const playFreeButton = page.getByTestId('gate-play-free');
    if (await playFreeButton.count()) {
      await expect(playFreeButton).toBeEnabled();
    }

    // Connect wallet once.
    await page.getByTestId('gate-connect-wallet').click();
    await expect(gateOverlay).toHaveCount(0);
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.getByTestId('identity-chip')).toBeVisible();
    await expect(page.getByTestId('bubbles-badge')).toHaveText(/●\s*\d+/);
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('rubble:remember'))).toBe('1');

    // Copy address toast via menu.
    await page.getByTestId('identity-menu-button').click();
    await page.getByTestId('menu-copy-address').click();
    await expect(page.getByText('Address copied!')).toBeVisible();

    // Reload to verify remember-me hides Connect.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.getByTestId('identity-chip')).toBeVisible();

    // Trial run should start gameplay immediately.
    await page.getByTestId('play-button').click();
    const stage = page.getByTestId('game-stage');
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('hud-root')).toBeVisible();
    await expect(page.getByTestId('identity-chip')).toHaveCount(0);
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);

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

    // Exit back home to consume the trial.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Exit to Home' }).click();
    await expect(page.getByTestId('play-button')).toBeVisible();

    // Without tickets the no-runs dialog appears.
    await page.getByTestId('play-button').click();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);
    await page.getByTestId('no-runs-dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('no-runs-dialog')).toHaveCount(0);

    // Grant a retry ticket and reload to refresh state.
    await page.evaluate(() => {
      window.localStorage.setItem('rubble:tickets', '1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('identity-chip')).toBeVisible();

    // Ticket run should enter gameplay with wallet UI hidden.
    await page.getByTestId('play-button').click();
    await expect(page.getByTestId('game-stage')).toBeVisible();
    await expect(page.getByTestId('identity-chip')).toHaveCount(0);
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);

    // Exit to finish the flow.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Exit to Home' }).click();
    await expect(page.getByTestId('play-button')).toBeVisible();

    const gateState = await page.evaluate(() => window.rubbleGateState ?? null);
    if (gateState) {
      console.log(
        `GATE: connected=${gateState.connected} remember=${gateState.remember} trial=${gateState.trial} eligible=${gateState.eligible}`
      );
    }
    const headerState = await page.evaluate(() => window.rubbleHeaderState ?? null);
    if (headerState) {
      console.log(
        `HEADER: short="${headerState.short}" bubbles=${headerState.bubbles} toastCopy=${headerState.toastCopy}`
      );
    }
    const runState = await page.evaluate(() => window.rubbleRunState ?? null);
    if (runState) {
      console.log(
        `RUN: started=${runState.started} ended=${runState.ended} nextEligible=${runState.nextEligible}`
      );
    }
  });
});
