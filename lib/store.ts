'use client';

import { create } from 'zustand';
import { persistMissions, readPersistedMissions, generateDailyMissions, bonusStorageKey } from '@/lib/missions';
import type { Bubble, BoosterBank, BubbleColor, GamePhase, Mission, RunStats } from '@/types/game';

const MAX_BUBBLES = 40;
const MAX_STORM_ORBS = 10;
const STORM_INTERVAL_MS = 30_000;
const STORM_DURATION_MS = 7_000;
const COMBO_WINDOW_MS = 5_000;
const BASE_POINTS = 10;
const BASE_TIME_REWARD = 0.5;
const WRONG_TAP_PENALTY = 3;
const DRAIN_PENALTY_TIME = 2;
const DRAIN_PENALTY_SCORE = 15;
const ENERGY_POINTS = 20;
const SLOW_TIME_DURATION_MS = 5_000;

const BOOSTER_KEY = 'rubble:booster-bank';

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
}

function createRng(seed: number) {
  return () => {
    let value = seed + 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultStats(): RunStats {
  return {
    score: 0,
    bestCombo: 0,
    streak: 0,
    timeLeft: 60,
    lastColor: undefined,
    chainLen: 0,
    energyCollected: 0,
  };
}

function initialBoosterBank(): BoosterBank {
  if (typeof window === 'undefined') {
    return { freeOrbs: 0, lastDailyKey: '' };
  }
  try {
    const raw = window.localStorage.getItem(BOOSTER_KEY);
    if (!raw) {
      return { freeOrbs: 0, lastDailyKey: '' };
    }
    const parsed = JSON.parse(raw) as BoosterBank & { checksum?: string };
    if (!parsed || typeof parsed.freeOrbs !== 'number' || typeof parsed.lastDailyKey !== 'string') {
      return { freeOrbs: 0, lastDailyKey: '' };
    }
    if (parsed.checksum && parsed.checksum !== boosterChecksum(parsed)) {
      return { freeOrbs: 0, lastDailyKey: '' };
    }
    return { freeOrbs: parsed.freeOrbs, lastDailyKey: parsed.lastDailyKey };
  } catch (error) {
    console.warn('[Rubble] Failed to parse booster bank', error);
    return { freeOrbs: 0, lastDailyKey: '' };
  }
}

function boosterChecksum(bank: BoosterBank) {
  return hashString(`${bank.freeOrbs}:${bank.lastDailyKey}`).toString(16);
}

function persistBooster(bank: BoosterBank) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    BOOSTER_KEY,
    JSON.stringify({ ...bank, checksum: boosterChecksum(bank) })
  );
}

function randomColor(rng: () => number): BubbleColor {
  const palette: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];
  return palette[Math.floor(rng() * palette.length) % palette.length];
}

function createBubble(
  rng: () => number,
  width: number,
  height: number,
  now: number,
  options?: { storm?: boolean; poison?: boolean; energy?: boolean }
): Bubble {
  const radius = 24 + rng() * 18;
  const x = radius + rng() * (Math.max(width - radius * 2, radius));
  const y = height + radius + rng() * height * 0.4;
  const speedY = -((0.08 + rng() * 0.12) * height);
  const speedX = (rng() - 0.5) * 0.12 * width;
  const color = options?.storm
    ? options?.energy
      ? 'blue'
      : 'orange'
    : randomColor(rng);
  return {
    id: `${now}-${Math.floor(rng() * 1_000_000)}`,
    x,
    y,
    r: options?.storm ? radius * 0.85 : radius,
    color,
    vx: speedX,
    vy: options?.storm ? speedY * 1.35 : speedY,
    storm: options?.storm ?? false,
    poison: options?.poison ?? false,
    createdAt: now,
  };
}

function isEnergyOrb(bubble: Bubble) {
  return bubble.storm && !bubble.poison;
}

function isDrainOrb(bubble: Bubble) {
  return bubble.storm && bubble.poison;
}

