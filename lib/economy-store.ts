'use client';

import { create } from 'zustand';

export type EconomyAddress = `0x${string}`;

type InviteLedger = Record<string, number>;

type EconomyData = {
  address?: EconomyAddress;
  bubbles: number;
  boosts: number;
  retries: number;
  skins: string[];
  stickers: string[];
  streak: number;
  lastLogin: string | null;
  trialUsedToday: boolean;
  shareClaimedToday: boolean;
  inviteLedger: InviteLedger;
  dailyRewardClaimedAt: string | null;
  doubleScoreAvailable: boolean;
};

type EconomyState = EconomyData & {
  connect: (address: string) => void;
  disconnect: () => void;
  refreshDay: () => void;
  grantBoost: (n: number) => void;
  spendBoost: (n?: number) => boolean;
  grantRetry: (n: number) => void;
  spendRetry: (n?: number) => boolean;
  grantTrialToday: () => void;
  unlockTrialToday: () => void;
  addBubbles: (n: number) => void;
  spendBubbles: (n: number) => boolean;
  addSkin: (skin: string) => void;
  addSticker: (sticker: string) => void;
  grantDoubleScore: () => void;
  consumeDoubleScore: () => boolean;
  recordShareToday: () => void;
  recordInviteUse: (code: string) => void;
  setDailyRewardClaimed: (date: string) => void;
};

const STORAGE_KEYS = {
  address: 'rubble:addr',
  bubbles: 'rubble:bubbles',
  boosts: 'rubble:boosts',
  retries: 'rubble:retries',
  skins: 'rubble:skins',
  stickers: 'rubble:stickers',
  lastLogin: 'rubble:last-login',
  streak: 'rubble:streak',
  doubleScore: 'rubble:double-score',
} as const;

function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function isConsecutiveDay(previous: string, current: string) {
  if (!previous) return false;
  const prevDate = new Date(`${previous.slice(0, 4)}-${previous.slice(4, 6)}-${previous.slice(6, 8)}T00:00:00`);
  const currDate = new Date(`${current.slice(0, 4)}-${current.slice(4, 6)}-${current.slice(6, 8)}T00:00:00`);
  const diff = currDate.getTime() - prevDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return diff > 0 && diff <= dayMs * 1.5;
}

function readNumber(key: string, fallback = 0) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function writeNumber(key: string, value: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, Math.max(0, Math.floor(value)).toString());
}

function readJsonArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((item) => typeof item === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, value: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(value))));
  } catch {
    // ignore
  }
}

function readInviteLedger(address?: string): InviteLedger {
  if (typeof window === 'undefined' || !address) return {};
  const key = `rubble:invites:${address.toLowerCase()}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as InviteLedger;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeInviteLedger(address: string, ledger: InviteLedger) {
  if (typeof window === 'undefined') return;
  const key = `rubble:invites:${address.toLowerCase()}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(ledger));
  } catch {
    // ignore persistence issues
  }
}

function readDailyRewardClaim(today: string) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(`rubble:daily:${today}`);
}

function markDailyRewardClaim(today: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`rubble:daily:${today}`, today);
}

function readTrialFlag(today: string, address?: string) {
  if (typeof window === 'undefined') return false;
  const baseKey = `rubble:trial:${today}`;
  if (address) {
    return window.localStorage.getItem(`${baseKey}:${address.toLowerCase()}`) === '1';
  }
  return window.localStorage.getItem(baseKey) === '1';
}

function markTrialFlag(today: string, address?: string) {
  if (typeof window === 'undefined') return;
  const baseKey = `rubble:trial:${today}`;
  if (address) {
    window.localStorage.setItem(`${baseKey}:${address.toLowerCase()}`, '1');
  } else {
    window.localStorage.setItem(baseKey, '1');
  }
}

