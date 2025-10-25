'use client';

import { create } from 'zustand';

interface WalletState {
  address: string | null;
  chainId: string | null;
  setAddress: (address: string | null) => void;
  setChainId: (chainId: string | null) => void;
  setWallet: (address: string | null, chainId: string | null) => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  chainId: null,
  setAddress: (address) => set({ address }),
  setChainId: (chainId) => set({ chainId }),
  setWallet: (address, chainId) => set({ address, chainId }),
  reset: () => set({ address: null, chainId: null }),
}));
