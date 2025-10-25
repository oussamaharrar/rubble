'use client';

import { create } from 'zustand';
import { Bubble, BoosterBank, GamePhase, Mission, RunStats, BubbleColor } from '@/types/game';
import {
  generateDailyMissions,
  progressColor,
  progressCombo,
  progressSurvival,
  claimMission,
} from '@/lib/missions';

const MAX_BUBBLES = 40;
const MAX_STORM_BUBBLES = 10;
const BASE_POINTS = 10;
const ENERGY_POINTS = 20;
const DRAIN_PENALTY = 15;
const WRONG_TAP_PENALTY_TIME = 3;
const COLOR_LIST: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];

const STORAGE_KEY_MISSIONS = 'rubble-daily-missions';
const STORAGE_KEY_BOOST = 'rubble-booster-bank';

const INITIAL_STATS: RunStats = {
  score: 0,
  bestCombo: 0,
  streak: 0,
  timeLeft: 60,
  chainLen: 0,
  comboActiveUntil: 0,
  startAt: 0,
  elapsed: 0,
};

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createBubble(id: string): Bubble {
  return {
    id,
    x: 0,
    y: 0,
    r: 0,
    color: 'blue',
    vx: 0,
    vy: 0,
    createdAt: 0,
    active: false,
  };
}

function computeChecksum(payload: unknown): string {
  const raw = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash + raw.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return hash.toString(16);
}

function getDateKey(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return utc.toISOString().slice(0, 10);
}

