'use client';

import { create } from 'zustand';
import { getDailyKeyUTC } from './daily';
import { decodeReferralCode } from './referral';

export type Economy = {
  address?: `0x${string}`;
  bubbles: number;
  boosts: number;
  retries: number;
  comboStartBonus: number;
  streak: number;
  lastLoginISO?: string;
  bonusTrials: number;
  shareMarker?: string;
  trialUsedToday: boolean;
  pendingReferral?: string | null;
  connect(addr: string): void;
  disconnect(): void;
  grantBoost(n: number): void;
  grantRetry(n: number): void;
  grantBubbles(n: number): void;
  setComboStartBonus(n: number): void;
  claimDailyReward(): void;
  markTrialToday(): void;
  recordShareToday(): void;
  addInvite(code: string): void;
  setPendingReferral(code: string | null): void;
  consumeBonusTrial(): boolean;
};

type AccountSnapshot = {
  bubbles: number;
  boosts: number;
  retries: number;
  comboStartBonus: number;
  streak: number;
  lastLoginISO?: string;
  shareMarker?: string;
  bonusTrials: number;
};

type PersistedEconomy = {
  accounts: Record<string, AccountSnapshot>;
  firstBoost: Record<string, boolean>;
  inviteRewards: Record<string, number>;
  referralClaims: Record<string, string>;
};

const STORAGE_KEY = 'rubble:economy:v1';
const SHARE_PREFIX = 'rubble:share';

function defaultAccount(): AccountSnapshot {
  return {
    bubbles: 0,
    boosts: 0,
    retries: 0,
    comboStartBonus: 0,
    streak: 0,
    bonusTrials: 0,
  };
}

function readPersisted(): PersistedEconomy {
  if (typeof window === 'undefined') {
    return { accounts: {}, firstBoost: {}, inviteRewards: {}, referralClaims: {} };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { accounts: {}, firstBoost: {}, inviteRewards: {}, referralClaims: {} };
    }
    const parsed = JSON.parse(raw) as PersistedEconomy;
    return {
      accounts: parsed.accounts ?? {},
      firstBoost: parsed.firstBoost ?? {},
      inviteRewards: parsed.inviteRewards ?? {},
      referralClaims: parsed.referralClaims ?? {},
    };
  } catch {
    return { accounts: {}, firstBoost: {}, inviteRewards: {}, referralClaims: {} };
  }
}

function writePersisted(state: PersistedEconomy) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore persistence failures
  }
}

function accountKey(address?: `0x${string}`) {
  return address?.toLowerCase() ?? 'guest';
}

function ensureAccount(data: PersistedEconomy, key: string): AccountSnapshot {
  const existing = data.accounts[key];
  if (existing) {
    return existing;
  }
  const snapshot = defaultAccount();
  data.accounts[key] = snapshot;
  return snapshot;
}

function todayShareKey(addressKey: string) {
  const date = getDailyKeyUTC().replace(/-/g, '');
  return `${SHARE_PREFIX}:${date}:${addressKey}`;
}

function todayTrialKey(addressKey: string) {
  const date = getDailyKeyUTC().replace(/-/g, '');
  return `rubble:trial:${date}:${addressKey}`;
}

function hasTrialMarker(addressKey: string) {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(todayTrialKey(addressKey)) === '1';
  } catch {
    return true;
  }
}

function setTrialMarker(addressKey: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(todayTrialKey(addressKey), '1');
  } catch {
    // ignore
  }
}

function hasShareMarker(addressKey: string) {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(todayShareKey(addressKey)) === '1';
  } catch {
    return false;
  }
}

function setShareMarker(addressKey: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(todayShareKey(addressKey), '1');
  } catch {
    // ignore
  }
}

