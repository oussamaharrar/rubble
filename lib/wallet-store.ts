'use client';

import { create } from 'zustand';

interface WalletState {
  address: string | null;
  chainId: string | null;
  remember: boolean;
  setAddress: (address: string | null) => void;
  setChainId: (chainId: string | null) => void;
  setRemember: (remember: boolean) => void;
  setWallet: (address: string | null, chainId: string | null) => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  chainId: null,
  remember: false,
  setAddress: (address) => set({ address }),
  setChainId: (chainId) => set({ chainId }),
  setRemember: (remember) => set({ remember }),
  setWallet: (address, chainId) => set({ address, chainId }),
  reset: () => set({ address: null, chainId: null, remember: false }),
}));
