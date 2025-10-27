'use client';

import { create } from 'zustand';

export type Economy = {
  address?: `0x${string}`;
  bubbles: number;
  boosts: number;
  retries: number;
  comboStartBonus: number;
  streak: number;
  lastLoginISO?: string;
  referralCode?: string;
  lastShareDate?: string;
  trialMarkedOn?: string;
  pendingInvite?: string | null;
  connect(addr: string): void;
  grantBoost(n: number): void;
  grantRetry(n: number): void;
  grantBubbles(n: number): void;
  setComboStartBonus(n: number): void;
  claimDailyReward(): void;
  markTrialToday(): void;
  recordShareToday(): void;
  addInvite(code: string): void;
};

type EconomyState = Omit<Economy, 'connect' | 'grantBoost' | 'grantRetry' | 'grantBubbles' | 'setComboStartBonus' | 'claimDailyReward' | 'markTrialToday' | 'recordShareToday' | 'addInvite'> & {
  pendingInvite?: string | null;
  lastShareDate?: string;
  trialMarkedOn?: string;
};

const ECONOMY_KEY = 'rubble:economy:v1';
const CONNECT_KEY_PREFIX = 'rubble:connect:';
const TRIAL_KEY_PREFIX = 'rubble:trial:';
const SHARE_KEY_PREFIX = 'rubble:share:';
const REFERRAL_MAP_KEY = 'rubble:referral:map';
const REFERRAL_REWARD_KEY = 'rubble:referral:rewards';
const INVITE_CLAIM_PREFIX = 'rubble:invite:';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readEconomy(): EconomyState {
  if (typeof window === 'undefined') {
    return {
      bubbles: 0,
      boosts: 0,
      retries: 0,
      comboStartBonus: 0,
      streak: 0,
      pendingInvite: null,
    };
  }
  const stored = safeParse<Partial<EconomyState>>(
    window.localStorage.getItem(ECONOMY_KEY),
    {}
  );
  return {
    bubbles: stored?.bubbles ?? 0,
    boosts: stored?.boosts ?? 0,
    retries: stored?.retries ?? 0,
    comboStartBonus: stored?.comboStartBonus ?? 0,
    streak: stored?.streak ?? 0,
    lastLoginISO: stored?.lastLoginISO,
    referralCode: stored?.referralCode,
    pendingInvite: null,
    lastShareDate: stored?.lastShareDate,
    trialMarkedOn: stored?.trialMarkedOn,
  };
}

function persistEconomy(state: EconomyState) {
  if (typeof window === 'undefined') return;
  const payload: EconomyState = {
    bubbles: state.bubbles,
    boosts: state.boosts,
    retries: state.retries,
    comboStartBonus: state.comboStartBonus,
    streak: state.streak,
    lastLoginISO: state.lastLoginISO,
    referralCode: state.referralCode,
    lastShareDate: state.lastShareDate,
    trialMarkedOn: state.trialMarkedOn,
    pendingInvite: null,
  };
  try {
    window.localStorage.setItem(ECONOMY_KEY, JSON.stringify(payload));
  } catch {
    // ignore persistence failures
  }
}

function normaliseAddress(address: string): `0x${string}` | undefined {
  if (typeof address !== 'string') return undefined;
  const trimmed = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/u.test(trimmed)) return undefined;
  return trimmed.toLowerCase() as `0x${string}`;
}

function todayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function trialStorageKey(address: `0x${string}`) {
  return `${TRIAL_KEY_PREFIX}${todayKey()}:${address}`;
}

function hasTrialMarked(address: `0x${string}`) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(trialStorageKey(address)) === '1';
  } catch {
    return true;
  }
}

function markTrial(address: `0x${string}`) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(trialStorageKey(address), '1');
  } catch {
    // ignore
  }
}

function shareStorageKey(address?: `0x${string}`) {
  const base = todayKey();
  return `${SHARE_KEY_PREFIX}${base}:${address ?? 'guest'}`;
}

function hasSharedToday(address?: `0x${string}`) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(shareStorageKey(address)) === '1';
  } catch {
    return true;
  }
}

function markShare(address?: `0x${string}`) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(shareStorageKey(address), '1');
  } catch {
    // ignore
  }
}

function readReferralMap(): Record<string, `0x${string}`> {
  if (typeof window === 'undefined') return {};
  return safeParse<Record<string, `0x${string}`>>(
    window.localStorage.getItem(REFERRAL_MAP_KEY),
    {}
  );
}

function writeReferralMap(map: Record<string, `0x${string}`>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REFERRAL_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function readReferralRewards(): Record<`0x${string}`, number> {
  if (typeof window === 'undefined') return {};
  return safeParse<Record<`0x${string}`, number>>(
    window.localStorage.getItem(REFERRAL_REWARD_KEY),
    {}
  );
}

function writeReferralRewards(map: Record<`0x${string}`, number>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REFERRAL_REWARD_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function referralCodeFor(address: `0x${string}`): string {
  const body = address.slice(2);
  const numeric = BigInt(`0x${body}`);
  return numeric.toString(36).slice(-8).toUpperCase();
}

function ensureReferralMapping(address: `0x${string}`): string {
  const code = referralCodeFor(address);
  if (typeof window === 'undefined') {
    return code;
  }
  const map = readReferralMap();
  if (map[code] !== address) {
    map[code] = address;
    writeReferralMap(map);
  }
  return code;
}

function connectKey(address: `0x${string}`) {
  return `${CONNECT_KEY_PREFIX}${address}`;
}

function hasConnectedBefore(address: `0x${string}`) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(connectKey(address)) === '1';
  } catch {
    return true;
  }
}

