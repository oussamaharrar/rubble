import type { Page } from '@playwright/test';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

export async function initWalletStub(page: Page) {
  await page.addInitScript(({ address }) => {
    let connected = false;
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
            if (typeof window !== 'undefined') {
              const remember = window.localStorage.getItem('rubble:remember') === '1';
              if (remember && !connected) {
                connected = true;
              } else if (!remember && connected) {
                connected = false;
              }
            }
            return connected ? [address] : [];
          case 'eth_requestAccounts':
            connected = true;
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
