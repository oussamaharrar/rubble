'use client';

import { create } from 'zustand';
import { logEvent } from '@/lib/telemetry';
import { useRewardBoostStore } from './reward-boost';

const STORAGE_KEY = 'rubble:lastClaimDate';

export type DailyRewardKind = 'boost' | 'bubbles' | 'cosmetic';

interface DailyRewardState {
  lastClaim: string | null;
  available: boolean;
  claimReward: () => DailyRewardKind | null;
  refresh: () => void;
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readLastClaim(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function persistLastClaim(value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
}

function rollReward(): DailyRewardKind {
  const roll = Math.random();
  if (roll < 0.5) return 'boost';
  if (roll < 0.8) return 'bubbles';
  return 'cosmetic';
}

export const useDailyRewardStore = create<DailyRewardState>((set, get) => ({
  lastClaim: null,
  available: true,
  claimReward: () => {
    const state = get();
    if (!state.available) {
      return null;
    }
    const today = todayKey();
    const reward = rollReward();
    if (reward === 'boost') {
      useRewardBoostStore.getState().grant('daily');
    } else if (reward === 'bubbles') {
      void import('@/lib/store')
        .then((module) => {
          if (module?.useGameStore) {
            module.useGameStore.getState().grantBooster(1, 'other');
          }
        })
        .catch(() => {
          // ignore dynamic import errors
        });
    }
    persistLastClaim(today);
    logEvent('daily_claimed', { reward });
    set({ lastClaim: today, available: false });
    return reward;
  },
  refresh: () => {
    const today = todayKey();
    const last = readLastClaim();
    const available = !last || last !== today;
    set({ lastClaim: last, available });
  },
}));

if (typeof window !== 'undefined') {
  const last = readLastClaim();
  const today = todayKey();
  useDailyRewardStore.setState({ lastClaim: last, available: !last || last !== today });
  window.__rubbleDailyRewardStore = useDailyRewardStore;
}

declare global {
  interface Window {
    __rubbleDailyRewardStore?: typeof useDailyRewardStore;
  }
}