function daysBetween(aISO: string | undefined, bISO: string) {
  if (!aISO) {
    return Infinity;
  }
  const a = new Date(aISO);
  const b = new Date(bISO);
  return Math.floor((new Date(b.toDateString()).getTime() - new Date(a.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
}

export const useEconomyStore = create<Economy>((set, get) => ({
  address: undefined,
  bubbles: 0,
  boosts: 0,
  retries: 0,
  comboStartBonus: 0,
  streak: 0,
  lastLoginISO: undefined,
  bonusTrials: 0,
  shareMarker: undefined,
  trialUsedToday: false,
  pendingReferral: null,
  connect: (addr) => {
    const normalized = addr.trim().toLowerCase() as `0x${string}`;
    const persisted = readPersisted();
    const key = accountKey(normalized);
    const account = ensureAccount(persisted, key);
    let boosts = account.boosts;
    const retries = account.retries;
    const bubbles = account.bubbles;
    const comboStartBonus = account.comboStartBonus;
    const streak = account.streak;
    const lastLoginISO = account.lastLoginISO;
    let bonusTrials = account.bonusTrials ?? 0;

    if (!persisted.firstBoost[normalized]) {
      boosts += 1;
      persisted.firstBoost[normalized] = true;
    }

    const owedInvites = persisted.inviteRewards[normalized] ?? 0;
    if (owedInvites > 0) {
      boosts += owedInvites;
      persisted.inviteRewards[normalized] = 0;
    }

    const shareSeen = hasShareMarker(key);
    const trialFlag = hasTrialMarker(key);

    const pending = get().pendingReferral;
    if (pending) {
      const inviter = decodeReferralCode(pending);
      if (inviter && inviter.toLowerCase() !== normalized) {
        persisted.referralClaims[normalized] = inviter.toLowerCase();
        persisted.inviteRewards[inviter.toLowerCase()] = (persisted.inviteRewards[inviter.toLowerCase()] ?? 0) + 1;
        if (bonusTrials < 1) {
          bonusTrials += 1;
        }
      }
    }

    account.boosts = boosts;
    account.retries = retries;
    account.bubbles = bubbles;
    account.comboStartBonus = comboStartBonus;
    account.streak = streak;
    account.lastLoginISO = lastLoginISO;
    account.bonusTrials = bonusTrials;

    writePersisted(persisted);

    set({
      address: normalized,
      bubbles,
      boosts,
      retries,
      comboStartBonus,
      streak,
      lastLoginISO,
      bonusTrials,
      shareMarker: shareSeen ? getDailyKeyUTC() : account.shareMarker,
      trialUsedToday: trialFlag,
      pendingReferral: null,
    });
  },
  disconnect: () => {
    set({ address: undefined });
  },
  grantBoost: (n) => {
    if (n <= 0) return;
    const state = get();
    const persisted = readPersisted();
    const key = accountKey(state.address);
    const account = ensureAccount(persisted, key);
    account.boosts = (account.boosts ?? 0) + n;
    writePersisted(persisted);
    set({ boosts: account.boosts });
  },
  grantRetry: (n) => {
    if (n <= 0) return;
    const state = get();
    const persisted = readPersisted();
    const key = accountKey(state.address);
    const account = ensureAccount(persisted, key);
    account.retries = (account.retries ?? 0) + n;
    writePersisted(persisted);
    set({ retries: account.retries });
  },
  grantBubbles: (n) => {
    if (n <= 0) return;
    const state = get();
    const persisted = readPersisted();
    const key = accountKey(state.address);
    const account = ensureAccount(persisted, key);
    account.bubbles = (account.bubbles ?? 0) + n;
    writePersisted(persisted);
    set({ bubbles: account.bubbles });
  },
  setComboStartBonus: (value) => {
    const state = get();
    const persisted = readPersisted();
    const key = accountKey(state.address);
    const account = ensureAccount(persisted, key);
    account.comboStartBonus = value;
    writePersisted(persisted);
    set({ comboStartBonus: value });
  },
  claimDailyReward: () => {
    const state = get();
    const persisted = readPersisted();
    const key = accountKey(state.address);
    const account = ensureAccount(persisted, key);
    const todayIso = new Date().toISOString();
    const distance = daysBetween(account.lastLoginISO, todayIso);
    if (distance === 0) {
      return;
    }
    if (distance === 1) {
      account.streak = (account.streak ?? 0) + 1;
    } else {
      account.streak = 1;
    }
    account.lastLoginISO = todayIso;
    account.boosts = (account.boosts ?? 0) + 1;
    account.bubbles = (account.bubbles ?? 0) + 50;
    writePersisted(persisted);
    set({
      streak: account.streak,
      lastLoginISO: account.lastLoginISO,
      boosts: account.boosts,
      bubbles: account.bubbles,
    });
  },
  markTrialToday: () => {
    const state = get();
    const key = accountKey(state.address);
    setTrialMarker(key);
    set({ trialUsedToday: true });
  },
  recordShareToday: () => {
    const state = get();
    const key = accountKey(state.address);
    if (hasShareMarker(key)) {
      return;
    }
    setShareMarker(key);
    const persisted = readPersisted();
    const account = ensureAccount(persisted, key);
    account.boosts = (account.boosts ?? 0) + 1;
    account.shareMarker = getDailyKeyUTC();
    writePersisted(persisted);
    set({ boosts: account.boosts, shareMarker: account.shareMarker });
  },
  addInvite: (code: string) => {
    const inviter = decodeReferralCode(code);
    if (!inviter) {
      return;
    }
    const state = get();
    const normalized = state.address?.toLowerCase();
    const persisted = readPersisted();
    if (!normalized) {
      set({ pendingReferral: code });
      return;
    }
    if (normalized === inviter.toLowerCase()) {
      set({ pendingReferral: null });
      return;
    }
    if (persisted.referralClaims[normalized]) {
      set({ pendingReferral: null });
      return;
    }
    persisted.referralClaims[normalized] = inviter.toLowerCase();
    persisted.inviteRewards[inviter.toLowerCase()] = (persisted.inviteRewards[inviter.toLowerCase()] ?? 0) + 1;
    const key = accountKey(state.address);
    const account = ensureAccount(persisted, key);
    account.bonusTrials = (account.bonusTrials ?? 0) + 1;
    writePersisted(persisted);
    set({ bonusTrials: account.bonusTrials, pendingReferral: null });
  },
  setPendingReferral: (code) => {
    set({ pendingReferral: code });
  },
  consumeBonusTrial: () => {
    const state = get();
    if (state.bonusTrials <= 0) {
      return false;
    }
    const persisted = readPersisted();
    const key = accountKey(state.address);
    const account = ensureAccount(persisted, key);
    if ((account.bonusTrials ?? 0) <= 0) {
      return false;
    }
    account.bonusTrials -= 1;
    writePersisted(persisted);
    set({ bonusTrials: account.bonusTrials });
    return true;
  },
}));

if (typeof window !== 'undefined') {
  (window as typeof window & { __rubbleEconomyStore?: typeof useEconomyStore }).__rubbleEconomyStore = useEconomyStore;
}
