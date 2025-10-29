'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'rubble:boosts';
const DAY_MS = 24 * 60 * 60 * 1000;

export type BoostSource = 'daily' | 'invite' | 'treasure';

export interface RewardBoost {
  id: string;
  source: BoostSource;
  grantedAt: number;
  expiresAt: number;
}

interface RewardBoostStore {
  boosts: RewardBoost[];
  grant: (source: BoostSource, ttlMs?: number) => RewardBoost;
  consumeForRun: () => RewardBoost | null;
  hasSource: (source: BoostSource) => boolean;
  refresh: () => void;
}

function readStoredBoosts(): RewardBoost[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RewardBoost[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as RewardBoost).id === 'string' &&
      typeof (item as RewardBoost).source === 'string' &&
      typeof (item as RewardBoost).grantedAt === 'number' &&
      typeof (item as RewardBoost).expiresAt === 'number'
    );
  } catch {
    return [];
  }
}

function persist(boosts: RewardBoost[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boosts));
  } catch {
    // ignore storage issues
  }
}

function pruneExpired(boosts: RewardBoost[], now: number) {
  return boosts.filter((boost) => boost.expiresAt > now);
}

export const useRewardBoostStore = create<RewardBoostStore>((set, get) => ({
  boosts: [],
  grant: (source, ttlMs = DAY_MS) => {
    const now = Date.now();
    const expiresAt = now + Math.max(ttlMs, 60_000);
    const id = `${source}-${now}-${Math.floor(Math.random() * 1_000_000)}`;
    const boost: RewardBoost = { id, source, grantedAt: now, expiresAt };
    const existing = pruneExpired(get().boosts, now);
    const updated = [...existing, boost];
    persist(updated);
    set({ boosts: updated });
    return boost;
  },
  consumeForRun: () => {
    const now = Date.now();
    const current = pruneExpired(get().boosts, now);
    if (current.length === 0) {
      set({ boosts: current });
      persist(current);
      return null;
    }
    const [first, ...rest] = current;
    persist(rest);
    set({ boosts: rest });
    return first;
  },
  hasSource: (source) => {
    const now = Date.now();
    return pruneExpired(get().boosts, now).some((boost) => boost.source === source);
  },
  refresh: () => {
    const now = Date.now();
    const cleaned = pruneExpired(get().boosts, now);
    if (cleaned.length !== get().boosts.length) {
      persist(cleaned);
      set({ boosts: cleaned });
    }
  },
}));

if (typeof window !== 'undefined') {
  const boosts = pruneExpired(readStoredBoosts(), Date.now());
  persist(boosts);
  useRewardBoostStore.setState({ boosts });
  window.__rubbleRewardBoostStore = useRewardBoostStore;
}

declare global {
  interface Window {
    __rubbleRewardBoostStore?: typeof useRewardBoostStore;
  }
}
