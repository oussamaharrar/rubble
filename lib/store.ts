'use client';

import { create } from 'zustand';
import type { Bubble, BoosterBank, GamePhase, Mission, RunStats } from '@/types/game';
import { claimMission, generateDailyMissions, progressCombo, progressColor, progressSurvival } from '@/lib/missions';

const BASE_TIME = 60;
const REGULAR_TIME_REWARD = 0.5;
const WRONG_TIME_PENALTY = 3;
const STORM_INTERVAL = 30_000;
const STORM_DURATION = 7_000;
const MAX_REGULAR_BUBBLES = 40;
const MAX_STORM_BUBBLES = 10;
const COMBO_WINDOW = 5_000;

const STORAGE_KEY = 'rubble-rush-state-v1';
const DAILY_SEED = 'rubble-rush';

interface PersistedState {
  missions: Mission[];
  boosterBank: BoosterBank;
  checksum: string;
}

interface GameStore {
  phase: GamePhase;
  stats: RunStats;
  bubbles: Bubble[];
  missions: Mission[];
  boosterBank: BoosterBank;
  stormAt: number;
  stormActiveUntil: number | null;
  now: number;
  runStartedAt: number | null;
  comboWindowUntil: number;
  slowTimeUntil: number;
  survivalCarry: number;
  startRun: () => void;
  endRun: () => void;
  tick: (now: number) => void;
  spawnBubble: (bubble: Bubble) => boolean;
  spawnStormOrbs: (now: number, factory: (options: { drain: boolean }) => Bubble | null) => Bubble[];
  removeBubble: (id: string) => void;
  clearBubbles: () => void;
  tapBubble: (bubble: Bubble | null, opts: { now: number; miss?: boolean }) => {
    kind: 'miss' | 'regular' | 'energy' | 'drain' | 'poison';
    multiplier: number;
  };
  grantBooster: (amount: number) => void;
  consumeBooster: () => boolean;
  updateMissionProgress: (missions: Mission[]) => void;
  claimMission: (id: string) => void;
  refreshDailyMissions: () => void;
  setPhase: (phase: GamePhase) => void;
}

const initialStats: RunStats = {
  score: 0,
  bestCombo: 0,
  streak: 0,
  timeLeft: BASE_TIME,
  lastColor: undefined,
  chainLen: 0,
};

