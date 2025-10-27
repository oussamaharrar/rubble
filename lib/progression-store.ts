'use client';

import { create } from 'zustand';

export type ProgressionState = {
  level: number;
  xp: number;
  gainXp: (amount: number) => void;
  reset: () => void;
};

const STORAGE_KEYS = {
  level: 'rubble:level',
  xp: 'rubble:xp',
} as const;

function readNumber(key: string, fallback = 0) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function writeNumber(key: string, value: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, Math.max(0, Math.floor(value)).toString());
}

function computeInitialState() {
  if (typeof window === 'undefined') {
    return { level: 1, xp: 0 };
  }
  const level = Math.max(1, readNumber(STORAGE_KEYS.level, 1));
  const xp = Math.max(0, readNumber(STORAGE_KEYS.xp, 0));
  return { level, xp };
}

const initial = computeInitialState();

export const useProgressionStore = create<ProgressionState>((set) => ({
  ...initial,
  gainXp: (amount) => {
    if (amount <= 0) return;
    set((state) => {
      const totalXp = state.xp + amount;
      let level = state.level;
      let xpRemainder = totalXp;
      const threshold = 120;
      while (xpRemainder >= threshold) {
        xpRemainder -= threshold;
        level += 1;
      }
      writeNumber(STORAGE_KEYS.xp, xpRemainder);
      writeNumber(STORAGE_KEYS.level, level);
      return { level, xp: xpRemainder };
    });
  },
  reset: () => {
    writeNumber(STORAGE_KEYS.level, 1);
    writeNumber(STORAGE_KEYS.xp, 0);
    set({ level: 1, xp: 0 });
  },
}));
