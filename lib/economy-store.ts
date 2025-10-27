'use client';

import { create } from 'zustand';

const ADDRESS_KEY = 'rubble:addr';
const BUBBLES_KEY = 'rubble:bubbles';
const BOOSTS_KEY = 'rubble:boosts';
const RETRIES_KEY = 'rubble:retries';
const SKINS_KEY = 'rubble:skins';
const STICKERS_KEY = 'rubble:stickers';
const LAST_LOGIN_KEY = 'rubble:last-login';
const STREAK_KEY = 'rubble:streak';
const DOUBLE_SCORE_KEY = 'rubble:double-score-games';
const COMBO_START_KEY = 'rubble:combo-start';
const SHARE_PREFIX = 'rubble:share:';
const INVITES_PREFIX = 'rubble:invites:';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore persistence issues
  }
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore persistence issues
  }
}

function readNumber(key: string, fallback = 0): number {
  const raw = readStorage(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStringArray(key: string): string[] {
  const raw = readStorage(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed as string[];
    }
    return [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, value: string[]) {
  writeStorage(key, JSON.stringify(value));
}

function todayKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear().toString().padStart(4, '0');
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = now.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${d}`;
}

function trialKey(address?: string) {
  return `rubble:trial:${todayKey()}:${address ?? 'anon'}`;
}

function shareKey() {
  return `${SHARE_PREFIX}${todayKey()}`;
}

function ensureShareKey(): boolean {
  return readStorage(shareKey()) === '1';
}

function markShareKey() {
  writeStorage(shareKey(), '1');
}

function computeNextStreak(lastLoginIso: string | null, stored: number): { streak: number; newLogin: string } {
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const isoToday = todayDate.toISOString();
  if (!lastLoginIso) {
    return { streak: Math.max(1, stored || 1), newLogin: isoToday };
  }
  const last = new Date(lastLoginIso);
  if (Number.isNaN(last.getTime())) {
    return { streak: Math.max(1, stored || 1), newLogin: isoToday };
  }
  const lastDate = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
  const diffMs = todayDate.getTime() - lastDate.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays <= 0) {
    return { streak: stored || 1, newLogin: isoToday };
  }
  if (diffDays === 1) {
    return { streak: Math.max(1, stored + 1), newLogin: isoToday };
  }
  return { streak: 1, newLogin: isoToday };
}

export type EconomyState = {
  address?: `0x${string}`;
  bubbles: number;
  boosts: number;
  retries: number;
  skins: string[];
  stickers: string[];
  streak: number;
  lastLogin: string | null;
  trialUsedToday: boolean;
  shareRewardedToday: boolean;
  invitesUsed: Record<string, number>;
  hydrated: boolean;
  doubleScoreGames: number;
  comboStartBonus: number;
  connect: (address: string) => void;
  hydrate: () => void;
  grantBoost: (count: number) => void;
  spendBoost: (count?: number) => boolean;
  addBubbles: (amount: number) => void;
  spendBubbles: (amount: number) => boolean;
  grantRetry: (count?: number) => void;
  spendRetry: () => boolean;
  addSkin: (skinId: string) => void;
  addSticker: (stickerId: string) => void;
  grantTrialToday: () => void;
  resetTrial: () => void;
  recordShareToday: () => void;
  recordInviteUse: (code: string) => void;
  noteDailyLogin: () => void;
  grantDoubleScore: (games: number) => void;
  consumeDoubleScore: () => boolean;
  addComboStart: (amount: number) => void;
  consumeComboStart: () => number;
};

function readInviteCounts(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }
  const invites: Record<string, number> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(INVITES_PREFIX)) continue;
      const address = key.slice(INVITES_PREFIX.length).toLowerCase();
      const value = window.localStorage.getItem(key);
      if (!value) continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        invites[address] = parsed;
      }
    }
  } catch {
    return invites;
  }
  return invites;
}

export const useEconomyStore = create<EconomyState>((set, get) => ({
  address: undefined,
  bubbles: 0,
  boosts: 0,
  retries: 0,
  skins: [],
  stickers: [],
  streak: 0,
  lastLogin: null,
  trialUsedToday: false,
  shareRewardedToday: false,
  invitesUsed: {},
  hydrated: false,
  doubleScoreGames: 0,
  comboStartBonus: 0,
  hydrate: () => {
    if (get().hydrated) {
      return;
    }
    const address = readStorage(ADDRESS_KEY) ?? undefined;
    const boosts = readNumber(BOOSTS_KEY, 0);
    const retries = readNumber(RETRIES_KEY, 0);
    const bubbles = readNumber(BUBBLES_KEY, 0);
    const skins = readStringArray(SKINS_KEY);
    const stickers = readStringArray(STICKERS_KEY);
    const lastLogin = readStorage(LAST_LOGIN_KEY);
    const streakValue = readNumber(STREAK_KEY, 0);
    const inviteCounts = readInviteCounts();
    const shareRewardedToday = ensureShareKey();
    const doubleScoreGames = readNumber(DOUBLE_SCORE_KEY, 0);
    const comboStartBonus = readNumber(COMBO_START_KEY, 0);
    let trialUsedToday = false;
    if (address) {
      trialUsedToday = readStorage(trialKey(address)) === '1';
    }
    set({
      address: address as `0x${string}` | undefined,
      boosts,
      retries,
      bubbles,
      skins,
      stickers,
      streak: streakValue,
      lastLogin,
      trialUsedToday,
      shareRewardedToday,
      invitesUsed: inviteCounts,
      doubleScoreGames,
      comboStartBonus,
      hydrated: true,
    });
  },
  connect: (address: string) => {
    const normalised = address.toLowerCase() as `0x${string}`;
    writeStorage(ADDRESS_KEY, normalised);
    set({ address: normalised });
    const state = get();
    const boostKey = `rubble:first-connect:${normalised}`;
    const alreadyGranted = readStorage(boostKey) === '1';
    if (!alreadyGranted) {
      set({ boosts: state.boosts + 1 });
      writeStorage(BOOSTS_KEY, String(state.boosts + 1));
      writeStorage(boostKey, '1');
    }
    set({ trialUsedToday: readStorage(trialKey(normalised)) === '1' });
  },
  grantBoost: (count: number) => {
    const next = Math.max(0, get().boosts + count);
    set({ boosts: next });
    writeStorage(BOOSTS_KEY, String(next));
  },
  spendBoost: (count = 1) => {
    const state = get();
    if (state.boosts < count) {
      return false;
    }
    const next = state.boosts - count;
    set({ boosts: next });
    writeStorage(BOOSTS_KEY, String(next));
    return true;
  },
  addBubbles: (amount: number) => {
    const next = Math.max(0, get().bubbles + amount);
    set({ bubbles: next });
    writeStorage(BUBBLES_KEY, String(next));
  },
  spendBubbles: (amount: number) => {
    const state = get();
    if (state.bubbles < amount) {
      return false;
    }
    const next = state.bubbles - amount;
    set({ bubbles: next });
    writeStorage(BUBBLES_KEY, String(next));
    return true;
  },
  grantRetry: (count = 1) => {
    const next = Math.max(0, get().retries + count);
    set({ retries: next });
    writeStorage(RETRIES_KEY, String(next));
  },
  spendRetry: () => {
    const state = get();
    if (state.retries <= 0) {
      return false;
    }
    const next = state.retries - 1;
    set({ retries: next });
    writeStorage(RETRIES_KEY, String(next));
    return true;
  },
  addSkin: (skinId: string) => {
    const current = new Set(get().skins);
    current.add(skinId);
    const list = Array.from(current);
    set({ skins: list });
    writeStringArray(SKINS_KEY, list);
  },
  addSticker: (stickerId: string) => {
    const current = new Set(get().stickers);
    current.add(stickerId);
    const list = Array.from(current);
    set({ stickers: list });
    writeStringArray(STICKERS_KEY, list);
  },
  grantTrialToday: () => {
    const state = get();
    const key = trialKey(state.address);
    writeStorage(key, '1');
    set({ trialUsedToday: true });
  },
  resetTrial: () => {
    const state = get();
    const key = trialKey(state.address);
    removeStorage(key);
    set({ trialUsedToday: false });
  },
  recordShareToday: () => {
    markShareKey();
    if (!get().shareRewardedToday) {
      set({ shareRewardedToday: true });
    }
  },
  recordInviteUse: (address: string) => {
    if (!address) return;
    const key = address.toLowerCase();
    const state = get();
    const next = { ...state.invitesUsed };
    next[key] = (next[key] ?? 0) + 1;
    set({ invitesUsed: next });
    writeStorage(`${INVITES_PREFIX}${key}`, String(next[key]));
  },
  noteDailyLogin: () => {
    const state = get();
    const result = computeNextStreak(state.lastLogin, state.streak);
    set({ streak: result.streak, lastLogin: result.newLogin });
    writeStorage(LAST_LOGIN_KEY, result.newLogin);
    writeStorage(STREAK_KEY, String(result.streak));
  },
  grantDoubleScore: (games: number) => {
    if (games <= 0) return;
    const next = get().doubleScoreGames + games;
    set({ doubleScoreGames: next });
    writeStorage(DOUBLE_SCORE_KEY, String(next));
  },
  consumeDoubleScore: () => {
    const current = get().doubleScoreGames;
    if (current <= 0) {
      return false;
    }
    const next = current - 1;
    set({ doubleScoreGames: next });
    writeStorage(DOUBLE_SCORE_KEY, String(next));
    return true;
  },
  addComboStart: (amount: number) => {
    if (amount <= 0) return;
    const next = get().comboStartBonus + amount;
    set({ comboStartBonus: next });
    writeStorage(COMBO_START_KEY, String(next));
  },
  consumeComboStart: () => {
    const current = get().comboStartBonus;
    if (current <= 0) {
      return 0;
    }
    set({ comboStartBonus: 0 });
    writeStorage(COMBO_START_KEY, '0');
    return current;
  },
}));

export function economyTodayKey() {
  return todayKey();
}