type GameStore = {
  phase: GamePhase;
  stats: RunStats;
  bubbles: Bubble[];
  missions: Mission[];
  boosterBank: BoosterBank;
  stormAt: number;
  now: number;
  rngSeed: number;
  rng: () => number;
  width: number;
  height: number;
  comboWindowUntil: number;
  slowTimeUntil: number;
  startedAt: number;
  dailyKey: string;
  survivalAccumulator: number;
  currentStreak: number;
  resumePhase: Exclude<GamePhase, 'start' | 'paused' | 'summary'> | null;
  pauseReason: string | null;
  startRun: () => void;
  endRun: () => void;
  resetToStart: () => void;
  pauseRun: (reason?: string) => void;
  resumeRun: () => void;
  tick: (dt: number) => void;
  spawnBubbles: (count?: number) => void;
  spawnStormOrbs: () => void;
  tap: (x: number, y: number) => { hit: boolean; energy?: boolean; drain?: boolean; combo?: number };
  grantBooster: (count: number) => void;
  consumeBooster: () => boolean;
  loadDaily: (seed?: string | number) => void;
  setStageSize: (width: number, height: number) => void;
  claimMission: (id: string) => void;
  progressColor: (color: BubbleColor) => void;
  progressCombo: (combo: number) => void;
  progressSurvival: (seconds: number) => void;
  activateSlowTime: (durationMs: number) => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'start',
  stats: defaultStats(),
  bubbles: [],
  missions: [],
  boosterBank: initialBoosterBank(),
  stormAt: STORM_INTERVAL_MS,
  now: 0,
  rngSeed: hashString(`${Date.now()}`),
  rng: createRng(hashString(`${Date.now()}`)),
  width: 420,
  height: 680,
  comboWindowUntil: 0,
  slowTimeUntil: 0,
  startedAt: 0,
  dailyKey: '',
  survivalAccumulator: 0,
  currentStreak: 0,
  resumePhase: null,
  pauseReason: null,
  startRun: () => {
    const seed = hashString(`${Date.now()}-${Math.random()}`);
    set({
      phase: 'playing',
      stats: { ...defaultStats(), timeLeft: 60 },
      bubbles: [],
      stormAt: STORM_INTERVAL_MS,
      now: 0,
      rngSeed: seed,
      rng: createRng(seed),
      comboWindowUntil: 0,
      slowTimeUntil: 0,
      startedAt: performance.now(),
      survivalAccumulator: 0,
      currentStreak: 0,
      resumePhase: null,
      pauseReason: null,
    });
    get().spawnBubbles(MAX_BUBBLES / 2);
  },
  endRun: () => {
    set({ phase: 'summary', resumePhase: null, pauseReason: null });
  },
  resetToStart: () => {
    set({
      phase: 'start',
      stats: defaultStats(),
      bubbles: [],
      now: 0,
      comboWindowUntil: 0,
      slowTimeUntil: 0,
      survivalAccumulator: 0,
      currentStreak: 0,
      resumePhase: null,
      pauseReason: null,
    });
  },
  pauseRun: (reason) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'storm') {
      return;
    }
    set({ phase: 'paused', resumePhase: state.phase, pauseReason: reason ?? null });
  },
  resumeRun: () => {
    const state = get();
    if (state.phase !== 'paused') {
      return;
    }
    set({ phase: state.resumePhase ?? 'playing', resumePhase: null, pauseReason: null });
  },
  tick: (dt) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'storm') {
      return;
    }
    const now = state.now + dt;
    let phase: GamePhase = state.phase;
    const slowTimeActive = now < state.slowTimeUntil;
    const factor = slowTimeActive ? 0.5 : 1;
    const width = state.width;

    const updatedBubbles: Bubble[] = [];
    for (const bubble of state.bubbles) {
      const nextX = bubble.x + bubble.vx * (dt / 1000) * factor;
      const nextY = bubble.y + bubble.vy * (dt / 1000) * factor;
      if (nextY < -bubble.r * 1.2) {
        continue;
      }
      let clampedX = nextX;
      if (clampedX < bubble.r) clampedX = bubble.r;
      if (clampedX > width - bubble.r) clampedX = width - bubble.r;
      updatedBubbles.push({ ...bubble, x: clampedX, y: nextY });
    }

    const stats = { ...state.stats };
    if (stats.timeLeft > 0) {
      stats.timeLeft = Math.max(0, stats.timeLeft - dt / 1000);
    }

    const runSeconds = (now - state.now) / 1000;
    if (runSeconds > 0) {
      get().progressSurvival(runSeconds);
    }

    if (stats.timeLeft <= 0) {
      phase = 'summary';
    }

    if (phase === 'playing' && now >= state.stormAt) {
      phase = 'storm';
      setTimeout(() => {
        get().spawnStormOrbs();
      }, 0);
    }

    if (phase === 'storm' && now >= state.stormAt + STORM_DURATION_MS) {
      phase = 'playing';
      set({ stormAt: now + STORM_INTERVAL_MS });
    }

    const nextState: Partial<GameStore> = {
      bubbles: updatedBubbles,
      stats,
      now,
      phase,
    };
    if (phase === 'summary') {
      nextState.resumePhase = null;
      nextState.pauseReason = null;
    }
    set(nextState);

    const desiredCount = phase === 'storm' ? MAX_BUBBLES + MAX_STORM_ORBS : MAX_BUBBLES;
    if (updatedBubbles.length < desiredCount) {
      get().spawnBubbles(desiredCount - updatedBubbles.length);
    }
  },
  spawnBubbles: (count = 1) => {
    const state = get();
    if (state.phase === 'summary') return;
    const { rng, width, height, now } = state;
    const next: Bubble[] = [];
    for (let index = 0; index < count; index += 1) {
      next.push(createBubble(rng, width, height, now));
    }
    set({ bubbles: [...state.bubbles, ...next].slice(0, MAX_BUBBLES + MAX_STORM_ORBS) });
  },
  spawnStormOrbs: () => {
    const state = get();
    if (state.phase !== 'storm') return;
    const { rng, width, height, now } = state;
    const payload: Bubble[] = [];
    const energyCount = 3 + Math.floor(rng() * 3);
    const drainCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < energyCount; i += 1) {
      payload.push(createBubble(rng, width, height, now, { storm: true, energy: true }));
    }
    for (let i = 0; i < drainCount; i += 1) {
      payload.push(createBubble(rng, width, height, now, { storm: true, poison: true }));
    }
    set({ bubbles: [...state.bubbles, ...payload].slice(0, MAX_BUBBLES + MAX_STORM_ORBS) });
  },
  tap: (x, y) => {
    const state = get();
    let hitIndex = -1;
    for (let index = state.bubbles.length - 1; index >= 0; index -= 1) {
      const bubble = state.bubbles[index];
      const dx = x - bubble.x;
      const dy = y - bubble.y;
      if (dx * dx + dy * dy <= bubble.r * bubble.r) {
        hitIndex = index;
        break;
      }
    }

    if (hitIndex === -1) {
      const bestStreak = Math.max(state.stats.streak, state.currentStreak);
      const stats = { ...state.stats, chainLen: 0, lastColor: undefined, streak: bestStreak };
      stats.timeLeft = Math.max(0, stats.timeLeft - WRONG_TAP_PENALTY);
      set({ stats, comboWindowUntil: 0, currentStreak: 0 });
      return { hit: false };
    }

    const target = state.bubbles[hitIndex];
    const remaining = [...state.bubbles.slice(0, hitIndex), ...state.bubbles.slice(hitIndex + 1)];
    const stats = { ...state.stats };
    let comboWindowUntil = state.comboWindowUntil;
    let energy = false;
    let drain = false;
    let currentStreak = state.currentStreak;

    if (isDrainOrb(target)) {
      stats.timeLeft = Math.max(0, stats.timeLeft - DRAIN_PENALTY_TIME);
      stats.score = Math.max(0, stats.score - DRAIN_PENALTY_SCORE);
      stats.chainLen = 0;
      stats.lastColor = undefined;
      stats.streak = Math.max(stats.streak, state.currentStreak);
      currentStreak = 0;
      comboWindowUntil = 0;
      drain = true;
    } else {
      currentStreak = state.currentStreak + 1;
      stats.streak = Math.max(stats.streak, currentStreak);
      const sameColor = stats.lastColor === target.color && state.now <= state.comboWindowUntil;
      const chainLen = sameColor ? stats.chainLen + 1 : 1;
      stats.chainLen = chainLen;
      stats.lastColor = target.color;
      comboWindowUntil = state.now + COMBO_WINDOW_MS;

      if (isEnergyOrb(target)) {
        stats.score += ENERGY_POINTS;
        energy = true;
      } else {
        const multiplier = Math.min(1 + 0.25 * Math.max(chainLen - 2, 0), 4);
        const awarded = Math.round(BASE_POINTS * multiplier);
        stats.score += awarded;
        stats.timeLeft += BASE_TIME_REWARD;
        if (chainLen >= 3) {
          stats.bestCombo = Math.max(stats.bestCombo, chainLen);
          get().progressCombo(chainLen);
        }
        get().progressColor(target.color);
      }
    }

    if (stats.timeLeft < 0) stats.timeLeft = 0;
    if (energy) {
      stats.energyCollected += 1;
    }
    set({ stats, bubbles: remaining, comboWindowUntil, currentStreak });

    if (energy) {
      get().grantBooster(1);
    }

    return { hit: true, energy, drain, combo: stats.chainLen };
  },
  grantBooster: (count) => {
    if (count <= 0) return;
    const state = get();
    const bank: BoosterBank = {
      freeOrbs: state.boosterBank.freeOrbs + count,
      lastDailyKey: state.boosterBank.lastDailyKey,
    };
    persistBooster(bank);
    set({ boosterBank: bank });
  },
  consumeBooster: () => {
    const state = get();
    if (state.boosterBank.freeOrbs <= 0) {
      return false;
    }
    const bank: BoosterBank = {
      freeOrbs: state.boosterBank.freeOrbs - 1,
      lastDailyKey: state.boosterBank.lastDailyKey,
    };
    persistBooster(bank);
    set({ boosterBank: bank });
    get().activateSlowTime(SLOW_TIME_DURATION_MS);
    return true;
  },
  activateSlowTime: (durationMs) => {
    const state = get();
    const until = Math.max(state.slowTimeUntil, state.now) + durationMs;
    set({ slowTimeUntil: until });
  },
  loadDaily: (seed = 'rubble-daily') => {
    const date = new Date();
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth() + 1;
    const utcDay = date.getUTCDate();
    const key = `${utcYear.toString().padStart(4, '0')}-${utcMonth.toString().padStart(2, '0')}-${utcDay
      .toString()
      .padStart(2, '0')}`;
    let missions = readPersistedMissions(key);
    if (!missions) {
      missions = generateDailyMissions(seed, key);
      persistMissions(key, missions);
    }
    set({ missions, dailyKey: key });
    const bank = get().boosterBank;
    if (bank.lastDailyKey !== key) {
      const refreshed = { ...bank, freeOrbs: bank.freeOrbs, lastDailyKey: key };
      persistBooster(refreshed);
      set({ boosterBank: refreshed });
    }
  },
  setStageSize: (width, height) => {
    set({ width, height });
  },
  claimMission: (id) => {
    const state = get();
    if (!state.dailyKey) return;
    let dirty = false;
    const missions = state.missions.map((mission) => {
      if (mission.id !== id || !mission.completed || mission.claimed) {
        return mission;
      }
      dirty = true;
      return { ...mission, claimed: true };
    });
    if (dirty) {
      set({ missions });
      persistMissions(state.dailyKey, missions);
    }
    const claimedMission = missions.find((mission) => mission.id === id);
    if (claimedMission && claimedMission.completed && claimedMission.claimed) {
      get().grantBooster(claimedMission.rewardOrbs);
    }
    if (missions.every((mission) => mission.claimed)) {
      if (typeof window !== 'undefined') {
        const bonusKey = bonusStorageKey(state.dailyKey);
        if (!window.localStorage.getItem(bonusKey)) {
          get().grantBooster(1);
          window.localStorage.setItem(bonusKey, 'claimed');
        }
      }
    }
  },
  progressColor: (color) => {
    const state = get();
    if (!state.dailyKey) return;
    let dirty = false;
    const missions = state.missions.map((mission) => {
      if (mission.kind !== 'color' || mission.completed) {
        return mission;
      }
      if (mission.id.includes(color)) {
        const progress = Math.min(mission.target, mission.progress + 1);
        const completed = progress >= mission.target;
        dirty = dirty || progress !== mission.progress || completed !== mission.completed;
        return { ...mission, progress, completed };
      }
      return mission;
    });
    if (dirty) {
      set({ missions });
      persistMissions(state.dailyKey, missions);
    }
  },
  progressCombo: (combo) => {
    const state = get();
    if (!state.dailyKey) return;
    let dirty = false;
    const missions = state.missions.map((mission) => {
      if (mission.kind !== 'combo' || mission.completed) {
        return mission;
      }
      if (combo >= mission.target) {
        dirty = true;
        return { ...mission, progress: mission.target, completed: true };
      }
      return mission;
    });
    if (dirty) {
      set({ missions });
      persistMissions(state.dailyKey, missions);
    }
  },
  progressSurvival: (seconds) => {
    const state = get();
    if (!state.dailyKey) return;
    const hasActive = state.missions.some((mission) => mission.kind === 'survival' && !mission.completed);
    if (!hasActive) {
      if (state.survivalAccumulator !== 0) {
        set({ survivalAccumulator: 0 });
      }
      return;
    }
    const pending = state.survivalAccumulator + seconds;
    let applied = 0;
    let dirty = false;
    const missions = state.missions.map((mission) => {
      if (mission.kind !== 'survival' || mission.completed) {
        return mission;
      }
      if (pending < 1 && mission.progress < mission.target) {
        return mission;
      }
      const increment = pending >= 1 ? pending : 0;
      if (increment <= 0) {
        return mission;
      }
      const progress = Math.min(mission.target, mission.progress + increment);
      const completed = progress >= mission.target;
      dirty = dirty || progress !== mission.progress || completed !== mission.completed;
      applied = increment;
      return { ...mission, progress, completed };
    });
    if (dirty) {
      set({ missions, survivalAccumulator: pending - applied });
      persistMissions(state.dailyKey, missions);
    } else {
      set({ survivalAccumulator: pending });
    }
  },
}));
