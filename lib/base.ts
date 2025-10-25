import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { ENV } from './env';

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(ENV.BASE_RPC_URL),
});

type EthereumRequestArgs<TParams = unknown[]> = {
  method: string;
  params?: TParams;
};

type EthereumProvider = {
  request<TResponse = unknown, TParams = unknown[]>(
    args: EthereumRequestArgs<TParams>,
  ): Promise<TResponse>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const BASE_CHAIN_ID = '0x2105';

export async function ensureBaseNetwork() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet provider not detected');
  }

  const provider = window.ethereum;

  const [chainId] = await Promise.all([
    provider.request<string>({ method: 'eth_chainId' }).catch(() => null),
    provider.request<string[]>({ method: 'eth_requestAccounts' }),
  ]);

  const accounts = await provider.request<string[]>({ method: 'eth_accounts' });
  const address = accounts[0];

  if (!address) {
    throw new Error('Wallet connection rejected');
  }

  if (chainId?.toLowerCase() !== BASE_CHAIN_ID) {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID }],
      });
    } catch (error) {
      const err = error as { code?: number };
      if (err.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: BASE_CHAIN_ID,
              chainName: 'Base',
              rpcUrls: [ENV.BASE_RPC_URL],
              blockExplorerUrls: ['https://basescan.org'],
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
            },
          ],
        });
      } else {
        throw new Error('Please switch to Base mainnet');
      }
    }
  }

  return address;
}
