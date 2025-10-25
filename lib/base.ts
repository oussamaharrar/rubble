export const BASE_CHAIN_ID_HEX = '0x2105';

type EthereumRequestArgs<TParams = unknown[]> = {
  method: string;
  params?: TParams;
};

type EthereumProvider = {
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

function getFallbackRpcUrls() {
  const publicRpc = process.env.NEXT_PUBLIC_BASE_RPC_URL;
  if (publicRpc && publicRpc.length > 0) {
    return [publicRpc];
  }
  return ['https://mainnet.base.org'];
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
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base Mainnet',
            rpcUrls: getFallbackRpcUrls(),
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
