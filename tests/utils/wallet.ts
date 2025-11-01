import type { Page } from '@playwright/test';

export const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const ADDRESS = MOCK_ADDRESS;

export async function initWalletStub(page: Page) {
  await page.addInitScript(({ address }) => {
    const global = window as typeof window & { __mockWalletConnected?: boolean };
    const remembered = (() => {
      try {
        return window.localStorage?.getItem('rubble:remember') === '1';
      } catch {
        return false;
      }
    })();
    let connected = Boolean(global.__mockWalletConnected || remembered);
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
            try {
              if (window.localStorage?.getItem('rubble:remember') === '1') {
                connected = true;
                return [address];
              }
            } catch {
              // ignore
            }
            return connected ? [address] : [];
          case 'eth_requestAccounts':
            connected = true;
            global.__mockWalletConnected = true;
            notify('accountsChanged', [address]);
            return [address];
          case 'eth_chainId':
            return '0x2105';
          case 'wallet_switchEthereumChain':
          case 'wallet_addEthereumChain':
            notify('chainChanged', '0x2105');
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
  }, { address: ADDRESS });
}
