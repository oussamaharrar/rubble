import type { Page } from '@playwright/test';

export const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const ADDRESS = MOCK_ADDRESS;

type ProviderInfo = { rdns?: string | null; name?: string | null } | null;

type WalletStubOptions = {
  providerInfo?: ProviderInfo;
  announceProviders?: Array<{ rdns?: string | null; name?: string | null }>;
};

export async function initWalletStub(page: Page, options: WalletStubOptions = {}) {
  await page.addInitScript(({ address, providerInfo, announceProviders }) => {
    const global = window as typeof window & {
      __mockWalletConnected?: boolean;
      __mockWallet?: {
        setProviderInfo: (info: ProviderInfo) => void;
        disconnect: () => void;
      };
    };
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
    const state: { providerInfo: ProviderInfo } = {
      providerInfo: providerInfo ?? { rdns: 'io.metamask', name: 'MetaMask' },
    };

    const providers = announceProviders ?? [
      { rdns: 'io.metamask', name: 'MetaMask' },
      { rdns: 'com.coinbase.wallet', name: 'Coinbase Wallet' },
      { rdns: 'com.okx.wallet', name: 'OKX Wallet' },
      { rdns: 'io.rabby', name: 'Rabby' },
    ];

    global.__mockWallet = {
      setProviderInfo: (info) => {
        state.providerInfo = info ?? { rdns: null, name: null };
      },
      disconnect: () => {
        connected = false;
        global.__mockWalletConnected = false;
        notify('accountsChanged', []);
      },
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
          case 'wallet_getProviderInfo':
            return state.providerInfo ?? { rdns: null, name: null };
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

    const announceProvidersEvent = () => {
      for (const info of providers) {
        const detail = {
          info: {
            rdns: info.rdns ?? null,
            name: info.name ?? null,
          },
          provider: window.ethereum,
        };
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
      }
    };

    window.addEventListener('eip6963:requestProvider', announceProvidersEvent);
    announceProvidersEvent();
  }, { address: ADDRESS, providerInfo: options.providerInfo ?? null, announceProviders: options.announceProviders ?? null });
}
