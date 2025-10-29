'use client';

import { create } from 'zustand';
import { useBoostStore } from '@/lib/boost-store';
import { logEvent } from '@/lib/telemetry';

export type DailyRewardKind = 'boost' | 'bubbles' | 'cosmetic';

const LAST_CLAIM_KEY = 'rubble:lastClaimDate';

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type DailyRewardState = {
  lastClaim: string | null;
  available: boolean;
  claimReward: () => DailyRewardKind;
  refresh: () => void;
};

function readLastClaim(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LAST_CLAIM_KEY);
}

function persistLastClaim(value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_CLAIM_KEY, value);
  } catch {
    // ignore persistence errors
  }
}

export const useDailyRewardStore = create<DailyRewardState>((set, get) => {
  const initialClaim = readLastClaim();
  const today = todayKey();
  return {
    lastClaim: initialClaim,
    available: !initialClaim || initialClaim !== today,
    claimReward: () => {
      const current = get();
      if (!current.available) {
        return 'cosmetic';
      }
      const roll = Math.random();
      let reward: DailyRewardKind = 'cosmetic';
      if (roll < 0.5) {
        reward = 'boost';
      } else if (roll < 0.8) {
        reward = 'bubbles';
      }
      const key = todayKey();
      persistLastClaim(key);
      set({ lastClaim: key, available: false });
      if (reward === 'boost') {
        useBoostStore.getState().grant('daily');
      }
      logEvent('daily_claimed', { reward });
      return reward;
    },
    refresh: () => {
      const latest = readLastClaim();
      const key = todayKey();
      set({ lastClaim: latest, available: !latest || latest !== key });
    },
  };
});
