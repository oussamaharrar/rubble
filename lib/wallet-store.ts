'use client';

import { create } from 'zustand';

interface TrialRecord {
  granted: boolean;
  consumed: boolean;
}

const TRIAL_KEY_PREFIX = 'rubble:trial:v1:';

function readTrial(address: string | null): TrialRecord {
  if (!address || typeof window === 'undefined') {
    return { granted: false, consumed: false };
  }
  const key = `${TRIAL_KEY_PREFIX}${address.toLowerCase()}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const initial: TrialRecord = { granted: true, consumed: false };
      window.localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<TrialRecord>;
    const granted = parsed?.granted !== false;
    const consumed = parsed?.consumed === true;
    if (!granted || parsed?.consumed === undefined) {
      const normalized: TrialRecord = { granted: true, consumed };
      window.localStorage.setItem(key, JSON.stringify(normalized));
      return normalized;
    }
    return { granted: true, consumed };
  } catch {
    const fallback: TrialRecord = { granted: true, consumed: false };
    try {
      window.localStorage.setItem(key, JSON.stringify(fallback));
    } catch {
      // ignore persistence errors
    }
    return fallback;
  }
}

function writeTrial(address: string | null, record: TrialRecord) {
  if (!address || typeof window === 'undefined') return;
  const key = `${TRIAL_KEY_PREFIX}${address.toLowerCase()}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // ignore persistence errors
  }
}

interface WalletState {
  address: string | null;
  chainId: string | null;
  freeTrialAvailable: boolean;
  trialGranted: boolean;
  setAddress: (address: string | null) => void;
  setChainId: (chainId: string | null) => void;
  setWallet: (address: string | null, chainId: string | null) => void;
  markTrialConsumed: () => void;
  ensureTrial: () => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  chainId: null,
  freeTrialAvailable: false,
  trialGranted: false,
  setAddress: (address) => {
    const chainId = get().chainId ?? null;
    get().setWallet(address, chainId);
  },
  setChainId: (chainId) => set({ chainId }),
  setWallet: (address, chainId) => {
    if (!address) {
      set({ address: null, chainId: null, freeTrialAvailable: false, trialGranted: false });
      return;
    }
    const record = readTrial(address);
    set({
      address,
      chainId,
      freeTrialAvailable: record.granted && !record.consumed,
      trialGranted: record.granted,
    });
  },
  markTrialConsumed: () => {
    const { address, freeTrialAvailable, trialGranted } = get();
    if (!address || !freeTrialAvailable) return;
    const record: TrialRecord = { granted: trialGranted, consumed: true };
    writeTrial(address, record);
    set({ freeTrialAvailable: false });
  },
  ensureTrial: () => {
    const { address } = get();
    if (!address) return;
    const record = readTrial(address);
    if (!record.granted || record.consumed) {
      const normalized: TrialRecord = { granted: true, consumed: record.consumed };
      writeTrial(address, normalized);
      set({ trialGranted: true, freeTrialAvailable: !normalized.consumed });
    } else {
      set({ trialGranted: true, freeTrialAvailable: !record.consumed });
    }
  },
  reset: () => {
    set({ address: null, chainId: null, freeTrialAvailable: false, trialGranted: false });
  },
}));
