'use client';

import { create } from 'zustand';
import { decodeReferralCode } from '@/lib/referrals';

const STORAGE_KEYS = {
  address: 'rubble:addr',
  lastLogin: 'rubble:last-login',
  streak: 'rubble:streak',
  boosts: 'rubble:boosts',
  retries: 'rubble:retries',
  bubbles: 'rubble:bubbles',
  skins: 'rubble:skins',
  stickers: 'rubble:stickers',
  doubleScore: 'rubble:double-score',
} as const;

const FIRST_CONNECT_PREFIX = 'rubble:first-connect:';
const TRIAL_PREFIX = 'rubble:trial';
const SHARE_PREFIX = 'rubble:share';
const REWARD_PREFIX = 'rubble:reward';
const INVITES_PREFIX = 'rubble:invites:';
const INVITES_PENDING_PREFIX = 'rubble:invites:pending:';
const INVITE_CLAIM_PREFIX = 'rubble:invite-claimed:';

const SPECIAL_SKIN_ID = 'special-balloon-skin';
const SPECIAL_STICKER_ID = 'daily-sticker';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readNumber(key: string, fallback = 0) {
  if (!isBrowser()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function writeNumber(key: string, value: number) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, value.toString());
}

function readString(key: string) {
  if (!isBrowser()) return undefined;
  const value = window.localStorage.getItem(key);
  return value ?? undefined;
}

function writeString(key: string, value: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, value);
}

