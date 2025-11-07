'use client';

import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { WagmiProvider, useAccount, useConnect } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi/config';
import { useWalletStore } from '@/lib/wallet-store';

function WalletSync() {
  const { address, chainId, status } = useAccount();
  const { connectors } = useConnect();
  const setWallet = useWalletStore((state) => state.setWallet);
  const resetWallet = useWalletStore((state) => state.reset);
  const setChainId = useWalletStore((state) => state.setChainId);
  const hasConnector = useMemo(() => connectors.length > 0, [connectors]);

  useEffect(() => {
    if (status === 'connected' && address) {
      const nextChain = typeof chainId === 'number' ? `0x${chainId.toString(16)}` : null;
      setWallet(address, nextChain);
      if (nextChain) {
        setChainId(nextChain);
      }
    } else if (status === 'disconnected') {
      resetWallet();
    }
  }, [address, chainId, resetWallet, setChainId, setWallet, status]);

  useEffect(() => {
    if (!hasConnector) {
      resetWallet();
    }
  }, [hasConnector, resetWallet]);

  return null;
}

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletSync />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
