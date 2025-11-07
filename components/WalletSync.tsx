'use client';

import { useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWalletStore } from '@/lib/wallet-store';

function toHexChainId(chainId: number | null | undefined) {
  if (typeof chainId !== 'number' || !Number.isFinite(chainId)) {
    return null;
  }
  return `0x${chainId.toString(16)}`;
}

export function WalletSync() {
  const { address, status } = useAccount();
  const chainId = useChainId();
  const setWallet = useWalletStore((state) => state.setWallet);
  const resetWallet = useWalletStore((state) => state.reset);

  useEffect(() => {
    if (address) {
      setWallet(address, toHexChainId(chainId));
      return;
    }
    if (status === 'disconnected') {
      resetWallet();
    }
  }, [address, chainId, resetWallet, setWallet, status]);

  return null;
}