function clearTrialFlag(today: string, address?: string) {
  if (typeof window === 'undefined') return;
  const baseKey = `rubble:trial:${today}`;
  if (address) {
    window.localStorage.removeItem(`${baseKey}:${address.toLowerCase()}`);
  } else {
    window.localStorage.removeItem(baseKey);
  }
}

function readShareFlag(today: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`rubble:share:${today}`) === '1';
}

function markShareFlag(today: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`rubble:share:${today}`, '1');
}

function readDoubleScore() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEYS.doubleScore) === '1';
}

function writeDoubleScore(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(STORAGE_KEYS.doubleScore, '1');
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.doubleScore);
  }
}

const initialState: EconomyData = (() => {
  const defaults: EconomyData = {
    address: undefined as EconomyAddress | undefined,
    bubbles: 0,
    boosts: 0,
    retries: 0,
    skins: [] as string[],
    stickers: [] as string[],
    streak: 0,
    lastLogin: null as string | null,
    trialUsedToday: false,
    shareClaimedToday: false,
    inviteLedger: {} as InviteLedger,
    dailyRewardClaimedAt: null as string | null,
    doubleScoreAvailable: false,
  };
  if (typeof window === 'undefined') {
    return defaults;
  }
  const addressRaw = window.localStorage.getItem(STORAGE_KEYS.address) ?? undefined;
  const address = addressRaw && /^0x[a-f0-9]{40}$/u.test(addressRaw.toLowerCase())
    ? (addressRaw as EconomyAddress)
    : undefined;
  const bubbles = readNumber(STORAGE_KEYS.bubbles, 0);
  const boosts = readNumber(STORAGE_KEYS.boosts, 0);
  const retries = readNumber(STORAGE_KEYS.retries, 0);
  const skins = readJsonArray(STORAGE_KEYS.skins);
  const stickers = readJsonArray(STORAGE_KEYS.stickers);
  const today = getTodayKey();
  const lastLogin = window.localStorage.getItem(STORAGE_KEYS.lastLogin);
  let streak = readNumber(STORAGE_KEYS.streak, 0);
  if (lastLogin === today) {
    // no-op
  } else if (lastLogin && isConsecutiveDay(lastLogin, today)) {
    streak += 1;
  } else {
    streak = 1;
  }
  window.localStorage.setItem(STORAGE_KEYS.lastLogin, today);
  window.localStorage.setItem(STORAGE_KEYS.streak, streak.toString());
  const trialUsedToday = readTrialFlag(today, address);
  const shareClaimedToday = readShareFlag(today);
  const inviteLedger = readInviteLedger(address);
  const dailyRewardClaimedAt = readDailyRewardClaim(today);
  const doubleScoreAvailable = readDoubleScore();
  const base: EconomyData = {
    address,
    bubbles,
    boosts,
    retries,
    skins,
    stickers,
    streak,
    lastLogin: today,
    trialUsedToday,
    shareClaimedToday,
    inviteLedger,
    dailyRewardClaimedAt,
    doubleScoreAvailable,
  };
  return base;
})();

