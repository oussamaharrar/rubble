'use client';

import { create } from 'zustand';
import { getDailyKeyUTC } from '@/lib/daily';

export type Economy = {
  address?: `0x${string}`;
  bubbles: number;
  boosts: number;
  retries: number;
  comboStartBonus: number;
  streak: number;
  lastLoginISO?: string;
  connect(addr: string): void;
  grantBoost(n: number): void;
  grantRetry(n: number): void;
  grantBubbles(n: number): void;
  setComboStartBonus(n: number): void;
  claimDailyReward(): void;
  markTrialToday(): void;
  recordShareToday(): void;
  addInvite(code: string): void;
  pendingInvite?: string | null;
  hasSharedToday: boolean;
  trialAvailable: boolean;
  markInviteRewarded(inviter: `0x${string}`): void;
};

const ECONOMY_KEY = 'rubble:economy:v1';
const CONNECT_BONUS_PREFIX = 'rubble:connect:boost:';
const SHARE_PREFIX = 'rubble:share:';
const TRIAL_PREFIX = 'rubble:trial';
const INVITE_PENDING_KEY = 'rubble:pending-invite';
const INVITE_LEDGER_KEY = 'rubble:invite-ledger';
const INVITE_REDEEMED_PREFIX = 'rubble:invite:redeemed:';

const todayKey = () => getDailyKeyUTC();

function normaliseAddress(addr: string | undefined | null): `0x${string}` | undefined {
  if (!addr) return undefined;
  const trimmed = addr.trim();
  if (/^0x[0-9a-fA-F]{40}$/u.test(trimmed)) {
    return trimmed.toLowerCase() as `0x${string}`;
  }
  return undefined;
}

function readPersistedState() {
  if (typeof window === 'undefined') {
    return {
      bubbles: 0,
      boosts: 0,
      retries: 0,
      comboStartBonus: 0,
      streak: 0,
      lastLoginISO: undefined,
    };
  }
  try {
    const raw = window.localStorage.getItem(ECONOMY_KEY);
    if (!raw) {
      return {
        bubbles: 0,
        boosts: 0,
        retries: 0,
        comboStartBonus: 0,
        streak: 0,
        lastLoginISO: undefined,
      };
    }
    const parsed = JSON.parse(raw) as Partial<Economy>;
    return {
      bubbles: Number.isFinite(parsed?.bubbles) ? Number(parsed?.bubbles) : 0,
      boosts: Number.isFinite(parsed?.boosts) ? Number(parsed?.boosts) : 0,
      retries: Number.isFinite(parsed?.retries) ? Number(parsed?.retries) : 0,
      comboStartBonus: Number.isFinite(parsed?.comboStartBonus)
        ? Number(parsed?.comboStartBonus)
        : 0,
      streak: Number.isFinite(parsed?.streak) ? Number(parsed?.streak) : 0,
      lastLoginISO:
        typeof parsed?.lastLoginISO === 'string' ? parsed?.lastLoginISO : undefined,
    };
  } catch {
    return {
      bubbles: 0,
      boosts: 0,
      retries: 0,
      comboStartBonus: 0,
      streak: 0,
      lastLoginISO: undefined,
    };
  }
}

function persistState(partial: Partial<Economy>) {
  if (typeof window === 'undefined') return;
  try {
    const current = readPersistedState();
    const next = { ...current, ...partial } satisfies Partial<Economy>;
    window.localStorage.setItem(ECONOMY_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence issues
  }
}

function storageSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore persistence issues
  }
}

function storageGet(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageDelete(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore persistence errors
  }
}