function checksum(state: PersistedState) {
  const json = JSON.stringify({ missions: state.missions, boosterBank: state.boosterBank });
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function readPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.missions) || typeof parsed.boosterBank !== 'object') return null;
    const digest = checksum({ missions: parsed.missions, boosterBank: parsed.boosterBank, checksum: '' });
    if (digest !== parsed.checksum) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(missions: Mission[], boosterBank: BoosterBank) {
  if (typeof window === 'undefined') return;
  const payload: PersistedState = {
    missions,
    boosterBank,
    checksum: '',
  };
  payload.checksum = checksum(payload);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function getDailyKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function computeMultiplier(chainLen: number) {
  if (chainLen < 3) return 1;
  return clamp(1 + 0.25 * (chainLen - 2), 1, 4);
}

function resolveInitialData(): { missions: Mission[]; boosterBank: BoosterBank } {
  if (typeof window === 'undefined') {
    const key = getDailyKey();
    return {
      missions: generateDailyMissions(DAILY_SEED, key),
      boosterBank: { freeOrbs: 0, lastDailyKey: key },
    };
  }
  const persisted = readPersisted();
  const key = getDailyKey();
  if (persisted) {
    if (persisted.boosterBank.lastDailyKey !== key) {
      const bank: BoosterBank = { freeOrbs: persisted.boosterBank.freeOrbs, lastDailyKey: key };
      const missions = generateDailyMissions(DAILY_SEED, key);
      writePersisted(missions, bank);
      return { missions, boosterBank: bank };
    }
    return { missions: persisted.missions, boosterBank: persisted.boosterBank };
  }
  const missions = generateDailyMissions(DAILY_SEED, key);
  const bank: BoosterBank = { freeOrbs: 0, lastDailyKey: key };
  writePersisted(missions, bank);
  return { missions, boosterBank: bank };
}

export const useGameStore = create<GameStore>((set, get) => {
  const { missions: initialMissions, boosterBank: initialBank } = resolveInitialData();
  return {
    phase: 'start',
    stats: { ...initialStats },
    bubbles: [],
    missions: initialMissions,
    boosterBank: initialBank,
    stormAt: STORM_INTERVAL,
    stormActiveUntil: null,
    now: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    runStartedAt: null,
    comboWindowUntil: 0,
    slowTimeUntil: 0,
    survivalCarry: 0,
    startRun: () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      set({
        phase: 'playing',
        stats: { ...initialStats, timeLeft: BASE_TIME },
        bubbles: [],
        stormAt: STORM_INTERVAL,
        stormActiveUntil: null,
        runStartedAt: now,
        now,
        comboWindowUntil: 0,
        slowTimeUntil: 0,
        survivalCarry: 0,
      });
    },
    endRun: () => {
      const state = get();
      if (state.phase === 'summary') return;
      set({ phase: 'summary', bubbles: [], slowTimeUntil: 0, comboWindowUntil: 0 });
    },
    tick: (now) => {
      const state = get();
      if (state.phase !== 'playing' && state.phase !== 'storm') {
        set({ now });
        return;
      }
      const dt = Math.max(0, now - state.now);
      const seconds = dt / 1000;
      let timeLeft = state.stats.timeLeft - seconds;
      const totalSurvival = state.survivalCarry + seconds;
      let missions = state.missions;
      let survivalCarry = totalSurvival;
      let shouldPersist = false;
      if (totalSurvival >= 1) {
        const wholeSeconds = Math.floor(totalSurvival);
        survivalCarry = totalSurvival - wholeSeconds;
        missions = progressSurvival(state.missions, wholeSeconds);
        shouldPersist = true;
      }
      let phase: GamePhase = state.phase;
      let stormAt = state.stormAt;
      let stormActiveUntil = state.stormActiveUntil;
      if (state.phase === 'playing' && state.runStartedAt !== null) {
        const elapsed = now - state.runStartedAt;
        if (elapsed >= state.stormAt) {
          phase = 'storm';
          stormActiveUntil = now + STORM_DURATION;
          stormAt = elapsed + STORM_INTERVAL;
        }
      } else if (state.phase === 'storm' && state.stormActiveUntil && now >= state.stormActiveUntil) {
        phase = 'playing';
        stormActiveUntil = null;
      }
      if (timeLeft <= 0) {
        timeLeft = 0;
        set({
          stats: { ...state.stats, timeLeft },
          missions,
          survivalCarry,
          now,
          stormAt,
          stormActiveUntil,
          phase,
        });
        if (shouldPersist && typeof window !== 'undefined') {
          writePersisted(missions, get().boosterBank);
        }
        get().endRun();
        return;
      }
      set({
        stats: { ...state.stats, timeLeft },
        missions,
        survivalCarry,
        now,
        stormAt,
        stormActiveUntil,
        phase,
      });
      if (shouldPersist && typeof window !== 'undefined') {
        writePersisted(missions, get().boosterBank);
      }
    },
    spawnBubble: (bubble) => {
      const state = get();
      const limit = bubble.storm ? MAX_STORM_BUBBLES : MAX_REGULAR_BUBBLES;
      const existing = state.bubbles.filter((item) => Boolean(item.storm) === Boolean(bubble.storm));
      if (existing.length >= limit) {
        return false;
      }
      set({ bubbles: [...state.bubbles, bubble] });
      return true;
    },
    spawnStormOrbs: (now, factory) => {
      const created: Bubble[] = [];
      for (let i = 0; i < 3; i += 1) {
        const energy = factory({ drain: false });
        if (energy) {
          const bubble = { ...energy, createdAt: now, storm: true, poison: false } satisfies Bubble;
          if (get().spawnBubble(bubble)) {
            created.push(bubble);
          }
        }
      }
      for (let i = 0; i < 2; i += 1) {
        const drain = factory({ drain: true });
        if (drain) {
          const bubble = { ...drain, createdAt: now, storm: true, poison: true } satisfies Bubble;
          if (get().spawnBubble(bubble)) {
            created.push(bubble);
          }
        }
      }
      return created;
    },
    removeBubble: (id) => {
      set({ bubbles: get().bubbles.filter((bubble) => bubble.id !== id) });
    },
    clearBubbles: () => {
      set({ bubbles: [] });
    },
    tapBubble: (bubble, { now, miss }) => {
      const state = get();
      const stats = state.stats;
      if (!bubble || miss || bubble.poison) {
        const timeLeft = clamp(stats.timeLeft - WRONG_TIME_PENALTY, 0, BASE_TIME * 4);
        set({
          stats: {
            ...stats,
            timeLeft,
            chainLen: 0,
            lastColor: undefined,
            streak: 0,
          },
        });
        return { kind: bubble?.poison ? 'poison' : 'miss', multiplier: 1 };
      }
      const sameColor = stats.lastColor === bubble.color;
      const withinWindow = sameColor && now <= state.comboWindowUntil;
      const chainLen = withinWindow ? stats.chainLen + 1 : 1;
      const multiplier = computeMultiplier(chainLen);
      const basePoints = bubble.storm ? (bubble.poison ? -15 : 20) : 10;
      const timeDelta = bubble.storm ? (bubble.poison ? -2 : REGULAR_TIME_REWARD) : REGULAR_TIME_REWARD;
      const score = stats.score + Math.round(basePoints * multiplier);
      const timeLeft = clamp(stats.timeLeft + timeDelta, 0, BASE_TIME * 4);
      const bestCombo = Math.max(stats.bestCombo, chainLen);
      const streak = bubble.poison ? 0 : stats.streak + 1;
      const nextStats: RunStats = {
        ...stats,
        score,
        timeLeft,
        bestCombo,
        streak,
        lastColor: bubble.color,
        chainLen,
      };
      const updatedMissions = progressCombo(progressColor(state.missions, bubble.color), chainLen);
      set({
        stats: nextStats,
        missions: updatedMissions,
        comboWindowUntil: now + COMBO_WINDOW,
      });
      if (typeof window !== 'undefined') {
        writePersisted(updatedMissions, get().boosterBank);
      }
      if (bubble.storm && !bubble.poison) {
        get().grantBooster(1);
      }
      return { kind: bubble.storm ? (bubble.poison ? 'drain' : 'energy') : 'regular', multiplier };
    },
    grantBooster: (amount) => {
      if (amount <= 0) return;
      const bank = get().boosterBank;
      const nextBank: BoosterBank = { ...bank, freeOrbs: bank.freeOrbs + amount };
      set({ boosterBank: nextBank });
      if (typeof window !== 'undefined') {
        writePersisted(get().missions, nextBank);
      }
    },
    consumeBooster: () => {
      const bank = get().boosterBank;
      if (bank.freeOrbs <= 0) return false;
      const nextBank: BoosterBank = { ...bank, freeOrbs: bank.freeOrbs - 1 };
      const expires = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 5_000;
      set({ boosterBank: nextBank, slowTimeUntil: expires });
      if (typeof window !== 'undefined') {
        writePersisted(get().missions, nextBank);
      }
      return true;
    },
    updateMissionProgress: (missions) => {
      set({ missions });
      if (typeof window !== 'undefined') {
        writePersisted(missions, get().boosterBank);
      }
    },
    claimMission: (id) => {
      const missions = claimMission(get().missions, id);
      const target = missions.find((mission) => mission.id === id);
      if (target && target.completed && target.claimed) {
        get().grantBooster(target.rewardOrbs);
      }
      const allClaimed = missions.every((mission) => mission.completed && mission.claimed);
      if (allClaimed) {
        get().grantBooster(1);
      }
      set({ missions });
      if (typeof window !== 'undefined') {
        writePersisted(missions, get().boosterBank);
      }
    },
    refreshDailyMissions: () => {
      const key = getDailyKey();
      const missions = generateDailyMissions(DAILY_SEED, key);
      const bank = get().boosterBank;
      const nextBank: BoosterBank = { ...bank, lastDailyKey: key };
      set({ missions, boosterBank: nextBank });
      if (typeof window !== 'undefined') {
        writePersisted(missions, nextBank);
      }
    },
    setPhase: (phase) => set({ phase }),
  };
});

export function useMissions() {
  return useGameStore((state) => state.missions);
}

export function useBoosterBank() {
  return useGameStore((state) => state.boosterBank);
}
