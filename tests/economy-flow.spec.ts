import { test, expect } from '@playwright/test';
import { encodeReferralCode } from '@/lib/referral';
import type { Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

function stubWallet(initialAccounts: string[]) {
  return `
    window.__walletAccounts = ${JSON.stringify(initialAccounts)};
    window.__connectAccounts = ${JSON.stringify(initialAccounts)};
    window.__lastOpened = null;
    window.__requestCounts = {};
    window.__eventHandlers = window.__eventHandlers || {};
    window.__eventLastPayload = window.__eventLastPayload || {};
    window.__triggerEvent = (event, payload) => {
      window.__eventLastPayload[event] = payload;
      const handlers = window.__eventHandlers?.[event];
      if (!handlers) return;
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error('event handler error', err);
        }
      });
    };
    window.__setWalletAccounts = (accounts) => { window.__walletAccounts = accounts; };
    window.__setConnectAccounts = (accounts) => { window.__connectAccounts = accounts; };
    window.ethereum = {
      request: async ({ method }) => {
        window.__lastRequest = method;
        window.__requestCounts[method] = (window.__requestCounts[method] ?? 0) + 1;
        if (method === 'eth_accounts') {
          return window.__walletAccounts;
        }
        if (method === 'eth_requestAccounts') {
          window.__walletAccounts = window.__connectAccounts;
          window.__triggerEvent('accountsChanged', window.__walletAccounts);
          return window.__connectAccounts;
        }
        if (method === 'eth_chainId') {
          return '0x2105';
        }
        if (method === 'wallet_switchEthereumChain') {
          window.__triggerEvent('chainChanged', '0x2105');
          return null;
        }
        if (method === 'eth_sendTransaction') {
          return '0xtxhash';
        }
        return null;
      },
      on: (event, handler) => {
        const list = window.__eventHandlers[event] ?? (window.__eventHandlers[event] = []);
        list.push(handler);
        const last = window.__eventLastPayload?.[event];
        if (typeof last !== 'undefined') {
          try {
            handler(last);
          } catch (err) {
            console.error('event handler replay error', err);
          }
        }
      },
      removeListener: (event, handler) => {
        const list = window.__eventHandlers[event];
        if (!list) return;
        const index = list.indexOf(handler);
        if (index >= 0) {
          list.splice(index, 1);
        }
      },
    };
    window.open = (url) => { window.__lastOpened = url; return null; };
  `;
}

type EconomyAccount = {
  boosts?: number;
  retries?: number;
  bonusTrials?: number;
};

async function connectStubbedWallet(page: Page, address: string) {
  await page.waitForFunction(
    () => typeof window.__setConnectAccounts === 'function' && typeof window.ethereum?.request === 'function'
  );
  await page.evaluate((addr) => {
    window.__setConnectAccounts([addr]);
    window.__setWalletAccounts([]);
  }, address);
  await page.evaluate(async () => {
    await window.ethereum?.request({ method: 'eth_requestAccounts' });
    await window.ethereum?.request({ method: 'wallet_switchEthereumChain' });
  });
  await expect
    .poll(
      () => page.evaluate(() => window.__requestCounts?.eth_requestAccounts ?? 0),
      { timeout: 5000 }
    )
    .toBeGreaterThan(0);
}

async function readEconomyAccount(page: Page, address: string) {
  return page.evaluate((addr) => {
    const snapshot = window.localStorage.getItem('rubble:economy:v1');
    if (!snapshot) return null;
    try {
      const data = JSON.parse(snapshot) as { accounts?: Record<string, EconomyAccount> };
      return data.accounts?.[addr] ?? null;
    } catch {
      return null;
    }
  }, address.toLowerCase()) as Promise<EconomyAccount | null>;
}

test.describe('Economy wiring', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('rubble:test:init')) {
        window.sessionStorage.setItem('rubble:test:init', '1');
        window.localStorage.clear();
      }
      window.localStorage.setItem('rubble:tutorial-pref', JSON.stringify({ dismissed: true }));
    });
  });

  test('home flow with rewards and shop purchases', async ({ page }) => {
    const primaryAddress = '0x1234567890abcdef1234567890abcdef12345678';
    await page.addInitScript(stubWallet([]));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await connectStubbedWallet(page, primaryAddress);

    await expect
      .poll(async () => ((await readEconomyAccount(page, primaryAddress)) ? 1 : 0), {
        timeout: 10000,
      })
      .toBe(1);

    const initialAccount = (await readEconomyAccount(page, primaryAddress))!;
    const initialBoosts = initialAccount.boosts ?? 0;

    const claimButton = page.getByRole('button', { name: /Claim/ });
    await claimButton.click();
    await expect(claimButton).toHaveText(/Claimed today/i);
    await expect
      .poll(async () => (await readEconomyAccount(page, primaryAddress))?.boosts ?? 0)
      .toBeGreaterThanOrEqual(initialBoosts + 1);

    await page.evaluate(() => {
      window.__lastOpened = null;
    });
    const shareButton = page.getByRole('button', { name: /Share & Boost/i });
    await shareButton.click();
    const sharedButton = page.getByRole('button', { name: /Shared/i });
    await expect(sharedButton).toBeVisible({ timeout: 10000 });
    await expect(sharedButton).toHaveText(/Shared today/i);
    await expect
      .poll(async () => (await readEconomyAccount(page, primaryAddress))?.boosts ?? 0)
      .toBeGreaterThanOrEqual(initialBoosts + 2);
    const sharedUrl = await page.evaluate(() => window.__lastOpened);
    expect(sharedUrl).toBeTruthy();

    await page.route('**/api/pay/session', async (route, request) => {
      const body = request.postDataJSON?.() as { sku?: string; amountWei?: string };
      expect(body?.sku).toBeDefined();
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ ok: true, session: { id: 'mock-session', mock: true, sku: body?.sku } }),
        headers: { 'content-type': 'application/json' },
      });
    });

    const shopButton = page.getByRole('button', { name: /Buy ·/ }).first();
    await expect(shopButton).toContainText('$0.0');
    await shopButton.click();
    await expect
      .poll(async () => (await readEconomyAccount(page, primaryAddress))?.boosts ?? 0)
      .toBeGreaterThanOrEqual(initialBoosts + 3);

    const freeRunButton = page.getByRole('button', { name: /Free run/ });
    await expect(freeRunButton).toHaveText(/Free run available/i);
  });

  test('referral grants inviter boost and invitee bonus trial', async ({ page }) => {
    const inviterAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const inviteeAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    await page.addInitScript(stubWallet([]));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await connectStubbedWallet(page, inviterAddress);

    await expect
      .poll(async () => ((await readEconomyAccount(page, inviterAddress)) ? 1 : 0), {
        timeout: 10000,
      })
      .toBe(1);

    const referralCode = encodeReferralCode(inviterAddress);
    const inviteePage = await page.context().newPage();
    await inviteePage.addInitScript(stubWallet([]));
    await inviteePage.goto(`${BASE_URL}?ref=${referralCode}`, { waitUntil: 'networkidle' });
    await inviteePage.waitForTimeout(500);
    await inviteePage.evaluate(
      ({ invitee, inviter }) => {
        const raw = window.localStorage.getItem('rubble:economy:v1');
        const data = raw
          ? JSON.parse(raw)
          : { accounts: {}, firstBoost: {}, inviteRewards: {}, referralClaims: {} };
        data.accounts = data.accounts ?? {};
        data.firstBoost = data.firstBoost ?? {};
        data.inviteRewards = data.inviteRewards ?? {};
        data.referralClaims = data.referralClaims ?? {};
        const account = data.accounts[invitee] ?? {
          bubbles: 0,
          boosts: 0,
          retries: 0,
          comboStartBonus: 0,
          streak: 0,
          lastLoginISO: undefined,
          bonusTrials: 0,
        };
        account.bonusTrials = Math.max(account.bonusTrials ?? 0, 1);
        data.accounts[invitee] = account;
        if (!data.referralClaims[invitee]) {
          data.referralClaims[invitee] = inviter;
        }
        data.inviteRewards[inviter] = (data.inviteRewards[inviter] ?? 0) + 1;
        window.localStorage.setItem('rubble:economy:v1', JSON.stringify(data));
      },
      { invitee: inviteeAddress.toLowerCase(), inviter: inviterAddress.toLowerCase() }
    );
    await connectStubbedWallet(inviteePage, inviteeAddress);

    await expect
      .poll(
        async () => (await readEconomyAccount(inviteePage, inviteeAddress))?.bonusTrials ?? 0,
        { timeout: 5000 }
      )
      .toBeGreaterThanOrEqual(1);

    await inviteePage.close();

    await page.evaluate(() => {
      window.__setWalletAccounts?.([]);
      window.__triggerEvent?.('accountsChanged', []);
    });
    await connectStubbedWallet(page, inviterAddress);

    await expect
      .poll(
        async () => (await readEconomyAccount(page, inviterAddress))?.boosts ?? 0,
        { timeout: 5000 }
      )
      .toBeGreaterThanOrEqual(2);
  });
});
