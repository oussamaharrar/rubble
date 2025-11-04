import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

const SHORT_ADDRESS = `${MOCK_ADDRESS.slice(0, 6)}…${MOCK_ADDRESS.slice(-4)}`.toUpperCase();

test.describe('farcaster entry flow', () => {
  test('requires Farcaster identity before wallet linking', async ({ page }) => {
    await page.addInitScript(() => {
      (window as typeof window & { FarcasterMiniApp?: Record<string, unknown> }).FarcasterMiniApp = {};
    });
    await page.route('**/api/miniapp/whoami', (route) => {
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          ok: true,
          fid: 4242,
          username: 'rubbletester',
          displayName: 'Rubble Tester',
          pfpUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAH/QJ/Z9NPbwAAAABJRU5ErkJggg==',
        }),
      });
    });
    await initWalletStub(page, { providerInfo: { rdns: 'io.metamask', name: 'MetaMask' } });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const fcCard = page.getByTestId('farcaster-auth-card');
    await fcCard.waitFor({ state: 'visible' });
    await expect(fcCard).toContainText(/Farcaster/i);
    await fcCard.waitFor({ state: 'detached' });

    const connectButton = page.getByTestId('connect-wallet-home');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();

    await connectButton.click();

    const chip = page.locator('[aria-label^="Connected wallet"]');
    await expect(chip).toContainText('RUBBLE TESTER');
    await expect(chip).toContainText('@RUBBLETESTER');
    await expect(chip).toContainText(SHORT_ADDRESS);
    await expect(page.locator('img[alt="Rubble Tester avatar"]')).toBeVisible();
  });
});
