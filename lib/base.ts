const FALLBACK_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL && process.env.NEXT_PUBLIC_BASE_RPC_URL.length > 0
    ? process.env.NEXT_PUBLIC_BASE_RPC_URL
    : undefined;

export const BASE_CHAIN_ID_HEX = '0x2105';

export type EthereumRequestArgs<TParams = unknown[]> = {
  method: string;
  params?: TParams;
};

export type EthereumProvider = {
  request<TResponse = unknown, TParams = unknown[]>(
    args: EthereumRequestArgs<TParams>
  ): Promise<TResponse>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function isProvider(value: unknown): value is EthereumProvider {
  return Boolean(value && typeof (value as EthereumProvider).request === 'function');
}

export async function ensureBaseNetwork(): Promise<string> {
  if (typeof window === 'undefined' || !isProvider(window.ethereum)) {
    throw new Error('No wallet detected. Install a compatible Base wallet.');
  }

  const provider = window.ethereum;
  const [address] = await provider.request<string[]>({ method: 'eth_requestAccounts' });

  const currentChainId = await provider.request<string>({ method: 'eth_chainId' });
  if (currentChainId?.toLowerCase() === BASE_CHAIN_ID_HEX) {
    return address;
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null ? (error as { code?: number }).code : undefined;
    if (code === 4902) {
      const rpcUrls = FALLBACK_RPC_URL ? [FALLBACK_RPC_URL] : [];
      if (rpcUrls.length === 0) {
        throw new Error('Missing NEXT_PUBLIC_BASE_RPC_URL for Base Mainnet configuration.');
      }

      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base Mainnet',
            rpcUrls,
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            blockExplorerUrls: ['https://basescan.org'],
          },
        ],
      });
    } else {
      throw new Error('Switch to Base Mainnet to continue.');
    }
  }

  const verifiedChainId = await provider.request<string>({ method: 'eth_chainId' });
  if (verifiedChainId?.toLowerCase() !== BASE_CHAIN_ID_HEX) {
    throw new Error('Unable to connect wallet to Base Mainnet.');
  }

  return address;
}