function markConnected(address: `0x${string}`) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(connectKey(address), '1');
  } catch {
    // ignore
  }
}

function inviteClaimKey(code: string, address: `0x${string}`) {
  return `${INVITE_CLAIM_PREFIX}${code}:${address}`;
}

function hasClaimedInvite(code: string, address: `0x${string}`) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(inviteClaimKey(code, address)) === '1';
  } catch {
    return true;
  }
}

function markInviteClaimed(code: string, address: `0x${string}`) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(inviteClaimKey(code, address), '1');
  } catch {
    // ignore
  }
}

function applyReferralReward(
  address: `0x${string}`,
  state: EconomyState
): EconomyState {
  const rewards = readReferralRewards();
  const pending = rewards[address] ?? 0;
  if (pending <= 0) {
    return state;
  }
  delete rewards[address];
  writeReferralRewards(rewards);
  const next: EconomyState = {
    ...state,
    boosts: state.boosts + pending,
  };
  persistEconomy(next);
  return next;
}

function processInvite(
  address: `0x${string}`,
  code: string,
  state: EconomyState
): EconomyState {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return state;
  }
  if (hasClaimedInvite(trimmed, address)) {
    return { ...state, pendingInvite: null };
  }
  const map = readReferralMap();
  const inviter = map[trimmed];
  if (!inviter || inviter === address) {
    return { ...state, pendingInvite: null };
  }
  const rewards = readReferralRewards();
  rewards[inviter] = (rewards[inviter] ?? 0) + 1;
  writeReferralRewards(rewards);
  markInviteClaimed(trimmed, address);
  const next: EconomyState = {
    ...state,
    retries: state.retries + 1,
    pendingInvite: null,
  };
  persistEconomy(next);
  return next;
}

export const useEconomyStore = create<Economy>((set, get) => ({
  ...readEconomy(),
  connect: (addr: string) => {
    const normalised = normaliseAddress(addr);
    if (!normalised) {
      return;
    }
    set((state) => {
      let next: EconomyState = {
        ...state,
        address: normalised,
      };
      next.referralCode = ensureReferralMapping(normalised);
      if (!hasConnectedBefore(normalised)) {
        markConnected(normalised);
        next.boosts += 1;
      }
      next.trialMarkedOn = hasTrialMarked(normalised) ? todayKey() : undefined;
      next = applyReferralReward(normalised, next);
      if (state.pendingInvite) {
        next = processInvite(normalised, state.pendingInvite, next);
      }
      persistEconomy(next);
      return next;
    });
  },
  grantBoost: (count: number) => {
    if (!Number.isFinite(count) || count === 0) return;
    set((state) => {
      const next: EconomyState = {
        ...state,
        boosts: Math.max(0, state.boosts + Math.trunc(count)),
      };
      persistEconomy(next);
      return next;
    });
  },
  grantRetry: (count: number) => {
    if (!Number.isFinite(count) || count === 0) return;
    set((state) => {
      const next: EconomyState = {
        ...state,
        retries: Math.max(0, state.retries + Math.trunc(count)),
      };
      persistEconomy(next);
      return next;
    });
  },
  grantBubbles: (count: number) => {
    if (!Number.isFinite(count) || count === 0) return;
    set((state) => {
      const next: EconomyState = {
        ...state,
        bubbles: Math.max(0, state.bubbles + Math.trunc(count)),
      };
      persistEconomy(next);
      return next;
    });
  },
  setComboStartBonus: (bonus: number) => {
    set((state) => {
      const next: EconomyState = {
        ...state,
        comboStartBonus: Math.max(0, Math.trunc(bonus)),
      };
      persistEconomy(next);
      return next;
    });
  },
  claimDailyReward: () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    set((state) => {
      if (state.lastLoginISO?.slice(0, 10) === today) {
        return state;
      }
      const previousDay = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
      const nextStreak = state.lastLoginISO?.slice(0, 10) === previousDay ? state.streak + 1 : 1;
      const next: EconomyState = {
        ...state,
        streak: nextStreak,
        lastLoginISO: now.toISOString(),
        boosts: state.boosts + 1,
        bubbles: state.bubbles + 20,
      };
      persistEconomy(next);
      return next;
    });
  },
  markTrialToday: () => {
    const address = get().address;
    if (!address) return;
    if (!hasTrialMarked(address)) {
      markTrial(address);
    }
    set((state) => {
      const next: EconomyState = { ...state, trialMarkedOn: todayKey() };
      persistEconomy(next);
      return next;
    });
  },
  recordShareToday: () => {
    const address = get().address;
    if (hasSharedToday(address)) {
      return;
    }
    markShare(address);
    set((state) => {
      const next: EconomyState = {
        ...state,
        boosts: state.boosts + 1,
        lastShareDate: todayKey(),
      };
      persistEconomy(next);
      return next;
    });
  },
  addInvite: (code: string) => {
    const address = get().address;
    if (address) {
      set((state) => processInvite(address, code, state));
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    set((state) => ({ ...state, pendingInvite: trimmed }));
  },
}));
