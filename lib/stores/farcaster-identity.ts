'use client';

import { create } from 'zustand';

export type FarcasterIdentity = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

type FarcasterStatus = 'idle' | 'loading' | 'ready' | 'error';

interface FarcasterIdentityState {
  identity: FarcasterIdentity | null;
  status: FarcasterStatus;
  error: string | null;
  setIdentity: (identity: FarcasterIdentity | null) => void;
  setStatus: (status: FarcasterStatus, error?: string | null) => void;
  reset: () => void;
}

export const useFarcasterIdentityStore = create<FarcasterIdentityState>((set) => ({
  identity: null,
  status: 'idle',
  error: null,
  setIdentity: (identity) => set({ identity }),
  setStatus: (status, error = null) => set({ status, error: error ?? null }),
  reset: () => set({ identity: null, status: 'idle', error: null }),
}));
