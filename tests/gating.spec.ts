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
    page.on('console', (message) => {
      const text = message.text();
      if (/^(GATE:|RUN:|HUD:|SPAWN:)/.test(text)) {
        console.log(text);
      }
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const baseOrigin = new URL(BASE_URL).origin;

    const metadataResponse = await page.request.get(`${baseOrigin}/api/site/metadata`);
    expect(metadataResponse.status()).toBe(200);
    const metadataPayload = (await metadataResponse.json()) as {
      ok: boolean;
      heroImageUrl: string;
      tagline: string;
      ogTitle: string;
      ogDescription: string;
      noindex?: boolean;
    };
    expect(metadataPayload.ok).toBeTruthy();
    expect(metadataPayload.heroImageUrl).toMatch(/\/api\/og\/hero$/);
    expect(metadataPayload.tagline.length).toBeGreaterThan(0);
    expect(metadataPayload.ogTitle.length).toBeGreaterThan(0);
    expect(metadataPayload.ogDescription.length).toBeGreaterThan(0);

    const heroUrl = new URL(metadataPayload.heroImageUrl, baseOrigin);
    const heroRequestUrl = heroUrl.origin === baseOrigin ? heroUrl.toString() : `${baseOrigin}${heroUrl.pathname}${
      heroUrl.search
    }`;
    const heroResponse = await page.request.get(heroRequestUrl);
    expect(heroResponse.status()).toBe(200);
    expect(heroResponse.headers()['content-type']).toContain('image/');

    const accountResponse = await page.request.get(`${baseOrigin}/.well-known/app-account.json`);
    expect(accountResponse.status()).toBe(200);
    const accountPayload = (await accountResponse.json()) as
      | { ok: false }
      | { address: string; chainId: number; timestamp: string; domain: string };
    if ('ok' in accountPayload && accountPayload.ok === false) {
      // ok false is acceptable when no PUBLIC_OWNER_ADDRESS is configured.
    } else {
      expect(accountPayload.address).toMatch(/^0x[a-fA-F0-9]{40}$/u);
      expect(accountPayload.chainId).toBe(8453);
      expect(new Date(accountPayload.timestamp).toString()).not.toBe('Invalid Date');
      expect(accountPayload.domain.length).toBeGreaterThan(0);
    }

    const signerResponse = await page.request.post(`${baseOrigin}/api/signer/health`, {
      data: { signer: { status: 'approved' } },
      headers: { 'content-type': 'application/json' },
    });
    const signerPayload = (await signerResponse.json()) as { ok: boolean; reason?: string; keyUsed?: string };

    console.log(
      `META: heroImageUrl ${heroResponse.ok() ? 'ok' : 'missing'}, tagline ${
        metadataPayload.tagline ? 'ok' : 'missing'
      }, ogTitle ${metadataPayload.ogTitle ? 'ok' : 'missing'}, ogDescription ${
        metadataPayload.ogDescription ? 'ok' : 'missing'
      }, noindex=${metadataPayload.noindex === true}`
    );
    console.log(
      `SIGNER: ok=${signerPayload.ok === true} keyUsed=${signerPayload.keyUsed ?? 'none'} reason=${
        signerPayload.reason ?? 'none'
      }`
    );

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

    console.log('SPAWN: safe=true');

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
