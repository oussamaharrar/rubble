import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';
const HERO_ENDPOINT = new URL('/og/bubbleit-hero-1200x630.jpg', BASE_URL).toString();
const METADATA_ENDPOINT = new URL('/api/site/metadata', BASE_URL).toString();
const ACCOUNT_ENDPOINT = new URL('/.well-known/app-account.json', BASE_URL).toString();

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

    let connected = false;
    let rememberFlag: 0 | 1 = 0;
    let trialStarted = false;
    let runStarted = false;
    let runEnded = false;
    let nextEligible = false;
    let hudVisible = false;

    // Without wallet, play opens gate overlay.
    await page.getByTestId('play-button').click();
    const gateOverlay = page.getByTestId('play-gate');
    await expect(gateOverlay).toBeVisible();
    await expect(page.getByTestId('game-stage')).toHaveCount(0);

    // Connect wallet once.
    await page.getByTestId('gate-connect-wallet').click();
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.getByTestId('wallet-balance')).toBeVisible();
    connected = true;

    // Copy address toast via header menu.
    await page.getByRole('button', { name: '⋯' }).click();
    await page.getByRole('menuitem', { name: 'Copy address' }).click();
    await expect(page.getByText('Address copied!')).toBeVisible();

    // Remember me keeps connection hidden on reload.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('connect-wallet-home')).toHaveCount(0);
    await expect(page.locator('[aria-label^="Connected wallet"]')).toHaveCount(1);
    rememberFlag = await page.evaluate(() => (window.localStorage.getItem('rubble:remember') === '1' ? 1 : 0));

    // Start a trial run.
    await page.getByTestId('play-button').click();
    const stage = page.getByTestId('game-stage');
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('hud-root')).toBeVisible();
    await expect(page.getByTestId('hud-score')).toBeVisible();
    await expect(page.getByTestId('hud-combo')).toBeVisible();
    await expect(page.getByTestId('hud-timer')).toBeVisible();
    await expect(page.getByTestId('wallet-balance')).toHaveCount(0);
    trialStarted = true;
    runStarted = true;
    hudVisible = true;

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

    console.log('SPAWN: safe=true');

    // Pause and exit to home to consume the trial.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Exit to Home' }).click();
    await expect(page.getByTestId('play-button')).toBeVisible();
    runEnded = true;

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
    nextEligible = true;

    // Exit back to home.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Exit to Home' }).click();
    await expect(page.getByTestId('play-button')).toBeVisible();

    const heroResponse = await page.request.get(HERO_ENDPOINT);
    expect(heroResponse.ok()).toBeTruthy();

    const metadataResponse = await page.request.get(METADATA_ENDPOINT);
    expect(metadataResponse.ok()).toBeTruthy();
    const metadataJson = (await metadataResponse.json()) as {
      heroImageUrl?: string;
      tagline?: string;
      ogTitle?: string;
      ogDescription?: string;
      noindex?: boolean;
    };
    expect(metadataJson.heroImageUrl).toMatch(/\/og\/bubbleit-hero-1200x630\.jpg$/);
    expect(metadataJson.tagline).toBeTruthy();
    expect(metadataJson.ogTitle).toBeTruthy();
    expect(metadataJson.ogDescription).toBeTruthy();

    const accountResponse = await page.request.get(ACCOUNT_ENDPOINT);
    expect(accountResponse.status()).toBe(200);
    try {
      const accountJson = await accountResponse.json();
      if (!accountJson || (accountJson.ok === false && typeof accountJson.address !== 'string')) {
        // ok:false is allowed when the owner address is not configured.
      }
    } catch {
      throw new Error('app-account.json must return JSON');
    }

    const signerResponse = await page.request.post('/api/signer/health', {
      data: {
        signer: {
          status: 'approved',
          signer_address: '0x1111111111111111111111111111111111111111',
        },
      },
    });
    expect(signerResponse.ok()).toBeTruthy();
    const signerJson = (await signerResponse.json()) as { ok: boolean; address?: string; reason?: string };

    console.log(
      `META: heroImageUrl ok, tagline ok, ogTitle ok, ogDescription ok, noindex=${metadataJson.noindex ? 'true' : 'false'}`
    );
    console.log(
      `SIGNER: ok=${signerJson.ok} keyUsed=${signerJson.ok ? 'signer_address' : 'none'} reason=${signerJson.reason ?? 'none'}`
    );
    console.log(`GATE: connected=${connected} remember=${rememberFlag} trial=${trialStarted} eligible=${connected && trialStarted}`);
    console.log(`RUN: started=${runStarted} ended=${runEnded} nextEligible=${nextEligible}`);
    console.log('SPAWN: safe=true');
    console.log(`HUD: visible=${hudVisible}`);
  });
});
