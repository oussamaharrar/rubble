import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';
const GAME_ADDRESS = '0xfeedfacecafebeefdeadbeefcafefeed00000000';

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
  `;
}

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

test.describe('Rubble gameplay visibility', () => {
  test('canvas visible, sized, and HUD layered', async ({ page }) => {
    const messages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        messages.push(msg.text());
      }
    });

    await page.addInitScript(stubWallet([]));
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('rubble:test:init')) {
        window.sessionStorage.setItem('rubble:test:init', '1');
        window.localStorage.clear();
      }
      window.localStorage.setItem('rubble:tutorial-pref', JSON.stringify({ dismissed: true }));
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await connectStubbedWallet(page, GAME_ADDRESS);

    const freeRunButton = page.getByRole('button', { name: /Free run available/i });
    await expect(freeRunButton).toBeVisible();

    const playArcadeButton = page.getByRole('button', { name: /^Play Arcade$/i });
    await playArcadeButton.click();

    const playTrialButton = page.getByRole('button', { name: /Play free trial/i });
    await playTrialButton.click();

    const skipButton = page.getByRole('button', { name: /^Skip$/ });
    await skipButton.click();

    const inner = page.locator('.app-frame__inner');
    await expect(inner).toBeVisible();

    const box = await inner.boundingBox();
    expect(box?.width || 0).toBeGreaterThan(100);
    expect(box?.height || 0).toBeGreaterThan(100);

    const canvas = page.locator('canvas.app-canvas');
    await expect(canvas).toBeVisible();

    const hud = page.locator('.app-hud');
    await page.waitForFunction(() => {
      const el = document.querySelector('.app-hud');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0;
    });
    const hudZ = await hud.evaluate((el) => getComputedStyle(el).zIndex);
    const canvasZ = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
    expect(parseInt(hudZ || '0')).toBeGreaterThan(parseInt(canvasZ || '0'));

    await page.waitForFunction(() => document.getElementById('rubble-root')?.getAttribute('data-playing') === '1');

    const overflowY = await page.evaluate(() => window.getComputedStyle(document.body).overflowY);
    expect(overflowY).toBe('hidden');

    await page.evaluate((addr) => {
      const raw = window.localStorage.getItem('rubble:economy:v1');
      const data = raw
        ? JSON.parse(raw)
        : { accounts: {}, firstBoost: {}, inviteRewards: {}, referralClaims: {} };
      if (!data.accounts) {
        data.accounts = {};
      }
      const key = addr;
      const account = data.accounts[key] ?? {
        bubbles: 0,
        boosts: 0,
        retries: 0,
        comboStartBonus: 0,
        streak: 0,
        bonusTrials: 0,
      };
      account.bonusTrials = (account.bonusTrials ?? 0) + 1;
      data.accounts[key] = account;
      window.localStorage.setItem('rubble:economy:v1', JSON.stringify(data));
      window.localStorage.setItem('rubble:diag', 'true');
      window.location.reload();
    }, GAME_ADDRESS.toLowerCase());
    await page.waitForLoadState('networkidle');
    await connectStubbedWallet(page, GAME_ADDRESS);

    const playArcadeReload = page.getByRole('button', { name: /^Play Arcade$/i });
    await playArcadeReload.click();
    const trialButtonReload = page.getByRole('button', { name: /(Play free trial|Use bonus run)/i });
    await trialButtonReload.click();
    const skipAfterReload = page.getByRole('button', { name: /^Skip$/ });
    await skipAfterReload.click();

    await page.waitForFunction(() => document.getElementById('rubble-root')?.getAttribute('data-playing') === '1');

    const diag = page.locator('.rbl-diag');
    await expect(diag).toBeVisible();
    const diagText = await diag.textContent();
    expect(diagText || '').toMatch(/DPR/i);
    expect(diagText || '').toMatch(/CSS/i);
    await expect.poll(() => messages.some((line) => line.startsWith('ECON:'))).toBeTruthy();
    await expect.poll(() => messages.some((line) => line.startsWith('DIAG:'))).toBeTruthy();
  });
});
