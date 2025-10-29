'use client';

import { create } from 'zustand';
import { logEvent } from '@/lib/telemetry';

export type RewardBoostSource = 'daily' | 'invite' | 'treasure';

export type RewardBoost = {
  id: string;
  source: RewardBoostSource;
  grantedAt: number;
  consumedAt: number | null;
};

const STORAGE_KEY = 'rubble:boosts';
const EXPIRY_MS = 24 * 60 * 60 * 1000;

function nowTs() {
  return typeof Date.now === 'function' ? Date.now() : new Date().getTime();
}

function readStoredBoosts(): RewardBoost[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RewardBoost[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) =>
        entry && typeof entry.id === 'string' && typeof entry.source === 'string' && typeof entry.grantedAt === 'number'
      )
      .map((entry) => ({
        id: entry.id,
        source: (entry.source as RewardBoostSource) ?? 'daily',
        grantedAt: entry.grantedAt,
        consumedAt: typeof entry.consumedAt === 'number' ? entry.consumedAt : null,
      }));
  } catch {
    return [];
  }
}

function persistBoosts(boosts: RewardBoost[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boosts));
  } catch {
    // ignore persistence failures
  }
}

function cleanupBoosts(boosts: RewardBoost[], reference = nowTs()) {
  return boosts.filter((boost) => {
    if (!boost) return false;
    if (boost.consumedAt) return reference - boost.consumedAt < 10_000; // allow brief state before drop
    return reference - boost.grantedAt < EXPIRY_MS;
  });
}

type BoostStoreState = {
  boosts: RewardBoost[];
  grant: (source: RewardBoostSource) => RewardBoost;
  consumeForEntry: () => RewardBoost | null;
  markConsumed: (id: string) => void;
  hasSource: (source: RewardBoostSource) => boolean;
  cleanup: () => void;
};

export const useBoostStore = create<BoostStoreState>((set, get) => {
  const initialBoosts = cleanupBoosts(readStoredBoosts());

  const persist = (boosts: RewardBoost[]) => {
    persistBoosts(boosts);
    set({ boosts });
  };

  return {
    boosts: initialBoosts,
    grant: (source) => {
      const boost: RewardBoost = {
        id: `${source}-${nowTs()}-${Math.random().toString(16).slice(2)}`,
        source,
        grantedAt: nowTs(),
        consumedAt: null,
      };
      const boosts = cleanupBoosts([...get().boosts, boost]);
      persist(boosts);
      logEvent('boost_granted', { reason: source });
      return boost;
    },
    consumeForEntry: () => {
      const boosts = cleanupBoosts(get().boosts);
      const available = boosts.find((boost) => !boost.consumedAt);
      if (!available) {
        persist(boosts);
        return null;
      }
      available.consumedAt = nowTs();
      const next = cleanupBoosts(boosts);
      persist(next);
      return available;
    },
    markConsumed: (id) => {
      const boosts = cleanupBoosts(get().boosts).map((boost) =>
        boost.id === id ? { ...boost, consumedAt: nowTs() } : boost
      );
      persist(cleanupBoosts(boosts));
    },
    hasSource: (source) => {
      return cleanupBoosts(get().boosts).some((boost) => boost.source === source && !boost.consumedAt);
    },
    cleanup: () => {
      const boosts = cleanupBoosts(get().boosts);
      persist(boosts);
    },
  };
});

declare global {
  interface Window {
    __rubbleBoostStore?: typeof useBoostStore;
  }
}

if (typeof window !== 'undefined') {
  window.__rubbleBoostStore = useBoostStore;
}