function randomColor(random: () => number): BubbleColor {
  return COLOR_LIST[Math.floor(random() * COLOR_LIST.length)] ?? 'yellow';
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type MissionPersistence = {
  key: string;
  missions: Mission[];
};

type BoosterPersistence = BoosterBank;

type GameStore = {
  phase: GamePhase;
  stats: RunStats;
  bubbles: Bubble[];
  stormBubbles: Bubble[];
  pool: Bubble[];
  missions: Mission[];
  boosterBank: BoosterBank;
  viewport: { width: number; height: number };
  rngSeed: number;
  slowTimeUntil: number;
  comboMultiplier: number;
  storm: { active: boolean; next: number; remaining: number };
  now: number;
  dailyKey: string;
  initialized: boolean;
  survivalAccumulator: number;
  hydratePersistence: () => void;
  setViewport: (width: number, height: number) => void;
  startRun: () => void;
  endRun: () => void;
  tick: (dt: number) => void;
  spawnBubble: (storm?: boolean, overrides?: Partial<Bubble>) => void;
  tap: (x: number, y: number) => {
    hit: boolean;
    energy?: boolean;
    drain?: boolean;
    color?: BubbleColor;
    storm?: boolean;
  };
  grantBooster: (count?: number) => void;
  consumeBooster: () => boolean;
  claimMissionReward: (id: string) => void;
  activateSlowTime: (duration: number) => void;
};

export const useGameStore = create<GameStore>((set, get) => {
  const baseBubbles: Bubble[] = Array.from(
    { length: MAX_BUBBLES + MAX_STORM_BUBBLES },
    (_, index) => createBubble(`bubble-${index}`),
  );
  const pool = [...baseBubbles];

  const hydrateMissions = (): Mission[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_MISSIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { payload: MissionPersistence; checksum: string };
      if (computeChecksum(parsed.payload) !== parsed.checksum) return [];
      const { key, missions } = parsed.payload;
      const today = getDateKey();
      if (key !== today) return [];
      return missions;
    } catch (error) {
      console.warn('[Rubble] Failed to parse missions', error);
      return [];
    }
  };

  const hydrateBoosters = (): BoosterBank => {
    if (typeof window === 'undefined') return { freeOrbs: 0, lastDailyKey: '' };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_BOOST);
      if (!raw) return { freeOrbs: 0, lastDailyKey: '' };
      const parsed = JSON.parse(raw) as { payload: BoosterPersistence; checksum: string };
      if (computeChecksum(parsed.payload) !== parsed.checksum) return { freeOrbs: 0, lastDailyKey: '' };
      return parsed.payload;
    } catch (error) {
      console.warn('[Rubble] Failed to parse booster bank', error);
      return { freeOrbs: 0, lastDailyKey: '' };
    }
  };

  const persistMissions = (missions: Mission[], key: string) => {
    if (typeof window === 'undefined') return;
    const payload: MissionPersistence = { missions, key };
    const checksum = computeChecksum(payload);
    window.localStorage.setItem(STORAGE_KEY_MISSIONS, JSON.stringify({ payload, checksum }));
  };

  const persistBoosterBank = (bank: BoosterBank) => {
    if (typeof window === 'undefined') return;
    const checksum = computeChecksum(bank);
    window.localStorage.setItem(STORAGE_KEY_BOOST, JSON.stringify({ payload: bank, checksum }));
  };

  const spawnBubbleInternal = (
    storm: boolean,
    overrides?: Partial<Bubble>,
  ): Bubble | undefined => {
    const state = get();
    if (!state.viewport.width || !state.viewport.height) return undefined;
    const next = state.pool.pop();
    if (!next) return undefined;
    const rng = mulberry32(state.rngSeed + Math.floor(Math.random() * 1000));
    const color = overrides?.color ?? randomColor(rng);
    const radius = overrides?.r ?? (storm ? 18 + Math.random() * 14 : 20 + Math.random() * 20);
    const vx = overrides?.vx ?? (Math.random() - 0.5) * (storm ? 120 : 60);
    const vy = overrides?.vy ?? -((storm ? 160 : 90) + Math.random() * (storm ? 120 : 60));

    Object.assign(next, {
      active: true,
      storm,
      poison: overrides?.poison ?? false,
      color,
      x: overrides?.x ?? Math.random() * state.viewport.width,
      y:
        overrides?.y ??
        state.viewport.height + radius + Math.random() * (storm ? state.viewport.height * 0.2 : 60),
      vx,
      vy,
      r: radius,
      createdAt: state.now,
    });
    if (storm) {
      state.stormBubbles.push(next);
    } else {
      state.bubbles.push(next);
    }
    return next;
  };

  const saveMissions = (missions: Mission[], key: string) => {
    persistMissions(missions, key);
  };

  const saveBoosters = (bank: BoosterBank) => {
    persistBoosterBank(bank);
  };

  return {
    phase: 'start',
    stats: { ...INITIAL_STATS },
    bubbles: [],
    stormBubbles: [],
    pool,
    missions: [],
    boosterBank: { freeOrbs: 0, lastDailyKey: '' },
    viewport: { width: 0, height: 0 },
    rngSeed: Date.now() & 0xfffffff,
    slowTimeUntil: 0,
    comboMultiplier: 1,
    storm: { active: false, next: 30, remaining: 0 },
    now: nowMs(),
    dailyKey: getDateKey(),
    initialized: false,
    survivalAccumulator: 0,
    hydratePersistence: () => {
      const today = getDateKey();
      const missions = hydrateMissions();
      const boosterBank = hydrateBoosters();
      let nextMissions = missions;
      const bank = { ...boosterBank };
      if (missions.length === 0 || boosterBank.lastDailyKey !== today) {
        nextMissions = generateDailyMissions(boosterBank.lastDailyKey || bank.freeOrbs, today);
        bank.lastDailyKey = today;
        if (missions.length === 0) {
          bank.freeOrbs = bank.freeOrbs;
        }
        persistBoosterBank(bank);
        persistMissions(nextMissions, today);
      }
      set({ missions: nextMissions, boosterBank: bank, dailyKey: today, initialized: true });
    },
    setViewport: (width, height) => {
      set({ viewport: { width, height } });
    },
    startRun: () => {
      const now = nowMs();
      const stats: RunStats = {
        ...INITIAL_STATS,
        timeLeft: 60,
        startAt: now,
        comboActiveUntil: 0,
      };
      set({
        phase: 'playing',
        stats,
        bubbles: [],
        stormBubbles: [],
        slowTimeUntil: 0,
        comboMultiplier: 1,
        storm: { active: false, next: 30, remaining: 0 },
        now,
        survivalAccumulator: 0,
      });
      const state = get();
      state.pool.splice(0, state.pool.length, ...baseBubbles);
      state.pool.forEach((bubble) => {
        bubble.active = false;
      });
      state.bubbles.length = 0;
      state.stormBubbles.length = 0;
      for (let i = 0; i < MAX_BUBBLES / 2; i += 1) {
        spawnBubbleInternal(false);
      }
    },
    endRun: () => {
      set({ phase: 'summary' });
    },
    tick: (dt) => {
      const state = get();
      const now = state.now + dt * 1000;
      const timeDecay = dt;
      const stats = { ...state.stats };
      const playing = state.phase === 'playing' || state.phase === 'storm';
      let missions = state.missions;
      let survivalAccumulator = state.survivalAccumulator;
      if (playing) {
        stats.timeLeft = Math.max(0, stats.timeLeft - timeDecay);
        stats.elapsed += dt;
        survivalAccumulator += dt;
        if (survivalAccumulator >= 0.5) {
          const updated = state.missions.map((mission) => progressSurvival(mission, survivalAccumulator));
          const changed = updated.some((mission, index) => mission !== state.missions[index]);
          if (changed) {
            missions = updated;
          }
          survivalAccumulator = 0;
        }
      }

      const speedFactor = now < state.slowTimeUntil ? 0.5 : 1;
      const updateBubble = (bubble: Bubble, collection: Bubble[], index: number) => {
        if (!bubble.active) return;
        bubble.x += bubble.vx * dt * speedFactor;
        bubble.y += bubble.vy * dt * speedFactor;
        if (bubble.y + bubble.r < 0 || bubble.x < -80 || bubble.x > state.viewport.width + 80) {
          bubble.active = false;
          state.pool.push(bubble);
          collection.splice(index, 1);
        }
      };

      for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
        updateBubble(state.bubbles[i], state.bubbles, i);
      }
      for (let i = state.stormBubbles.length - 1; i >= 0; i -= 1) {
        updateBubble(state.stormBubbles[i], state.stormBubbles, i);
      }

      if (playing && state.bubbles.length < MAX_BUBBLES) {
        spawnBubbleInternal(false);
      }

      if (state.storm.active && playing) {
        const remaining = state.storm.remaining - dt;
        if (remaining <= 0) {
          set({ phase: 'playing', storm: { active: false, next: state.storm.next + 30, remaining: 0 } });
        } else {
          set({ storm: { ...state.storm, remaining } });
          if (state.stormBubbles.length < MAX_STORM_BUBBLES) {
            const shouldEnergy = Math.random() > 0.4;
            spawnBubbleInternal(true, {
              poison: !shouldEnergy,
              color: shouldEnergy ? 'orange' : 'blue',
              vx: (Math.random() - 0.5) * 220,
              vy: -((shouldEnergy ? 200 : 260) + Math.random() * 80),
              r: shouldEnergy ? 24 + Math.random() * 10 : 20 + Math.random() * 12,
            });
          }
        }
      } else if (playing && stats.elapsed >= state.storm.next) {
        set({ phase: 'storm', storm: { active: true, next: state.storm.next, remaining: 7 } });
      }

      if (playing && stats.timeLeft <= 0 && state.phase !== 'summary') {
        set({ stats, now, phase: 'summary', survivalAccumulator });
        return;
      }

      // Missions survival progress
      if (playing) {
        const update: Partial<GameStore> = { stats, now, survivalAccumulator };
        if (missions !== state.missions) {
          update.missions = missions;
        }
        set(update);
        if (missions !== state.missions) {
          saveMissions(missions, state.dailyKey);
        }
      } else {
        set({ stats, now, survivalAccumulator });
      }
    },
    spawnBubble: (storm, overrides) => {
      spawnBubbleInternal(Boolean(storm), overrides);
    },
    tap: (x, y) => {
      const state = get();
      const now = nowMs();
      const allBubbles = [...state.stormBubbles, ...state.bubbles];
      let hit: Bubble | undefined;
      for (let i = 0; i < allBubbles.length; i += 1) {
        const bubble = allBubbles[i];
        if (!bubble.active) continue;
        const dx = x - bubble.x;
        const dy = y - bubble.y;
        if (dx * dx + dy * dy <= bubble.r * bubble.r) {
          hit = bubble;
          break;
        }
      }
      if (!hit) {
        const stats = {
          ...state.stats,
          timeLeft: Math.max(0, state.stats.timeLeft - WRONG_TAP_PENALTY_TIME),
          chainLen: 0,
          lastColor: undefined,
          comboActiveUntil: 0,
          streak: 0,
        };
        set({ stats, comboMultiplier: 1 });
        return { hit: false };
      }

      const basePoints = hit.storm && hit.poison ? -DRAIN_PENALTY : hit.storm ? ENERGY_POINTS : BASE_POINTS;
      const timeDelta = hit.storm && hit.poison ? -2 : 0.5;

      const stats = { ...state.stats };
      if (hit.storm && hit.poison) {
        stats.chainLen = 0;
        stats.lastColor = undefined;
        stats.comboActiveUntil = 0;
        stats.timeLeft = Math.max(0, stats.timeLeft + timeDelta);
        stats.score = Math.max(0, stats.score + basePoints);
        stats.streak = 0;
        set({ stats, comboMultiplier: 1 });
        hit.active = false;
        state.pool.push(hit);
        state.stormBubbles.splice(state.stormBubbles.indexOf(hit), 1);
        return { hit: true, drain: true, color: hit.color, storm: Boolean(hit.storm) };
      }

      const sameColor = stats.lastColor === hit.color && now <= stats.comboActiveUntil;
      stats.chainLen = sameColor ? stats.chainLen + 1 : 1;
      stats.lastColor = hit.color;
      stats.comboActiveUntil = now + 5000;
      stats.timeLeft = Math.max(0, stats.timeLeft + timeDelta);

      const chainLen = stats.chainLen;
      let multiplier = 1;
      if (chainLen >= 3) {
        multiplier = Math.min(1 + 0.25 * (chainLen - 2), 4);
        stats.bestCombo = Math.max(stats.bestCombo, chainLen);
      }
      stats.score = Math.max(0, stats.score + Math.round(basePoints * multiplier));
      stats.streak += 1;
      set({
        stats,
        comboMultiplier: multiplier,
        missions: state.missions.map((mission) => {
          let updated = mission;
          if (mission.kind === 'color' && !hit?.storm) {
            updated = progressColor(mission, hit?.color);
          }
          if (mission.kind === 'combo' && chainLen >= 3) {
            updated = progressCombo(updated, chainLen);
          }
          return updated;
        }),
      });
      const missions = get().missions;
      saveMissions(missions, state.dailyKey);

      if (hit.storm) {
        const bank = { ...state.boosterBank, freeOrbs: state.boosterBank.freeOrbs + 1 };
        set({ boosterBank: bank });
        saveBoosters(bank);
      }

      hit.active = false;
      if (hit.storm) {
        state.stormBubbles.splice(state.stormBubbles.indexOf(hit), 1);
      } else {
        state.bubbles.splice(state.bubbles.indexOf(hit), 1);
      }
      state.pool.push(hit);

      return { hit: true, energy: hit.storm ? !hit.poison : undefined, color: hit.color, storm: Boolean(hit.storm) };
    },
    grantBooster: (count = 1) => {
      const state = get();
      const bank = { ...state.boosterBank, freeOrbs: state.boosterBank.freeOrbs + count };
      set({ boosterBank: bank });
      saveBoosters(bank);
    },
    consumeBooster: () => {
      const state = get();
      if (state.boosterBank.freeOrbs <= 0) return false;
      const bank = { ...state.boosterBank, freeOrbs: state.boosterBank.freeOrbs - 1 };
      set({ boosterBank: bank });
      saveBoosters(bank);
      return true;
    },
    claimMissionReward: (id: string) => {
      const state = get();
      let claimedAny = false;
      const missions = state.missions.map((mission) => {
        if (mission.id !== id) return mission;
        if (mission.claimed || !mission.completed) return mission;
        const claimed = claimMission(mission);
        if (claimed.claimed) {
          claimedAny = true;
          state.grantBooster(claimed.rewardOrbs);
        }
        return claimed;
      });
      set({ missions });
      saveMissions(missions, state.dailyKey);
      if (claimedAny) {
        const completedAll = missions.every((mission) => mission.completed && mission.claimed);
        if (completedAll) {
          state.grantBooster(1);
        }
      }
    },
    activateSlowTime: (duration: number) => {
      const until = nowMs() + duration;
      set({ slowTimeUntil: until });
    },
  };
});
