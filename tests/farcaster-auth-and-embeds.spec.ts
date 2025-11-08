import { test, expect } from '@playwright/test';
import { initWalletStub } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

function withBase(path: string) {
  return new URL(path, BASE_URL).toString();
}

test.describe('Farcaster auth + embeds', () => {
  test('whoami retry advances from Farcaster gate to wallet link', async ({ page }) => {
    await page.addInitScript(() => {
      const sentinel = '__rubble_e2e_init__auth_embeds__';
      try {
        if (!window.sessionStorage.getItem(sentinel)) {
          window.localStorage.clear();
          window.sessionStorage.clear();
          window.sessionStorage.setItem(sentinel, '1');
        }
      } catch {
        // ignore storage access errors
      }
    });

    await initWalletStub(page);

    let attempts = 0;
    await page.route('**/api/miniapp/whoami', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ ok: false }),
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ ok: true, fid: 2, username: 'tester', pfpUrl: 'https://example.com/pfp.png' }),
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('farcaster-auth-card')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('wallet-link-card')).toBeVisible();
    await expect(page.getByTestId('wallet-link-connect')).toBeVisible();
  });

  test('Farcaster connector connect() triggers wallet provider request', async ({ page }) => {
    await initWalletStub(page);

    await page.route('**/api/miniapp/whoami', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ ok: true, fid: 9, username: 'wallet-user', pfpUrl: 'https://example.com/pfp.png' }),
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('wallet-link-card')).toBeVisible();

    const connectedBefore = await page.evaluate(() => Boolean((window as typeof window & { __mockWalletConnected?: boolean }).__mockWalletConnected));
    expect(connectedBefore).toBeFalsy();

    await page.getByTestId('wallet-link-connect').click();

    await expect(page.getByTestId('wallet-link-card')).toHaveCount(0);
    const connectedAfter = await page.evaluate(() => Boolean((window as typeof window & { __mockWalletConnected?: boolean }).__mockWalletConnected));
    expect(connectedAfter).toBeTruthy();
  });

  test('fc:miniapp metadata is present with 1200x630 image', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const metaContent = await page.locator('meta[name="fc:miniapp"]').getAttribute('content');
    expect(metaContent, 'fc:miniapp meta tag missing').toBeTruthy();

    const parsed = JSON.parse(metaContent ?? '{}') as {
      version?: string;
      imageUrl?: string;
      button?: { title?: string; action?: { type?: string; name?: string; url?: string } };
    };

    expect(parsed.version).toBe('next');
    expect(parsed.imageUrl).toMatch(/bubbleit-embed-1200x630\.jpg$/);
    expect(parsed.button?.action?.type).toBe('launch_miniapp');
    expect(parsed.button?.action?.url).toBe(withBase('/'));
  });

  test('manifest exposes required Farcaster metadata', async ({ request }) => {
    const response = await request.get(withBase('/.well-known/farcaster.json'));
    expect(response.ok()).toBeTruthy();
    const manifest = (await response.json()) as {
      version?: string;
      miniapp?: {
        heroImageUrl?: string;
        tagline?: string;
        ogTitle?: string;
        ogDescription?: string;
        noindex?: boolean;
      };
      baseBuilder?: { ownerAddress?: string };
      accountAssociation?: { signature?: string; claims?: Record<string, unknown> };
    };

    expect(manifest.version).toBe('next');
    expect(manifest.miniapp?.heroImageUrl).toMatch(/bubbleit-hero-1200x630\.jpg$/);
    expect(manifest.miniapp?.tagline).toBeTruthy();
    expect(manifest.miniapp?.ogTitle).toBeTruthy();
    expect(manifest.miniapp?.ogDescription).toBeTruthy();
    expect(typeof manifest.miniapp?.noindex).toBe('boolean');
    expect(manifest.baseBuilder?.ownerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(manifest.accountAssociation?.signature).toBeTruthy();
    expect(manifest.accountAssociation?.claims).toBeTruthy();
  });
});
