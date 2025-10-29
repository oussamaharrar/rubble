import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('wallet + trial gate', () => {
  test('remembered wallet, copy toast, gating + eligibility flow', async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('__rubbleInitDone')) {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.sessionStorage.setItem('__rubbleInitDone', '1');
      }
      (navigator as any).clipboard = {
        writeText: async (value: string) => {
          window.__copied = value;
        },
      };
    });
    await initWalletStub(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('connect-wallet-home')).toBeVisible();

    // Without wallet, play opens gate overlay.
    await page.getByTestId('play-button').click();
    await expect(page.getByTestId('play-gate')).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);

    // Connect once via the gate.
    await page.getByTestId('gate-connect-wallet').click();
    await expect(page.getByTestId('play-gate')).toHaveCount(0);
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.getByTestId('wallet-identity-chip')).toBeVisible();
    await expect(page.getByText('0x12…5678')).toBeVisible();
    await expect(page.getByTestId('wallet-balance')).toContainText('●');
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('rubble:remember'))).toBe('1');

    // Copy address from the chip menu.
    await page.getByLabel('Wallet menu').click();
    await page.getByRole('menuitem', { name: 'Copy address' }).click();
    await expect(page.getByTestId('toast-message')).toContainText('Address copied!');

    // Reload and confirm silent reconnect keeps the chip visible.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.getByTestId('wallet-identity-chip')).toBeVisible();
    await expect(page.getByText('0x12…5678')).toBeVisible();

    // Play the free trial run.
    await page.getByTestId('play-button').click();
    const stage = page.getByTestId('game-stage');
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('hud-root')).toBeVisible();
    await expect(page.getByTestId('wallet-identity-chip')).toHaveCount(0);

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

    // No eligibility left should show the no-runs dialog.
    await page.getByTestId('play-button').click();
    await expect(page.getByTestId('no-runs-dialog')).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);

    // Invite a friend to gain a retry ticket via the share boost.
    await page.getByTestId('no-runs-invite').click();
    await expect(page.getByText('Thanks for spreading bubbles! +1 retry')).toBeVisible();
    await expect(page.getByRole('dialog', { name: /Boost your Bubble’it!/ })).toBeVisible();
    await page.getByTestId('more-close').click();
    await expect(page.getByTestId('no-runs-dialog')).toHaveCount(0);

    // Ticket makes the next play eligible without the gate.
    await page.getByTestId('play-button').click();
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('wallet-identity-chip')).toHaveCount(0);

    // Exit back home to finish test.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Exit to Home' }).click();
    await expect(page.getByTestId('play-button')).toBeVisible();
  });
});
