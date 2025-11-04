import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

const SHORT_ADDRESS = `${MOCK_ADDRESS.slice(0, 6)}…${MOCK_ADDRESS.slice(-4)}`.toUpperCase();

test.describe('wallet provider filtering', () => {
  test('blocks embedded Farcaster wallet and allows external wallets', async ({ page }) => {
    await initWalletStub(page, { providerInfo: { rdns: 'app.warpcast', name: 'Warpcast Wallet' } });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const connectButton = page.getByTestId('connect-wallet-home');
    await connectButton.waitFor({ state: 'visible' });
    await connectButton.click();

    await expect(page.getByText('External wallet required')).toBeVisible();
    await expect(page.locator('[aria-label^="Connected wallet"]')).toHaveCount(0);

    await page.evaluate(() => {
      (window as typeof window & {
        __mockWallet?: { setProviderInfo: (info: { rdns?: string | null; name?: string | null }) => void };
      }).__mockWallet?.setProviderInfo({ rdns: 'io.rabby', name: 'Rabby' });
    });

    await connectButton.click();

    const chip = page.locator('[aria-label^="Connected wallet"]');
    await expect(chip).toContainText(SHORT_ADDRESS);
  });
});
