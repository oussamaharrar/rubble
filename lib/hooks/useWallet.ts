'use client';

import { useMemo } from 'react';
import { BASE_CHAIN_ID_HEX } from '@/lib/base';
import { useWalletStore } from '@/lib/wallet-store';

export function useWallet() {
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);

  return useMemo(
    () => ({
      address,
      chainId,
      walletConnected: Boolean(address),
      onBase: chainId ? chainId.toLowerCase() === BASE_CHAIN_ID_HEX : false,
    }),
    [address, chainId]
  );
}
