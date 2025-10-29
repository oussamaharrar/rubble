import type { Page } from '@playwright/test';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

export async function initWalletStub(page: Page) {
  await page.addInitScript(({ address }) => {
    const STORAGE_KEY = '__wallet_stub_connected';
    let connected = window.localStorage.getItem(STORAGE_KEY) === '1';
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const notify = (event: string, ...args: unknown[]) => {
      const set = listeners.get(event);
      if (set) {
        set.forEach((handler) => handler(...args));
      }
    };
    window.ethereum = {
      request: async ({ method }: { method: string; params?: unknown[] }) => {
        switch (method) {
          case 'eth_accounts':
            return connected ? [address] : [];
          case 'eth_requestAccounts':
            connected = true;
            window.localStorage.setItem(STORAGE_KEY, '1');
            notify('accountsChanged', [address]);
            return [address];
          case 'eth_chainId':
            return '0x2105';
          case 'wallet_switchEthereumChain':
          case 'wallet_addEthereumChain':
            notify('chainChanged', '0x2105');
            return null;
          case 'wallet_revokePermissions':
            connected = false;
            window.localStorage.setItem(STORAGE_KEY, '0');
            notify('accountsChanged', []);
            return null;
          default:
            return null;
        }
      },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
      },
      removeListener: (event: string, handler: (...args: unknown[]) => void) => {
        listeners.get(event)?.delete(handler);
      },
    } as unknown as typeof window.ethereum;

    const stubClipboard = () => {
      const clipboard = {
        writeText: async (value: string) => {
          window.__lastCopiedAddress = value;
          return Promise.resolve();
        },
      } satisfies Pick<Clipboard, 'writeText'>;
      try {
        Object.defineProperty(window.navigator, 'clipboard', {
          configurable: true,
          value: clipboard,
        });
      } catch (error) {
        (window.navigator as Navigator & { clipboard?: typeof clipboard }).clipboard = clipboard;
      }
    };

    stubClipboard();
  }, { address: ADDRESS });
}
