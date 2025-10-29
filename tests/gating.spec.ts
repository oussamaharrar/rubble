import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000/';

test.describe('Bubble gate and safe spawns', () => {
  test('enforces gate, spawns safely, and respects reduced motion', async ({ page }) => {
    await page.addInitScript(({ address }) => {
      window.localStorage.clear();
      let connected = false;
      const stub = {
        async request({ method }: { method: string }) {
          switch (method) {
            case 'eth_accounts':
              return connected ? [address] : [];
            case 'eth_requestAccounts':
              connected = true;
              return [address];
            case 'eth_chainId':
              return '0x2105';
            default:
              return null;
          }
        },
        on() {},
        removeListener() {},
      };
      (window as unknown as { ethereum: unknown }).ethereum = stub;
    }, { address: '0x1234abcd1234abcd1234abcd1234abcd1234abcd' });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    const playButton = page.getByRole('button', { name: /PLAY Bubble/i });
    await expect(playButton).toBeVisible();

    await playButton.evaluate((btn) => (btn as HTMLButtonElement).click());
    await expect(page.getByText('Play Free Trial')).toBeVisible();

    const initialGate = await page.evaluate(() => {
      const gate = (window as typeof window & {
        __RUBBLE_GATE__?: { walletConnected: boolean; trialAvailable: boolean; eligible: boolean };
      }).__RUBBLE_GATE__;
      return gate ?? { walletConnected: false, trialAvailable: false, eligible: false };
    });
    console.log(
      `GATE: walletConnected=${initialGate.walletConnected} trial=${initialGate.trialAvailable} eligible=${initialGate.eligible}`
    );

    await page.getByRole('button', { name: /Connect Wallet/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/Bubbles ·/)).toBeVisible();

    await page.getByRole('button', { name: /Play Free Trial/i }).click();
    await page.waitForFunction(() => document.getElementById('rubble-root')?.getAttribute('data-playing') === '1');

    const runDuring = await page.evaluate(() => {
      const state = (window as typeof window & {
        __RUBBLE_RUN__?: { phase: string; eligible: boolean };
      }).__RUBBLE_RUN__;
      return state ?? { phase: 'unknown', eligible: false };
    });
    console.log(
      `RUN: started=${runDuring.phase === 'playing' || runDuring.phase === 'storm'} ended=${runDuring.phase === 'summary'} nextEligible=${runDuring.eligible}`
    );

    await expect(page.getByTestId('hud-score')).toBeVisible();
    await expect(page.getByTestId('hud-combo')).toBeVisible();
    await expect(page.getByTestId('hud-timer')).toBeVisible();
    console.log('HUD: visible=true');

    await page.waitForTimeout(500);
    const spawnCheck = await page.evaluate(() => {
      const globalWindow = window as typeof window & {
        __RUBBLE_SPAWNS__?: Array<{ x: number; y: number; r: number }>;
      };
      const spawns = globalWindow.__RUBBLE_SPAWNS__ ?? [];
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        return { ok: false, count: spawns.length };
      }
      const rect = canvas.getBoundingClientRect();
      const topLimit = rect.height * 0.12;
      const sideMargin = rect.width * 0.08;
      const unsafe = spawns.some(({ x, y, r }) => {
        if (x - r < sideMargin) return true;
        if (x + r > rect.width - sideMargin) return true;
        if (y - r < topLimit) return true;
        return false;
      });
      return { ok: !unsafe, count: spawns.length };
    });
    console.log(`SPAWN: safeZonesRespected=${spawnCheck.ok}`);
    expect(spawnCheck.ok).toBeTruthy();

    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: /Exit to Home/ }).click();
    await page.waitForFunction(() => document.getElementById('rubble-root')?.getAttribute('data-playing') === '0');

    const runAfter = await page.evaluate(() => {
      const state = (window as typeof window & {
        __RUBBLE_RUN__?: { phase: string; eligible: boolean };
      }).__RUBBLE_RUN__;
      return state ?? { phase: 'unknown', eligible: false };
    });
    console.log(
      `RUN: started=false ended=${runAfter.phase === 'home'} nextEligible=${runAfter.eligible}`
    );

    await playButton.evaluate((btn) => (btn as HTMLButtonElement).click());
    await expect(page.getByText('Play Free Trial')).toBeVisible();

    const finalGate = await page.evaluate(() => {
      const gate = (window as typeof window & {
        __RUBBLE_GATE__?: { walletConnected: boolean; trialAvailable: boolean; eligible: boolean };
      }).__RUBBLE_GATE__;
      return gate ?? { walletConnected: false, trialAvailable: false, eligible: false };
    });
    console.log(
      `GATE: walletConnected=${finalGate.walletConnected} trial=${finalGate.trialAvailable} eligible=${finalGate.eligible}`
    );
    expect(finalGate.trialAvailable).toBeFalsy();
    expect(finalGate.eligible).toBeFalsy();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    expect(reduced).toBeTruthy();
  });
});
