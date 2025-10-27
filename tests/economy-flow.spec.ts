import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';
const ADDRESS_ONE = '0xAaaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaA';
const ADDRESS_TWO = '0xBbbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbB';

function injectWalletScript(address: string) {
  return `
    window.__testWalletAddress = '${address}';
    window.__setTestAddress = (next) => { window.__testWalletAddress = next; };
    window.ethereum = {
      request: async ({ method }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return [window.__testWalletAddress];
        }
        if (method === 'eth_chainId') {
          return '0x2105';
        }
        if (method === 'wallet_switchEthereumChain') {
          window.__testWalletAddress = window.__testWalletAddress;
          return null;
        }
        if (method === 'wallet_addEthereumChain') {
          return null;
        }
        return null;
      },
      on: () => {},
      removeListener: () => {},
    };
    window.open = () => null;
  `;
}

test.describe('Home economy flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(injectWalletScript(ADDRESS_ONE));
    await page.route('**/api/pay/session', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ ok: true, session: { id: 'mock-session', mock: true } }),
        contentType: 'application/json',
      });
    });
  });

  test('connect wallet, claim daily, share, purchase, invite', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const connectButton = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectButton).toBeVisible();
    await connectButton.click();
    await expect(page.getByText(/wallet connected/i)).toBeVisible();

    const beforeState = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('rubble:economy:v1') || '{}')
    );

    const claimButton = page.getByRole('button', { name: /claim daily reward/i });
    await claimButton.click();
    await expect(claimButton).toBeDisabled();

    const afterDaily = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('rubble:economy:v1') || '{}')
    );
    expect(afterDaily.boosts ?? 0).toBeGreaterThan(beforeState.boosts ?? 0);

    const shareButton = page.getByRole('button', { name: /share & grant boost/i });
    await shareButton.click();
    const afterShare = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('rubble:economy:v1') || '{}')
    );
    expect(afterShare.boosts ?? 0).toBeGreaterThan(afterDaily.boosts ?? 0);

    const shopButton = page.getByRole('button', { name: /buy with base/i }).first();
    await shopButton.click();
    await expect(page.getByText(/inventory/i)).toBeVisible();
    const afterPurchase = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('rubble:economy:v1') || '{}')
    );
    expect(afterPurchase.boosts ?? 0).toBeGreaterThan(afterShare.boosts ?? 0);

    const referralCode = await page.evaluate(() => {
      const state = JSON.parse(window.localStorage.getItem('rubble:economy:v1') || '{}');
      return state.referralCode || null;
    });
    expect(referralCode).toBeTruthy();

    if (referralCode) {
      await page.evaluate((addr) => {
        window.__setTestAddress(addr);
        window.localStorage.removeItem('rubble:economy:v1');
      }, ADDRESS_TWO);
      await page.goto(`${BASE_URL}?ref=${referralCode}`, { waitUntil: 'domcontentloaded' });
      const connectTwo = page.getByRole('button', { name: /connect wallet/i }).first();
      await connectTwo.click();
      const inviteeState = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem('rubble:economy:v1') || '{}')
      );
      expect((inviteeState.retries ?? 0) > 0 || (inviteeState.boosts ?? 0) > 0).toBeTruthy();

      const rewardMap = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem('rubble:referral:rewards') || '{}')
      );
      expect(rewardMap[ADDRESS_ONE.toLowerCase()] ?? 0).toBeGreaterThan(0);

      await page.evaluate((addr) => {
        window.__setTestAddress(addr);
        window.localStorage.removeItem('rubble:economy:v1');
      }, ADDRESS_ONE);
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      const connectAgain = page.getByRole('button', { name: /connect wallet/i }).first();
      await connectAgain.click();
      const inviterState = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem('rubble:economy:v1') || '{}')
      );
      expect(inviterState.boosts ?? 0).toBeGreaterThan(afterPurchase.boosts ?? 0);
    }
  });
});