function readStringArray(key: string) {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function writeStringArray(key: string, value: string[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normaliseAddress(address: string) {
  const trimmed = address.trim();
  return (trimmed.startsWith('0x') ? trimmed.toLowerCase() : `0x${trimmed.toLowerCase()}`) as `0x${string}`;
}

function getIsoDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function getCompactDate(date = new Date()) {
  return getIsoDate(date).replace(/-/g, '');
}

function getTrialKey(address: string | undefined, date = new Date()) {
  const target = address ? normaliseAddress(address) : 'guest';
  return `${TRIAL_PREFIX}:${getCompactDate(date)}:${target}`;
}

function getShareKey(date = new Date()) {
  return `${SHARE_PREFIX}:${getCompactDate(date)}`;
}

function getRewardKey(date = new Date()) {
  return `${REWARD_PREFIX}:${getIsoDate(date)}`;
}

function getInviteKey(address: string) {
  return `${INVITES_PREFIX}${normaliseAddress(address)}`;
}

function getInvitePendingKey(address: string) {
  return `${INVITES_PENDING_PREFIX}${normaliseAddress(address)}`;
}

function getInviteClaimKey(referrer: string, friend: string) {
  return `${INVITE_CLAIM_PREFIX}${normaliseAddress(referrer)}:${normaliseAddress(friend)}`;
}

function daysBetween(previous: string | undefined, current: string) {
  if (!previous) return Number.POSITIVE_INFINITY;
  const prev = new Date(previous);
  const now = new Date(current);
  const diff = now.getTime() - prev.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

type DailyRewardType =
  | { kind: 'boost'; amount: number; label: string; description: string }
  | { kind: 'bubbles'; amount: number; label: string; description: string }
  | { kind: 'double-score'; amount: number; label: string; description: string }
  | { kind: 'skin'; id: string; label: string; description: string }
  | { kind: 'sticker'; id: string; label: string; description: string }
  | { kind: 'wheel'; label: string; description: string; result?: DailyRewardType };

type DailyRewardResult = {
  reward: DailyRewardType;
  streak: number;
};

function resolveWheelReward(): DailyRewardType {
  const options: DailyRewardType[] = [
    { kind: 'boost', amount: 2, label: 'Bonus Boost ×2', description: 'Two extra boosts to chain massive combos.' },
    { kind: 'bubbles', amount: 150, label: '150 Bubbles', description: 'Soft currency to spend in the Home shop.' },
    { kind: 'double-score', amount: 1, label: 'Double Score Run', description: 'One game with double score multiplier.' },
    { kind: 'sticker', id: 'foil-wheel', label: 'Foil Sticker', description: 'Limited edition wheel spin sticker.' },
  ];
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return options[buffer[0] % options.length];
  }
  const index = Math.floor(Math.random() * options.length);
  return options[index];
}

function rewardForStreak(day: number): DailyRewardType {
  if (day <= 1) {
    return { kind: 'boost', amount: 1, label: 'Starter Boost', description: 'A free boost to kick off your run.' };
  }
  if (day === 2) {
    return { kind: 'bubbles', amount: 50, label: '+50 Bubbles', description: 'Spend bubbles on cosmetics and retries.' };
  }
  if (day === 3) {
    return {
      kind: 'double-score',
      amount: 1,
      label: 'Double Score',
      description: 'Your next game earns double points.',
    };
  }
  if (day === 4) {
    return {
      kind: 'skin',
      id: SPECIAL_SKIN_ID,
      label: 'Special Balloon Skin',
      description: 'A shimmering balloon skin unlocked for your collection.',
    };
  }
  if (day === 5) {
    return {
      kind: 'sticker',
      id: SPECIAL_STICKER_ID,
      label: 'Rubble Sticker',
      description: 'Collectible sticker celebrating your streak.',
    };
  }
  if (day === 6) {
    return {
      kind: 'bubbles',
      amount: 80,
      label: '+80 Bubbles',
      description: 'Keep the streak alive with extra soft currency.',
    };
  }
  return { kind: 'wheel', label: 'Wheel Spin', description: 'Spin for a surprise prize!' };
}

export function previewDailyReward(streak: number, lastLogin: string | undefined): DailyRewardType {
  const todayIso = getIsoDate(new Date());
  const diff = daysBetween(lastLogin, todayIso);
  const targetDay = diff === 0 ? Math.max(1, streak) : diff === 1 ? Math.max(1, streak + 1) : 1;
  return rewardForStreak(targetDay);
}

export type EconomyState = {
  address?: `0x${string}`;
  bubbles: number;
  boosts: number;
  retries: number;
  skins: string[];
  stickers: string[];
  trialUsedToday: boolean;
  streak: number;
  lastLogin?: string;
  todayRewardClaimed: boolean;
  shareRewardedToday: boolean;
  doubleScoreGames: number;
  inviteCount: number;
  connect(address: string): void;
  grantBoost(n: number): void;
  spendBoost(n: number): boolean;
  grantTrialToday(addressOverride?: string): void;
  markTrialUsed(addressOverride?: string): void;
  addBubbles(n: number): void;
  spendBubbles(n: number): boolean;
  grantRetry(n: number): void;
  spendRetry(n: number): boolean;
  addSkin(id: string): void;
  addSticker(id: string): void;
  grantDoubleScoreGames(n: number): void;
  consumeDoubleScoreGame(): boolean;
  recordShareToday(): boolean;
  recordInviteUse(code: string): void;
  hydrate(addressOverride?: string): void;
  claimDailyReward(): DailyRewardResult | null;
};

type EconomySnapshot = Omit<EconomyState, keyof EconomyActions>;

type EconomyActions = Pick<
  EconomyState,
  | 'connect'
  | 'grantBoost'
  | 'spendBoost'
  | 'grantTrialToday'
  | 'markTrialUsed'
  | 'addBubbles'
  | 'spendBubbles'
  | 'grantRetry'
  | 'spendRetry'
  | 'addSkin'
  | 'addSticker'
  | 'grantDoubleScoreGames'
  | 'consumeDoubleScoreGame'
  | 'recordShareToday'
  | 'recordInviteUse'
  | 'hydrate'
  | 'claimDailyReward'
>;

function readSnapshot(addressOverride?: string): EconomySnapshot {
  const address = addressOverride
    ? normaliseAddress(addressOverride)
    : (readString(STORAGE_KEYS.address) as `0x${string}` | undefined);
  const streak = readNumber(STORAGE_KEYS.streak, 0);
  const lastLogin = readString(STORAGE_KEYS.lastLogin);
  const today = new Date();
  const trialKey = getTrialKey(address, today);
  const rewardKey = getRewardKey(today);
  const shareKey = getShareKey(today);
  const doubleScore = readNumber(STORAGE_KEYS.doubleScore, 0);

  return {
    address,
    bubbles: readNumber(STORAGE_KEYS.bubbles, 0),
    boosts: readNumber(STORAGE_KEYS.boosts, 0),
    retries: readNumber(STORAGE_KEYS.retries, 0),
    skins: readStringArray(STORAGE_KEYS.skins),
    stickers: readStringArray(STORAGE_KEYS.stickers),
    trialUsedToday: isBrowser() ? window.localStorage.getItem(trialKey) === '1' : false,
    streak,
    lastLogin: lastLogin ?? undefined,
    todayRewardClaimed: isBrowser() ? window.localStorage.getItem(rewardKey) === '1' : false,
    shareRewardedToday: isBrowser() ? window.localStorage.getItem(shareKey) === '1' : false,
    doubleScoreGames: doubleScore,
    inviteCount: address ? readNumber(getInviteKey(address), 0) : 0,
  };
}

const defaultState: EconomySnapshot = {
  address: undefined,
  bubbles: 0,
  boosts: 0,
  retries: 0,
  skins: [],
  stickers: [],
  trialUsedToday: false,
  streak: 0,
  lastLogin: undefined,
  todayRewardClaimed: false,
  shareRewardedToday: false,
  doubleScoreGames: 0,
  inviteCount: 0,
};

export const useEconomyStore = create<EconomyState>((set, get) => ({
  ...defaultState,
  hydrate: (addressOverride?: string) => {
    if (!isBrowser()) return;
    set(() => readSnapshot(addressOverride));
  },
  connect: (address: string) => {
    const normalised = normaliseAddress(address);
    if (!isBrowser()) {
      set({ address: normalised });
      return;
    }
    writeString(STORAGE_KEYS.address, normalised);
    const firstKey = `${FIRST_CONNECT_PREFIX}${normalised}`;
    const isFirstConnect = window.localStorage.getItem(firstKey) !== '1';
    if (isFirstConnect) {
      window.localStorage.setItem(firstKey, '1');
    }
    set((state) => {
      const next = { ...state, address: normalised };
      if (isFirstConnect) {
        const updatedBoosts = state.boosts + 1;
        writeNumber(STORAGE_KEYS.boosts, updatedBoosts);
        next.boosts = updatedBoosts;
      }
      return next;
    });
    get().hydrate(normalised);
    const pendingKey = getInvitePendingKey(normalised);
    const pending = readNumber(pendingKey, 0);
    if (pending > 0) {
      set((state) => {
        const updatedBoosts = state.boosts + pending;
        writeNumber(STORAGE_KEYS.boosts, updatedBoosts);
        window.localStorage.removeItem(pendingKey);
        return { ...state, boosts: updatedBoosts };
      });
    }
    get().hydrate(normalised);
  },
  grantBoost: (n: number) => {
    if (n <= 0) return;
    set((state) => {
      const updated = state.boosts + n;
      writeNumber(STORAGE_KEYS.boosts, updated);
      return { ...state, boosts: updated };
    });
  },
  spendBoost: (n: number) => {
    if (n <= 0) return true;
    const state = get();
    if (state.boosts < n) {
      return false;
    }
    const updated = state.boosts - n;
    writeNumber(STORAGE_KEYS.boosts, updated);
    set({ boosts: updated });
    return true;
  },
  grantTrialToday: (addressOverride?: string) => {
    if (!isBrowser()) return;
    const state = get();
    const key = getTrialKey(addressOverride ?? state.address, new Date());
    window.localStorage.removeItem(key);
    set({ trialUsedToday: false });
  },
  markTrialUsed: (addressOverride?: string) => {
    if (!isBrowser()) return;
    const state = get();
    const key = getTrialKey(addressOverride ?? state.address, new Date());
    window.localStorage.setItem(key, '1');
    set({ trialUsedToday: true });
  },
  addBubbles: (n: number) => {
    if (n <= 0) return;
    set((state) => {
      const updated = state.bubbles + n;
      writeNumber(STORAGE_KEYS.bubbles, updated);
      return { ...state, bubbles: updated };
    });
  },
  spendBubbles: (n: number) => {
    if (n <= 0) return true;
    const state = get();
    if (state.bubbles < n) return false;
    const updated = state.bubbles - n;
    writeNumber(STORAGE_KEYS.bubbles, updated);
    set({ bubbles: updated });
    return true;
  },
  grantRetry: (n: number) => {
    if (n <= 0) return;
    set((state) => {
      const updated = state.retries + n;
      writeNumber(STORAGE_KEYS.retries, updated);
      return { ...state, retries: updated };
    });
  },
  spendRetry: (n: number) => {
    if (n <= 0) return true;
    const state = get();
    if (state.retries < n) return false;
    const updated = state.retries - n;
    writeNumber(STORAGE_KEYS.retries, updated);
    set({ retries: updated });
    return true;
  },
  addSkin: (id: string) => {
    set((state) => {
      if (state.skins.includes(id)) {
        return state;
      }
      const nextSkins = [...state.skins, id];
      writeStringArray(STORAGE_KEYS.skins, nextSkins);
      return { ...state, skins: nextSkins };
    });
  },
  addSticker: (id: string) => {
    set((state) => {
      if (state.stickers.includes(id)) {
        return state;
      }
      const next = [...state.stickers, id];
      writeStringArray(STORAGE_KEYS.stickers, next);
      return { ...state, stickers: next };
    });
  },
  grantDoubleScoreGames: (n: number) => {
    if (n <= 0) return;
    set((state) => {
      const updated = state.doubleScoreGames + n;
      writeNumber(STORAGE_KEYS.doubleScore, updated);
      return { ...state, doubleScoreGames: updated };
    });
  },
  consumeDoubleScoreGame: () => {
    const state = get();
    if (state.doubleScoreGames <= 0) return false;
    const updated = state.doubleScoreGames - 1;
    writeNumber(STORAGE_KEYS.doubleScore, updated);
    set({ doubleScoreGames: updated });
    return true;
  },
  recordShareToday: () => {
    if (!isBrowser()) return false;
    const key = getShareKey(new Date());
    if (window.localStorage.getItem(key) === '1') {
      set({ shareRewardedToday: true });
      return false;
    }
    window.localStorage.setItem(key, '1');
    set((state) => {
      const updated = state.boosts + 1;
      writeNumber(STORAGE_KEYS.boosts, updated);
      return { ...state, boosts: updated, shareRewardedToday: true };
    });
    return true;
  },
  recordInviteUse: (code: string) => {
    if (!isBrowser()) return;
    if (!code) return;
    const referrer = decodeReferralCode(code);
    if (!referrer) return;
    const key = getInviteKey(referrer);
    const pendingKey = getInvitePendingKey(referrer);
    const current = readNumber(key, 0) + 1;
    writeNumber(key, current);
    const pending = readNumber(pendingKey, 0) + 1;
    writeNumber(pendingKey, pending);
    const state = get();
    if (state.address && normaliseAddress(state.address) === normaliseAddress(referrer)) {
      const updatedBoosts = state.boosts + 1;
      writeNumber(STORAGE_KEYS.boosts, updatedBoosts);
      set({ boosts: updatedBoosts, inviteCount: state.inviteCount + 1 });
      writeNumber(pendingKey, Math.max(0, pending - 1));
    }
  },
  claimDailyReward: () => {
    if (!isBrowser()) return null;
    const state = get();
    const todayIso = getIsoDate(new Date());
    const rewardKey = getRewardKey(new Date());
    if (window.localStorage.getItem(rewardKey) === '1') {
      return null;
    }
    const diff = daysBetween(state.lastLogin, todayIso);
    const nextStreak = diff === 0 ? state.streak : diff === 1 ? state.streak + 1 : 1;
    const reward = rewardForStreak(nextStreak);

    const apply = (rewardToApply: DailyRewardType) => {
      switch (rewardToApply.kind) {
        case 'boost':
          get().grantBoost(rewardToApply.amount);
          break;
        case 'bubbles':
          get().addBubbles(rewardToApply.amount);
          break;
        case 'double-score':
          get().grantDoubleScoreGames(rewardToApply.amount);
          break;
        case 'skin':
          get().addSkin(rewardToApply.id);
          break;
        case 'sticker':
          get().addSticker(rewardToApply.id);
          break;
        case 'wheel': {
          const spin = resolveWheelReward();
          apply(spin);
          rewardToApply.result = spin;
          break;
        }
        default:
          break;
      }
    };

    apply(reward);

    window.localStorage.setItem(rewardKey, '1');
    writeString(STORAGE_KEYS.lastLogin, todayIso);
    writeNumber(STORAGE_KEYS.streak, nextStreak);

    set({
      todayRewardClaimed: true,
      lastLogin: todayIso,
      streak: nextStreak,
    });

    return { reward, streak: nextStreak } satisfies DailyRewardResult;
  },
}));

export type { DailyRewardResult, DailyRewardType };
export { getInviteClaimKey };