function inviteLedgerGet() {
  if (typeof window === 'undefined') return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(INVITE_LEDGER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function inviteLedgerSet(next: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INVITE_LEDGER_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function getTrialKey(address: `0x${string}` | undefined) {
  const dateKey = todayKey();
  const addr = address ?? 'guest';
  return `${TRIAL_PREFIX}:${dateKey}:${addr}`;
}

export const useEconomyStore = create<Economy>((set, get) => {
  const persisted = readPersistedState();
  const pendingInvite = storageGet(INVITE_PENDING_KEY);
  const today = todayKey();
  const hasSharedToday = Boolean(storageGet(`${SHARE_PREFIX}${today}`));
  const trialKey = getTrialKey(undefined);
  const trialAvailable = !storageGet(trialKey);

  return {
    address: undefined,
    bubbles: persisted.bubbles,
    boosts: persisted.boosts,
    retries: persisted.retries,
    comboStartBonus: persisted.comboStartBonus,
    streak: persisted.streak,
    lastLoginISO: persisted.lastLoginISO,
    pendingInvite: pendingInvite,
    hasSharedToday,
    trialAvailable,
    connect: (addr) => {
      const normalised = normaliseAddress(addr);
      if (!normalised) return;
      set((state) => {
        let boosts = state.boosts;
        const connectKey = `${CONNECT_BONUS_PREFIX}${normalised}`;
        if (!storageGet(connectKey)) {
          boosts += 1;
          storageSet(connectKey, '1');
        }
        let pending = state.pendingInvite ?? storageGet(INVITE_PENDING_KEY);
        let retries = state.retries;
        if (pending) {
          const inviter = normaliseAddress(pending);
          const redeemedKey = `${INVITE_REDEEMED_PREFIX}${normalised}`;
          if (inviter && inviter !== normalised && !storageGet(redeemedKey)) {
            const currentLedger = inviteLedgerGet();
            currentLedger[inviter] = (currentLedger[inviter] ?? 0) + 1;
            inviteLedgerSet(currentLedger);
            retries += 1;
            storageSet(redeemedKey, inviter);
            pending = null;
            storageDelete(INVITE_PENDING_KEY);
          }
        }
        const inviteLedger = inviteLedgerGet();
        if (inviteLedger[normalised]) {
          boosts += inviteLedger[normalised];
          delete inviteLedger[normalised];
          inviteLedgerSet(inviteLedger);
        }
        const trialKeyForAddress = getTrialKey(normalised);
        const nextTrialAvailable = !storageGet(trialKeyForAddress);
        persistState({ boosts, retries });
        return {
          ...state,
          address: normalised,
          boosts,
          retries,
          pendingInvite: pending ?? null,
          trialAvailable: nextTrialAvailable,
        };
      });
    },
    grantBoost: (n) => {
      if (n <= 0) return;
      set((state) => {
        const boosts = state.boosts + n;
        persistState({ boosts });
        return { ...state, boosts };
      });
    },
    grantRetry: (n) => {
      if (n <= 0) return;
      set((state) => {
        const retries = state.retries + n;
        persistState({ retries });
        return { ...state, retries };
      });
    },
    grantBubbles: (n) => {
      if (n <= 0) return;
      set((state) => {
        const bubbles = state.bubbles + n;
        persistState({ bubbles });
        return { ...state, bubbles };
      });
    },
    setComboStartBonus: (n) => {
      set((state) => {
        const comboStartBonus = Math.max(0, n);
        persistState({ comboStartBonus });
        return { ...state, comboStartBonus };
      });
    },
    claimDailyReward: () => {
      const now = new Date();
      const todayIso = now.toISOString();
      const todayDate = todayIso.slice(0, 10);
      set((state) => {
        const last = state.lastLoginISO ? state.lastLoginISO.slice(0, 10) : null;
        if (last === todayDate) {
          return state;
        }
        let streak = 1;
        if (last) {
          const lastDate = new Date(state.lastLoginISO!);
          const diff = Math.floor(
            (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diff === 1) {
            streak = state.streak + 1;
          }
        }
        const bubbles = state.bubbles + 25 + streak * 5;
        const boosts = state.boosts + 1;
        persistState({ streak, lastLoginISO: todayIso, bubbles, boosts });
        return {
          ...state,
          streak,
          lastLoginISO: todayIso,
          bubbles,
          boosts,
        };
      });
    },
    markTrialToday: () => {
      const state = get();
      const key = getTrialKey(state.address);
      storageSet(key, '1');
      set(() => ({ trialAvailable: false }));
    },
    recordShareToday: () => {
      const key = `${SHARE_PREFIX}${todayKey()}`;
      if (storageGet(key)) {
        return;
      }
      storageSet(key, '1');
      set((state) => {
        const boosts = state.boosts + 1;
        persistState({ boosts });
        return { ...state, boosts, hasSharedToday: true };
      });
    },
    addInvite: (code: string) => {
      if (typeof window === 'undefined') return;
      const trimmed = code.trim();
      if (!trimmed) return;
      storageSet(INVITE_PENDING_KEY, trimmed);
      set((state) => ({ ...state, pendingInvite: trimmed }));
    },
    markInviteRewarded: (inviter) => {
      const ledger = inviteLedgerGet();
      if (!ledger[inviter]) {
        return;
      }
      const boosts = ledger[inviter];
      delete ledger[inviter];
      inviteLedgerSet(ledger);
      set((state) => {
        const nextBoosts = state.boosts + boosts;
        persistState({ boosts: nextBoosts });
        return { ...state, boosts: nextBoosts };
      });
    },
  } satisfies Economy;
});

export function getInviteRewards(address: `0x${string}` | undefined) {
  if (!address) return 0;
  const ledger = inviteLedgerGet();
  return ledger[address] ?? 0;
}

export function clearInviteRewards(address: `0x${string}` | undefined) {
  if (!address) return;
  const ledger = inviteLedgerGet();
  if (!ledger[address]) return;
  delete ledger[address];
  inviteLedgerSet(ledger);
}