export const useEconomyStore = create<EconomyState>((set, get) => ({
  ...initialState,
  connect: (address) => {
    const normalised = address as EconomyAddress;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.address, normalised);
    }
    set((state) => ({
      ...state,
      address: normalised,
      inviteLedger: readInviteLedger(normalised),
    }));
    const grantKey = `rubble:boost-grant:${normalised.toLowerCase()}`;
    if (typeof window !== 'undefined' && !window.localStorage.getItem(grantKey)) {
      window.localStorage.setItem(grantKey, '1');
      get().grantBoost(1);
    }
    get().refreshDay();
  },
  disconnect: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEYS.address);
    }
    set((state) => ({
      ...state,
      address: undefined,
      inviteLedger: {},
    }));
    get().refreshDay();
  },
  refreshDay: () => {
    if (typeof window === 'undefined') return;
    const today = getTodayKey();
    const address = get().address;
    const trialUsedToday = readTrialFlag(today, address);
    const shareClaimedToday = readShareFlag(today);
    const dailyRewardClaimedAt = readDailyRewardClaim(today);
    const streak = readNumber(STORAGE_KEYS.streak, get().streak || 0);
    set((state) => ({
      ...state,
      trialUsedToday,
      shareClaimedToday,
      dailyRewardClaimedAt,
      streak,
      lastLogin: today,
    }));
  },
  grantBoost: (n) => {
    if (n <= 0) return;
    set((state) => {
      const next = state.boosts + n;
      writeNumber(STORAGE_KEYS.boosts, next);
      return { ...state, boosts: next };
    });
  },
  spendBoost: (n = 1) => {
    const current = get().boosts;
    if (current < n) return false;
    const next = current - n;
    writeNumber(STORAGE_KEYS.boosts, next);
    set((state) => ({ ...state, boosts: next }));
    return true;
  },
  grantRetry: (n) => {
    if (n <= 0) return;
    set((state) => {
      const next = state.retries + n;
      writeNumber(STORAGE_KEYS.retries, next);
      return { ...state, retries: next };
    });
  },
  spendRetry: (n = 1) => {
    const current = get().retries;
    if (current < n) return false;
    const next = current - n;
    writeNumber(STORAGE_KEYS.retries, next);
    set((state) => ({ ...state, retries: next }));
    return true;
  },
  grantTrialToday: () => {
    const today = getTodayKey();
    const address = get().address;
    markTrialFlag(today, address);
    set((state) => ({ ...state, trialUsedToday: true }));
  },
  unlockTrialToday: () => {
    const today = getTodayKey();
    const address = get().address;
    clearTrialFlag(today, address);
    set((state) => ({ ...state, trialUsedToday: false }));
  },
  addBubbles: (n) => {
    if (n <= 0) return;
    set((state) => {
      const next = state.bubbles + n;
      writeNumber(STORAGE_KEYS.bubbles, next);
      return { ...state, bubbles: next };
    });
  },
  spendBubbles: (n) => {
    const current = get().bubbles;
    if (n <= 0 || current < n) return false;
    const next = current - n;
    writeNumber(STORAGE_KEYS.bubbles, next);
    set((state) => ({ ...state, bubbles: next }));
    return true;
  },
  addSkin: (skin) => {
    if (!skin) return;
    set((state) => {
      if (state.skins.includes(skin)) return state;
      const nextSkins = [...state.skins, skin];
      writeJsonArray(STORAGE_KEYS.skins, nextSkins);
      return { ...state, skins: nextSkins };
    });
  },
  addSticker: (sticker) => {
    if (!sticker) return;
    set((state) => {
      if (state.stickers.includes(sticker)) return state;
      const nextStickers = [...state.stickers, sticker];
      writeJsonArray(STORAGE_KEYS.stickers, nextStickers);
      return { ...state, stickers: nextStickers };
    });
  },
  grantDoubleScore: () => {
    writeDoubleScore(true);
    set((state) => ({ ...state, doubleScoreAvailable: true }));
  },
  consumeDoubleScore: () => {
    const available = get().doubleScoreAvailable;
    if (!available) return false;
    writeDoubleScore(false);
    set((state) => ({ ...state, doubleScoreAvailable: false }));
    return true;
  },
  recordShareToday: () => {
    const today = getTodayKey();
    markShareFlag(today);
    set((state) => ({ ...state, shareClaimedToday: true }));
  },
  recordInviteUse: (code) => {
    if (!code) return;
    const address = get().address;
    if (!address) return;
    set((state) => {
      const ledger = { ...state.inviteLedger };
      ledger[code] = (ledger[code] ?? 0) + 1;
      writeInviteLedger(address, ledger);
      return { ...state, inviteLedger: ledger };
    });
  },
  setDailyRewardClaimed: (date) => {
    if (!date) return;
    markDailyRewardClaim(date);
    set((state) => ({ ...state, dailyRewardClaimedAt: date }));
  },
}));

export type { EconomyState };
