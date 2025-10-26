'use client';

import { create } from 'zustand';
import { persistMissions, readPersistedMissions, generateDailyMissions, bonusStorageKey } from '@/lib/missions';
import { deriveDailyTuning, getDailyKeyUTC, isDailyEligible, seedFromDailyKey, type DailyTuning } from '@/lib/daily';
import type {
  BoardKind,
  Bubble,
  BoosterBank,
  BubbleColor,
  BurstState,
  EntryMode,
  GamePhase,
  GameSettings,
  GameUnlocks,
  GoldenOrbState,
  Mission,
  TargetState,
  RunStats,
} from '@/types/game';

const COMBO_WINDOW_MS = 5_000;
const BASE_POINTS = 10;
const BASE_TIME_REWARD = 0.5;
const WRONG_TAP_PENALTY = 3;
const DRAIN_PENALTY_TIME = 2;
const DRAIN_PENALTY_SCORE = 15;
const ENERGY_POINTS = 20;
const SLOW_TIME_DURATION_MS = 5_000;
const BURST_BASE_RADIUS = 200;
const BURST_OVERCHARGE_MULTIPLIER = 1.3;
const BURST_SCORE_MULTIPLIER = 0.7;
const GOLDEN_RESPAWN_MIN_MS = 20_000;
const GOLDEN_RESPAWN_RANGE_MS = 10_000;

const BOOSTER_KEY = 'rubble:booster-bank';
const SETTINGS_KEY = 'rubble_settings_v2';
const UNLOCKS_KEY = 'rubble:unlocks-v1';
const DAILY_RUN_KEY_PREFIX = 'rubble:daily-runs';

const BASE_MAX_BUBBLES = 40;
const BASE_MAX_STORM_ORBS = 10;
const BASE_STORM_INTERVAL_MS = 30_000;
const BASE_STORM_DURATION_MS = 7_000;
const BASE_SPEED_FACTOR = 1;

const DEFAULT_PALETTE: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];

function settingsDefaults(): GameSettings {
  return {
    haptics: true,
    reducedMotion: false,
    sound: true,
    leftHanded: false,
    theme: 'default',
    particleStyle: 'classic',
  };
}

function unlockDefaults(): GameUnlocks {
  return {
    themeSkies: false,
    fxSparkle: false,
  };
}

function readUnlocks(): GameUnlocks {
  if (typeof window === 'undefined') {
    return unlockDefaults();
  }
  try {
    const raw = window.localStorage.getItem(UNLOCKS_KEY);
    if (!raw) {
      return unlockDefaults();
    }
    const parsed = JSON.parse(raw) as Partial<GameUnlocks>;
    return {
      themeSkies: parsed.themeSkies === true,
      fxSparkle: parsed.fxSparkle === true,
    };
  } catch {
    return unlockDefaults();
  }
}

function persistUnlocks(unlocks: GameUnlocks) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks));
  } catch {
    // ignore persistence failures
  }
}

function readSettings(): GameSettings {
  if (typeof window === 'undefined') {
    return settingsDefaults();
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return settingsDefaults();
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings> & { sfx?: boolean };
    const defaults = settingsDefaults();
    const legacySound = typeof parsed.sfx === 'boolean' ? parsed.sfx : undefined;
    return {
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : defaults.haptics,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaults.reducedMotion,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : legacySound ?? defaults.sound,
      leftHanded: typeof parsed.leftHanded === 'boolean' ? parsed.leftHanded : defaults.leftHanded,
      theme: parsed.theme === 'skies' ? 'skies' : defaults.theme,
      particleStyle: parsed.particleStyle === 'sparkle' ? 'sparkle' : defaults.particleStyle,
    };
  } catch {
    return settingsDefaults();
  }
}

function persistSettings(settings: GameSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore persistence errors
  }
}

function dailyRunKey(key: string) {
  return `${DAILY_RUN_KEY_PREFIX}:${key}`;
}

function readDailyRunCount(key: string): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(dailyRunKey(key));
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeDailyRunCount(key: string, count: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(dailyRunKey(key), `${Math.max(0, Math.floor(count))}`);
  } catch {
    // ignore persistence errors
  }
}

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
    energyOrbsCollected: 0,
    paidEntryOrbs: 0,
    entryMode: null,
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

function randomColor(rng: () => number, palette: BubbleColor[]): BubbleColor {
  if (palette.length === 0) {
    return DEFAULT_PALETTE[Math.floor(rng() * DEFAULT_PALETTE.length) % DEFAULT_PALETTE.length];
  }
  return palette[Math.floor(rng() * palette.length) % palette.length];
}

function createBubble(
  rng: () => number,
  width: number,
  height: number,
  now: number,
  palette: BubbleColor[],
  speedFactor: number,
  options?: { storm?: boolean; poison?: boolean; energy?: boolean }
): Bubble {
  const radius = 24 + rng() * 18;
  const x = radius + rng() * (Math.max(width - radius * 2, radius));
  const y = height + radius + rng() * height * 0.4;
  const speedY = -((0.08 + rng() * 0.12) * height * speedFactor);
  const speedX = (rng() - 0.5) * 0.12 * width * Math.max(0.6, Math.min(speedFactor, 1.4));
  const color = options?.storm
    ? options?.energy
      ? 'blue'
      : 'orange'
    : randomColor(rng, palette);
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

function defaultBurstState(): BurstState {
  return {
    readyAt: 0,
    charging: false,
    chargeStartAt: 0,
    lastUseAt: 0,
    cooldownMs: 12_000,
    minHoldMs: 600,
    maxHoldMs: 1_500,
    overcharge: false,
  };
}

function defaultGoldenState(): GoldenOrbState {
  return { active: false, spawnedAt: 0, graceMs: 1_500, x: 0, y: 0, r: 22, toxic: false };
}

type TapOptions = {
  scoreMultiplier?: number;
  comboContribution?: boolean;
  allowPerfect?: boolean;
  timeMultiplier?: number;
  source?: 'tap' | 'burst';
};

export type TapResult = {
  hit: boolean;
  energy?: boolean;
  drain?: boolean;
  combo?: number;
  perfect?: boolean;
  targetHit?: boolean;
  radius?: number;
  color?: BubbleColor;
  golden?: boolean;
  goldenToxic?: boolean;
  burst?: boolean;
  poppedIds?: string[];
};

type GameStore = {
  phase: GamePhase;
  boardKind: BoardKind;
  stats: RunStats;
  entryMode: EntryMode | null;
  bubbles: Bubble[];
  missions: Mission[];
  boosterBank: BoosterBank;
  unlocks: GameUnlocks;
  stormAt: number;
  stormInterval: number;
  stormDuration: number;
  maxBubbles: number;
  maxStormOrbs: number;
  bubbleSpeedFactor: number;
  now: number;
  rngSeed: number;
  rng: () => number;
  width: number;
  height: number;
  comboWindowUntil: number;
  slowTimeUntil: number;
  target: TargetState;
  nextTargetAt: number;
  targetCelebrationUntil: number;
  perfectUntil: number;
  startedAt: number;
  dailyKey: string;
  dailyRunCount: number;
  officialDailyEligible: boolean;
  dailyTuning: DailyTuning | null;
  palette: BubbleColor[];
  settings: GameSettings;
  lastRunOfficialDaily: boolean;
  survivalAccumulator: number;
  currentStreak: number;
  resumePhase: 'playing' | 'storm' | null;
  lastTapAt: number;
  lastTapX: number;
  lastTapY: number;
  lastComboFrame: number;
  timeGainWindowStart: number;
  timeGainAccumulated: number;
  burst: BurstState;
  burstPointer: { x: number; y: number } | null;
  golden: GoldenOrbState;
  nextGoldenSpawnAt: number;
  startRun: (mode?: EntryMode) => void;
  endRun: () => void;
  resetToStart: () => void;
  pauseRun: () => void;
  resumeRun: () => void;
  pause: () => void;
  resume: () => void;
  beginGameplay: () => void;
  setPhase: (phase: GamePhase) => void;
  tick: (dt: number) => void;
  spawnBubbles: (count?: number) => void;
  spawnStormOrbs: () => void;
  tap: (x: number, y: number, options?: TapOptions) => TapResult;
  grantBooster: (count: number, source?: 'energy' | 'paid' | 'mission' | 'other') => void;
  grantOrbOnPaidEntry: () => void;
  consumeBooster: () => boolean;
  loadDaily: (seed?: string | number) => void;
  setBoardKind: (board: BoardKind) => void;
  setSettings: (patch: Partial<GameSettings>) => void;
  unlockFeature: (key: keyof GameUnlocks) => void;
  setStageSize: (width: number, height: number) => void;
  claimMission: (id: string) => void;
  progressColor: (color: BubbleColor) => void;
  progressCombo: (combo: number) => void;
  progressSurvival: (seconds: number) => void;
  activateSlowTime: (durationMs: number) => void;
  beginBurstCharge: (x: number, y: number) => boolean;
  cancelBurstCharge: () => void;
  toggleBurstOvercharge: () => void;
  fireBurst: (x: number, y: number, holdMs: number) => TapResult;
  updateBurstPointer: (x: number, y: number) => void;
  spawnGoldenOrb: (now?: number) => void;
  updateGoldenOrb: (now: number) => void;
  hitGoldenOrb: (source: 'tap' | 'burst', position?: { x: number; y: number }) => { hit: boolean; toxic: boolean };
};

export const useGameStore = create<GameStore>((set, get) => {
  const applyBubbleHit = (targetId: string, x: number, y: number, options?: TapOptions): TapResult => {
    const state = get();
    const index = state.bubbles.findIndex((bubble) => bubble.id === targetId);
    if (index === -1) {
      return { hit: false };
    }

    const bubble = state.bubbles[index];
    const now = state.now;
    let targetState = state.target;
    let nextTargetAt = state.nextTargetAt;
    let celebrationUntil = state.targetCelebrationUntil;
    let perfectUntil = state.perfectUntil;

    const distance = Math.hypot(x - bubble.x, y - bubble.y);
    const perfectThreshold = bubble.r * 0.35;
    const activeTarget = Boolean(targetState.active && targetState.color && now <= targetState.expiresAt);
    const matchesTarget = activeTarget && !isDrainOrb(bubble) && targetState.color === bubble.color;
    const allowPerfect = options?.allowPerfect ?? true;
    const perfectCandidate = allowPerfect && !isDrainOrb(bubble) && distance <= perfectThreshold;

    const remaining = [...state.bubbles.slice(0, index), ...state.bubbles.slice(index + 1)];
    const stats = { ...state.stats };
    let comboWindowUntil = state.comboWindowUntil;
    let energy = false;
    let drain = false;
    let targetHit = false;
    let perfect = false;
    let currentStreak = state.currentStreak;
    let lastComboFrame = state.lastComboFrame;
    let timeGainWindowStart = state.timeGainWindowStart;
    let timeGainAccumulated = state.timeGainAccumulated;

    if (now - timeGainWindowStart >= 1_000) {
      timeGainWindowStart = now;
      timeGainAccumulated = 0;
    }

    const allowComboContribution = options?.comboContribution !== false;
    const scoreMultiplier = options?.scoreMultiplier ?? 1;
    const timeMultiplier = options?.timeMultiplier ?? scoreMultiplier;
    const source = options?.source ?? 'tap';

    if (isDrainOrb(bubble)) {
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

      let chainLen = stats.chainLen;
      if (allowComboContribution) {
        const sameColor = stats.lastColor === bubble.color && now <= state.comboWindowUntil;
        chainLen = sameColor ? stats.chainLen + 1 : 1;
        stats.chainLen = chainLen;
        stats.lastColor = bubble.color;
        const baseWindow = now + COMBO_WINDOW_MS;
        comboWindowUntil = baseWindow;
      } else {
        chainLen = Math.max(stats.chainLen, 1);
      }

      if (isEnergyOrb(bubble)) {
        let awarded = ENERGY_POINTS;
        if (matchesTarget) {
          targetHit = true;
          awarded *= 3;
          stats.timeLeft += 2;
          celebrationUntil = Math.max(celebrationUntil, now + 1_500);
          nextTargetAt = now + 9_000 + state.rng() * 3_000;
          targetState = { active: false, expiresAt: 0 };
        }
        stats.score += awarded;
        energy = true;
      } else {
        const multiplier = Math.min(1 + 0.25 * Math.max(chainLen - 2, 0), 4);
        const baseAward = Math.round(BASE_POINTS * multiplier);
        let awarded = matchesTarget ? baseAward * 3 : baseAward;
        awarded = Math.round(awarded * scoreMultiplier);
        if (awarded > 0) {
          stats.score += awarded;
        }
        const availableGain = Math.max(0, 1 - timeGainAccumulated);
        const appliedGain = Math.min(BASE_TIME_REWARD * timeMultiplier, availableGain);
        stats.timeLeft += appliedGain;
        timeGainAccumulated += appliedGain;
        if (matchesTarget) {
          stats.timeLeft += 2;
          targetHit = true;
          celebrationUntil = Math.max(celebrationUntil, now + 1_500);
          nextTargetAt = now + 9_000 + state.rng() * 3_000;
          targetState = { active: false, expiresAt: 0 };
        }
        if (allowComboContribution && chainLen >= 3 && now - lastComboFrame > 16) {
          stats.bestCombo = Math.max(stats.bestCombo, chainLen);
          get().progressCombo(chainLen);
          lastComboFrame = now;
        }
        get().progressColor(bubble.color);
      }

      if (perfectCandidate && allowComboContribution) {
        perfect = true;
        const extendedWindow = Math.min(
          Math.max(now + COMBO_WINDOW_MS, state.comboWindowUntil) + 1_000,
          now + COMBO_WINDOW_MS + 1_000
        );
        comboWindowUntil = extendedWindow;
        stats.score += 5;
        perfectUntil = Math.max(perfectUntil, now + 1_000);
      }
    }

    if (stats.timeLeft < 0) stats.timeLeft = 0;

    set({
      stats,
      bubbles: remaining,
      comboWindowUntil,
      currentStreak,
      lastTapAt: now,
      lastTapX: x,
      lastTapY: y,
      lastComboFrame,
      timeGainWindowStart,
      timeGainAccumulated,
      target: targetState,
      nextTargetAt,
      targetCelebrationUntil: celebrationUntil,
      perfectUntil,
    });

    if (energy) {
      get().grantBooster(1, 'energy');
    }

    return {
      hit: true,
      energy,
      drain,
      combo: get().stats.chainLen,
      perfect,
      targetHit,
      radius: bubble.r,
      color: bubble.color,
      burst: source === 'burst',
    };
  };

  const hitGoldenOrb = (source: 'tap' | 'burst', position?: { x: number; y: number }) => {
    const state = get();
    if (!state.golden.active) {
      return { hit: false, toxic: false };
    }
    const golden = state.golden;
    const stats = { ...state.stats };
    const toxic = golden.toxic;
    let comboWindowUntil = state.comboWindowUntil;
    let currentStreak = state.currentStreak;
    const timeGainWindowStart = state.timeGainWindowStart;
    const timeGainAccumulated = state.timeGainAccumulated;

    if (toxic) {
      stats.timeLeft = Math.max(0, stats.timeLeft - 5);
      stats.chainLen = 0;
      stats.lastColor = undefined;
      stats.streak = Math.max(stats.streak, state.currentStreak);
      currentStreak = 0;
      comboWindowUntil = 0;
    } else {
      const chainLen = Math.max(stats.chainLen, 1);
      const multiplier = Math.min(1 + 0.25 * Math.max(chainLen - 2, 0), 4);
      const baseAward = Math.round(BASE_POINTS * multiplier) * 5;
      stats.score += baseAward;
      stats.timeLeft += 3;
      currentStreak = state.currentStreak + 1;
      stats.streak = Math.max(stats.streak, currentStreak);
      comboWindowUntil = Math.max(state.comboWindowUntil, state.now + COMBO_WINDOW_MS);
    }

    const nextSpawn = state.now + GOLDEN_RESPAWN_MIN_MS + state.rng() * GOLDEN_RESPAWN_RANGE_MS;
    const patch: Partial<GameStore> = {
      stats,
      golden: { ...defaultGoldenState(), graceMs: golden.graceMs },
      nextGoldenSpawnAt: nextSpawn,
      comboWindowUntil,
      currentStreak,
      timeGainWindowStart,
      timeGainAccumulated,
      lastTapAt: state.now,
    };

    if (position) {
      patch.lastTapX = position.x;
      patch.lastTapY = position.y;
    }

    set(patch);

    return { hit: true, toxic };
  };

  const scheduleNextGolden = (now: number) => now + GOLDEN_RESPAWN_MIN_MS + get().rng() * GOLDEN_RESPAWN_RANGE_MS;

  const spawnGoldenOrb = (now?: number) => {
    const state = get();
    if (state.golden.active) return;
    const currentNow = typeof now === 'number' ? now : state.now;
    if (currentNow < state.nextGoldenSpawnAt) return;
    if (state.phase !== 'playing' && state.phase !== 'storm') return;

    const radius = state.golden.r;
    const width = state.width;
    const height = state.height;
    const marginX = Math.max(radius + 24, width * 0.08);
    const marginY = Math.max(radius + 24, height * 0.08);
    const maxWidth = Math.max(width - marginX * 2, radius);
    const maxHeight = Math.max(height - marginY * 2, radius);
    const rng = state.rng;
    const x = marginX + rng() * maxWidth;
    const y = marginY + rng() * maxHeight;
    const id = `${currentNow}-${Math.floor(rng() * 1_000_000)}`;

    set({
      golden: {
        active: true,
        id,
        spawnedAt: currentNow,
        graceMs: state.golden.graceMs,
        x,
        y,
        r: state.golden.r,
        toxic: false,
      },
      nextGoldenSpawnAt: scheduleNextGolden(currentNow),
    });
  };

  const updateGoldenOrb = (now: number) => {
    const state = get();
    if (!state.golden.active || state.golden.toxic) return;
    if (now > state.golden.spawnedAt + state.golden.graceMs) {
      set({ golden: { ...state.golden, toxic: true } });
    }
  };

  return {
  phase: 'home',
  boardKind: 'normal',
  stats: defaultStats(),
  entryMode: null,
  bubbles: [],
  missions: [],
  boosterBank: initialBoosterBank(),
  unlocks: readUnlocks(),
  stormAt: BASE_STORM_INTERVAL_MS,
  stormInterval: BASE_STORM_INTERVAL_MS,
  stormDuration: BASE_STORM_DURATION_MS,
  maxBubbles: BASE_MAX_BUBBLES,
  maxStormOrbs: BASE_MAX_STORM_ORBS,
  bubbleSpeedFactor: BASE_SPEED_FACTOR,
  now: 0,
  rngSeed: hashString(`${Date.now()}`),
  rng: createRng(hashString(`${Date.now()}`)),
  width: 420,
  height: 680,
  comboWindowUntil: 0,
  slowTimeUntil: 0,
  target: { active: false, expiresAt: 0 },
  nextTargetAt: 10_000,
  targetCelebrationUntil: 0,
  perfectUntil: 0,
  startedAt: 0,
  dailyKey: '',
  dailyRunCount: 0,
  officialDailyEligible: false,
  dailyTuning: null,
  palette: DEFAULT_PALETTE,
  settings: readSettings(),
  lastRunOfficialDaily: false,
  survivalAccumulator: 0,
  currentStreak: 0,
  resumePhase: null,
  lastTapAt: 0,
  lastTapX: 0,
  lastTapY: 0,
  lastComboFrame: -Infinity,
  timeGainWindowStart: 0,
  timeGainAccumulated: 0,
  burst: defaultBurstState(),
  burstPointer: null,
  golden: defaultGoldenState(),
  nextGoldenSpawnAt: GOLDEN_RESPAWN_MIN_MS,
  startRun: (mode = 'trial') => {
    const state = get();
    const board = state.boardKind;
    const defaultSeed = hashString(`${Date.now()}-${Math.random()}`);
    let seed = defaultSeed;
    let palette = DEFAULT_PALETTE;
    let stormInterval = BASE_STORM_INTERVAL_MS;
    let stormDuration = BASE_STORM_DURATION_MS;
    let maxBubbles = BASE_MAX_BUBBLES;
    let maxStormOrbs = BASE_MAX_STORM_ORBS;
    let bubbleSpeedFactor = BASE_SPEED_FACTOR;
    let dailyKey = state.dailyKey;
    let dailyRunCount = state.dailyRunCount;
    let officialDailyEligible = false;
    let tuning: DailyTuning | null = state.dailyTuning;

    if (!dailyKey) {
      dailyKey = getDailyKeyUTC();
    }

    if (board === 'daily') {
      if (!tuning) {
        tuning = deriveDailyTuning(seedFromDailyKey(dailyKey));
      }
      seed = seedFromDailyKey(dailyKey);
      palette = tuning.colors.length > 0 ? tuning.colors : DEFAULT_PALETTE;
      stormInterval = tuning.stormEvery || BASE_STORM_INTERVAL_MS;
      stormDuration = tuning.stormDuration || BASE_STORM_DURATION_MS;
      maxBubbles = Math.max(24, Math.round(BASE_MAX_BUBBLES * tuning.spawn.density));
      maxStormOrbs = Math.max(6, Math.round(BASE_MAX_STORM_ORBS * tuning.spawn.density));
      bubbleSpeedFactor = tuning.spawn.speedFactor || BASE_SPEED_FACTOR;
      dailyRunCount = readDailyRunCount(dailyKey);
      officialDailyEligible = isDailyEligible(dailyRunCount);
    }

    const burstDefaults = defaultBurstState();
    burstDefaults.cooldownMs = state.burst.cooldownMs;
    burstDefaults.minHoldMs = state.burst.minHoldMs;
    burstDefaults.maxHoldMs = state.burst.maxHoldMs;
    const initialGoldenAt = GOLDEN_RESPAWN_MIN_MS + state.rng() * GOLDEN_RESPAWN_RANGE_MS;

    set({
      phase: 'intro',
      stats: { ...defaultStats(), timeLeft: 60, entryMode: mode },
      entryMode: mode,
      bubbles: [],
      stormAt: stormInterval,
      stormInterval,
      stormDuration,
      maxBubbles,
      maxStormOrbs,
      bubbleSpeedFactor,
      now: 0,
      rngSeed: seed,
      rng: createRng(seed),
      comboWindowUntil: 0,
      slowTimeUntil: 0,
      target: { active: false, expiresAt: 0 },
      nextTargetAt: 10_000,
      targetCelebrationUntil: 0,
      perfectUntil: 0,
      startedAt: performance.now(),
      survivalAccumulator: 0,
      currentStreak: 0,
      resumePhase: null,
      dailyKey,
      dailyRunCount,
      officialDailyEligible,
      dailyTuning: tuning,
      palette,
      lastRunOfficialDaily: false,
      lastTapAt: 0,
      lastTapX: 0,
      lastTapY: 0,
      lastComboFrame: -Infinity,
      timeGainWindowStart: 0,
      timeGainAccumulated: 0,
      burst: burstDefaults,
      burstPointer: null,
      golden: defaultGoldenState(),
      nextGoldenSpawnAt: initialGoldenAt,
    });
    get().spawnBubbles(Math.floor(maxBubbles / 2));
  },
  beginGameplay: () => {
    const state = get();
    if (state.phase !== 'intro') {
      return;
    }
    set({ phase: 'playing', startedAt: performance.now() });
  },
  endRun: () => {
    const state = get();
    if (state.boardKind === 'daily' && state.dailyKey) {
      const nextCount = state.dailyRunCount + 1;
      writeDailyRunCount(state.dailyKey, nextCount);
      set({
        phase: 'summary',
        resumePhase: null,
        dailyRunCount: nextCount,
        lastRunOfficialDaily: state.officialDailyEligible,
        officialDailyEligible: isDailyEligible(nextCount),
        target: { active: false, expiresAt: 0 },
        targetCelebrationUntil: 0,
        perfectUntil: 0,
      });
      return;
    }
    set({
      phase: 'summary',
      resumePhase: null,
      lastRunOfficialDaily: false,
      target: { active: false, expiresAt: 0 },
      targetCelebrationUntil: 0,
      perfectUntil: 0,
    });
  },
  resetToStart: () => {
    const state = get();
    let palette = DEFAULT_PALETTE;
    let stormInterval = BASE_STORM_INTERVAL_MS;
    let stormDuration = BASE_STORM_DURATION_MS;
    let maxBubbles = BASE_MAX_BUBBLES;
    let maxStormOrbs = BASE_MAX_STORM_ORBS;
    let bubbleSpeedFactor = BASE_SPEED_FACTOR;
    if (state.boardKind === 'daily') {
      const key = state.dailyKey || getDailyKeyUTC();
      const tuning = state.dailyTuning ?? deriveDailyTuning(seedFromDailyKey(key));
      palette = tuning.colors.length > 0 ? tuning.colors : DEFAULT_PALETTE;
      stormInterval = tuning.stormEvery || BASE_STORM_INTERVAL_MS;
      stormDuration = tuning.stormDuration || BASE_STORM_DURATION_MS;
      maxBubbles = Math.max(24, Math.round(BASE_MAX_BUBBLES * tuning.spawn.density));
      maxStormOrbs = Math.max(6, Math.round(BASE_MAX_STORM_ORBS * tuning.spawn.density));
      bubbleSpeedFactor = tuning.spawn.speedFactor || BASE_SPEED_FACTOR;
    }
    const initialGoldenAt = GOLDEN_RESPAWN_MIN_MS + state.rng() * GOLDEN_RESPAWN_RANGE_MS;
    set({
      phase: 'home',
      stats: defaultStats(),
      entryMode: null,
      bubbles: [],
      now: 0,
      comboWindowUntil: 0,
      slowTimeUntil: 0,
      target: { active: false, expiresAt: 0 },
      nextTargetAt: 10_000,
      targetCelebrationUntil: 0,
      perfectUntil: 0,
      survivalAccumulator: 0,
      currentStreak: 0,
      resumePhase: null,
      palette,
      stormInterval,
      stormDuration,
      maxBubbles,
      maxStormOrbs,
      bubbleSpeedFactor,
      stormAt: stormInterval,
      lastTapAt: 0,
      lastTapX: 0,
      lastTapY: 0,
      lastComboFrame: -Infinity,
      timeGainWindowStart: 0,
      timeGainAccumulated: 0,
      burst: { ...defaultBurstState(), cooldownMs: state.burst.cooldownMs, minHoldMs: state.burst.minHoldMs, maxHoldMs: state.burst.maxHoldMs },
      burstPointer: null,
      golden: defaultGoldenState(),
      nextGoldenSpawnAt: initialGoldenAt,
    });
  },
  pauseRun: () => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'storm') {
      return;
    }
    set({ phase: 'paused', resumePhase: state.phase });
  },
  resumeRun: () => {
    const state = get();
    if (state.phase !== 'paused') {
      return;
    }
    const target = state.resumePhase ?? 'playing';
    set({ phase: target, resumePhase: null });
  },
  pause: () => {
    get().pauseRun();
  },
  resume: () => {
    get().resumeRun();
  },
  setPhase: (phase) => {
    set({ phase });
  },
  tick: (dt) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'storm') {
      return;
    }
    const clampedDt = Math.min(Math.max(dt, 0), 48);
    const now = state.now + clampedDt;
    let phase: GamePhase = state.phase;
    const slowTimeActive = now < state.slowTimeUntil;
    const factor = slowTimeActive ? 0.5 : 1;
    const width = state.width;
    const height = state.height;
    let targetState = state.target;
    let nextTargetAt = state.nextTargetAt;
    let celebrationUntil = state.targetCelebrationUntil;
    const perfectUntil = state.perfectUntil;

    updateGoldenOrb(now);
    spawnGoldenOrb(now);

    if (targetState.active && now >= targetState.expiresAt) {
      targetState = { ...targetState, active: false, expiresAt: 0 };
    }

    if (!targetState.active && now >= nextTargetAt) {
      const color = randomColor(state.rng, state.palette);
      targetState = { color, active: true, expiresAt: now + 3_000 };
      nextTargetAt = now + 9_000 + state.rng() * 3_000;
    }

    const updatedBubbles: Bubble[] = [];
    for (const bubble of state.bubbles) {
      const nextX = bubble.x + bubble.vx * (clampedDt / 1000) * factor;
      const nextY = bubble.y + bubble.vy * (clampedDt / 1000) * factor;
      if (nextY < -bubble.r * 1.2) {
        continue;
      }
      let clampedX = nextX;
      if (clampedX < bubble.r) clampedX = bubble.r;
      if (clampedX > width - bubble.r) clampedX = width - bubble.r;
      const clampedY = Math.min(nextY, height + bubble.r * 2);
      updatedBubbles.push({ ...bubble, x: clampedX, y: clampedY });
    }

    const stats = { ...state.stats };
    if (stats.timeLeft > 0) {
      stats.timeLeft = Math.max(0, stats.timeLeft - clampedDt / 1000);
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

    if (phase === 'storm' && now >= state.stormAt + state.stormDuration) {
      phase = 'playing';
      set({ stormAt: now + state.stormInterval });
    }

    if (phase === 'summary' && (targetState.active || targetState.expiresAt !== 0 || targetState.color)) {
      targetState = { active: false, expiresAt: 0 };
      celebrationUntil = Math.min(celebrationUntil, now);
    }

    set({
      bubbles: updatedBubbles,
      stats,
      now,
      phase,
      target: targetState,
      nextTargetAt,
      targetCelebrationUntil: celebrationUntil,
      perfectUntil,
    });

    const desiredCount = phase === 'storm' ? state.maxBubbles + state.maxStormOrbs : state.maxBubbles;
    if (updatedBubbles.length < desiredCount) {
      get().spawnBubbles(desiredCount - updatedBubbles.length);
    }
  },
  spawnBubbles: (count = 1) => {
    const state = get();
    if (state.phase === 'summary') return;
    const { rng, width, height, now, palette, bubbleSpeedFactor, maxBubbles, maxStormOrbs } = state;
    const next: Bubble[] = [];
    for (let index = 0; index < count; index += 1) {
      next.push(createBubble(rng, width, height, now, palette, bubbleSpeedFactor));
    }
    set({ bubbles: [...state.bubbles, ...next].slice(0, maxBubbles + maxStormOrbs) });
  },
  spawnStormOrbs: () => {
    const state = get();
    if (state.phase !== 'storm') return;
    const { rng, width, height, now, bubbleSpeedFactor, maxBubbles, maxStormOrbs, palette } = state;
    const payload: Bubble[] = [];
    const energyCount = 3 + Math.floor(rng() * 3);
    const drainCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < energyCount; i += 1) {
      payload.push(createBubble(rng, width, height, now, palette, bubbleSpeedFactor, { storm: true, energy: true }));
    }
    for (let i = 0; i < drainCount; i += 1) {
      payload.push(createBubble(rng, width, height, now, palette, bubbleSpeedFactor, { storm: true, poison: true }));
    }
    set({ bubbles: [...state.bubbles, ...payload].slice(0, maxBubbles + maxStormOrbs) });
  },
  beginBurstCharge: (x, y) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'storm') {
      return false;
    }
    const now = Date.now();
    if (now < state.burst.readyAt) {
      return false;
    }
    let overcharge = state.burst.overcharge;
    if (overcharge && state.boosterBank.freeOrbs <= 0) {
      overcharge = false;
    }
    set({
      burst: { ...state.burst, charging: true, chargeStartAt: now, overcharge },
      burstPointer: { x, y },
    });
    return true;
  },
  cancelBurstCharge: () => {
    const state = get();
    if (!state.burst.charging) return;
    set({ burst: { ...state.burst, charging: false, chargeStartAt: 0 }, burstPointer: null });
  },
  updateBurstPointer: (x, y) => {
    const state = get();
    if (!state.burst.charging) return;
    set({ burstPointer: { x, y } });
  },
  toggleBurstOvercharge: () => {
    const state = get();
    if (!state.burst.overcharge && state.boosterBank.freeOrbs <= 0) {
      return;
    }
    set({ burst: { ...state.burst, overcharge: !state.burst.overcharge } });
  },
  fireBurst: (x, y, holdMs) => {
    const state = get();
    const burstState = state.burst;
    const nowReal = Date.now();
    const clampedHold = Math.min(Math.max(holdMs, 0), burstState.maxHoldMs);
    if (!burstState.charging || nowReal < burstState.readyAt || clampedHold < burstState.minHoldMs) {
      set({ burst: { ...burstState, charging: false }, burstPointer: null });
      return { hit: false, burst: true };
    }

    let radius = Math.max(BURST_BASE_RADIUS * (clampedHold / burstState.maxHoldMs), 80);
    const bankBefore = state.boosterBank;
    let consumedOrb = false;
    if (burstState.overcharge && bankBefore.freeOrbs > 0) {
      radius *= BURST_OVERCHARGE_MULTIPLIER;
      consumedOrb = true;
    }

    const poppedIds: string[] = [];
    const colors = new Set<BubbleColor>();
    const radiusSq = radius * radius;
    for (const bubble of state.bubbles) {
      const dx = bubble.x - x;
      const dy = bubble.y - y;
      if (dx * dx + dy * dy <= radiusSq) {
        poppedIds.push(bubble.id);
      }
    }

    let goldenHit = false;
    let goldenToxic = false;
    const golden = state.golden;
    if (golden.active) {
      const dx = golden.x - x;
      const dy = golden.y - y;
      const effective = radius + golden.r;
      if (dx * dx + dy * dy <= effective * effective) {
        const result = hitGoldenOrb('burst', { x, y });
        if (result.hit) {
          goldenHit = true;
          goldenToxic = result.toxic;
        }
      }
    }

    poppedIds.sort((a, b) => {
      const bubbleA = state.bubbles.find((bubble) => bubble.id === a);
      const bubbleB = state.bubbles.find((bubble) => bubble.id === b);
      if (!bubbleA || !bubbleB) return 0;
      const distA = (bubbleA.x - x) * (bubbleA.x - x) + (bubbleA.y - y) * (bubbleA.y - y);
      const distB = (bubbleB.x - x) * (bubbleB.x - x) + (bubbleB.y - y) * (bubbleB.y - y);
      return distA - distB;
    });

    for (const id of poppedIds) {
      const current = get();
      const bubble = current.bubbles.find((item) => item.id === id);
      if (!bubble) continue;
      const firstColor = !colors.has(bubble.color);
      if (firstColor) {
        colors.add(bubble.color);
      }
      applyBubbleHit(id, x, y, {
        scoreMultiplier: BURST_SCORE_MULTIPLIER,
        timeMultiplier: BURST_SCORE_MULTIPLIER,
        comboContribution: firstColor,
        allowPerfect: false,
        source: 'burst',
      });
    }

    const nextBurst: BurstState = {
      ...burstState,
      charging: false,
      chargeStartAt: 0,
      lastUseAt: nowReal,
      readyAt: nowReal + burstState.cooldownMs,
      overcharge: false,
    };

    const patch: Partial<GameStore> = {
      burst: nextBurst,
      burstPointer: null,
    };

    if (consumedOrb) {
      const updatedBank: BoosterBank = {
        freeOrbs: Math.max(0, bankBefore.freeOrbs - 1),
        lastDailyKey: bankBefore.lastDailyKey,
      };
      persistBooster(updatedBank);
      patch.boosterBank = updatedBank;
    }

    set(patch);

    const nextState = get();
    return {
      hit: poppedIds.length > 0 || goldenHit,
      burst: true,
      poppedIds,
      radius,
      golden: goldenHit,
      goldenToxic,
      combo: nextState.stats.chainLen,
    };
  },
  tap: (x, y, options) => {
    const state = get();
    const now = state.now;
    if (now - state.lastTapAt < 10 && Math.abs(x - state.lastTapX) < 6 && Math.abs(y - state.lastTapY) < 6) {
      return { hit: false };
    }

    const golden = state.golden;
    if (golden.active) {
      const dx = x - golden.x;
      const dy = y - golden.y;
      if (dx * dx + dy * dy <= golden.r * golden.r) {
        const result = hitGoldenOrb('tap', { x, y });
        if (result.hit) {
          const nextState = get();
          return {
            hit: true,
            golden: true,
            goldenToxic: result.toxic,
            combo: nextState.stats.chainLen,
          };
        }
      }
    }

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
      set({
        stats,
        comboWindowUntil: 0,
        currentStreak: 0,
        lastTapAt: now,
        lastTapX: x,
        lastTapY: y,
      });
      return { hit: false };
    }

    const target = state.bubbles[hitIndex];
    return applyBubbleHit(target.id, x, y, { ...options, source: options?.source ?? 'tap' });
  },
  grantBooster: (count, source = 'other') => {
    if (count <= 0) return;
    const state = get();
    const bank: BoosterBank = {
      freeOrbs: state.boosterBank.freeOrbs + count,
      lastDailyKey: state.boosterBank.lastDailyKey,
    };
    persistBooster(bank);
    let statsPatch: RunStats | null = null;
    if (source === 'energy') {
      statsPatch = { ...state.stats, energyOrbsCollected: state.stats.energyOrbsCollected + count };
    } else if (source === 'paid') {
      statsPatch = { ...state.stats, paidEntryOrbs: state.stats.paidEntryOrbs + count };
    }
    if (statsPatch) {
      set({ boosterBank: bank, stats: statsPatch });
    } else {
      set({ boosterBank: bank });
    }
  },
  grantOrbOnPaidEntry: () => {
    get().grantBooster(1, 'paid');
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
    const key = getDailyKeyUTC();
    let missions = readPersistedMissions(key);
    if (!missions) {
      missions = generateDailyMissions(seed, key);
      persistMissions(key, missions);
    }
    const computedSeed =
      typeof seed === 'number'
        ? seed
        : typeof seed === 'string'
        ? seedFromDailyKey(seed)
        : seedFromDailyKey(key);
    const tuning = deriveDailyTuning(computedSeed);
    const runCount = readDailyRunCount(key);
    const patch: Partial<GameStore> = {
      missions,
      dailyKey: key,
      dailyRunCount: runCount,
      dailyTuning: tuning,
    };
    if (get().boardKind === 'daily') {
      patch.palette = tuning.colors.length > 0 ? tuning.colors : DEFAULT_PALETTE;
      patch.stormInterval = tuning.stormEvery || BASE_STORM_INTERVAL_MS;
      patch.stormDuration = tuning.stormDuration || BASE_STORM_DURATION_MS;
      patch.maxBubbles = Math.max(24, Math.round(BASE_MAX_BUBBLES * tuning.spawn.density));
      patch.maxStormOrbs = Math.max(6, Math.round(BASE_MAX_STORM_ORBS * tuning.spawn.density));
      patch.bubbleSpeedFactor = tuning.spawn.speedFactor || BASE_SPEED_FACTOR;
      patch.stormAt = patch.stormInterval;
      patch.officialDailyEligible = isDailyEligible(runCount);
    }
    set(patch);
    const bank = get().boosterBank;
    if (bank.lastDailyKey !== key) {
      const refreshed = { ...bank, freeOrbs: bank.freeOrbs, lastDailyKey: key };
      persistBooster(refreshed);
      set({ boosterBank: refreshed });
    }
  },
  setBoardKind: (board) => {
    const state = get();
    if (state.boardKind === board) {
      return;
    }
    let palette = DEFAULT_PALETTE;
    let stormInterval = BASE_STORM_INTERVAL_MS;
    let stormDuration = BASE_STORM_DURATION_MS;
    let maxBubbles = BASE_MAX_BUBBLES;
    let maxStormOrbs = BASE_MAX_STORM_ORBS;
    let bubbleSpeedFactor = BASE_SPEED_FACTOR;
    let officialDailyEligible = false;
    let dailyRunCount = state.dailyRunCount;
    if (board === 'daily') {
      const key = state.dailyKey || getDailyKeyUTC();
      const tuning = state.dailyTuning ?? deriveDailyTuning(seedFromDailyKey(key));
      palette = tuning.colors.length > 0 ? tuning.colors : DEFAULT_PALETTE;
      stormInterval = tuning.stormEvery || BASE_STORM_INTERVAL_MS;
      stormDuration = tuning.stormDuration || BASE_STORM_DURATION_MS;
      maxBubbles = Math.max(24, Math.round(BASE_MAX_BUBBLES * tuning.spawn.density));
      maxStormOrbs = Math.max(6, Math.round(BASE_MAX_STORM_ORBS * tuning.spawn.density));
      bubbleSpeedFactor = tuning.spawn.speedFactor || BASE_SPEED_FACTOR;
      dailyRunCount = readDailyRunCount(key);
      officialDailyEligible = isDailyEligible(dailyRunCount);
    }
    set({
      boardKind: board,
      palette,
      stormInterval,
      stormDuration,
      maxBubbles,
      maxStormOrbs,
      bubbleSpeedFactor,
      stormAt: stormInterval,
      officialDailyEligible: board === 'daily' ? officialDailyEligible : false,
      dailyRunCount,
    });
  },
  setSettings: (patch) => {
    set((state) => {
      const next: GameSettings = {
        haptics: patch.haptics ?? state.settings.haptics,
        reducedMotion: patch.reducedMotion ?? state.settings.reducedMotion,
        sound: patch.sound ?? state.settings.sound,
        leftHanded: patch.leftHanded ?? state.settings.leftHanded,
        theme: patch.theme ?? state.settings.theme,
        particleStyle: patch.particleStyle ?? state.settings.particleStyle,
      };
      persistSettings(next);
      return { settings: next };
    });
  },
  unlockFeature: (key) => {
    set((state) => {
      if (state.unlocks[key]) {
        return {};
      }
      const next = { ...state.unlocks, [key]: true } as GameUnlocks;
      persistUnlocks(next);
      return { unlocks: next };
    });
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
    get().grantBooster(claimedMission.rewardOrbs, 'mission');
    }
    if (missions.every((mission) => mission.claimed)) {
      if (typeof window !== 'undefined') {
        const bonusKey = bonusStorageKey(state.dailyKey);
        if (!window.localStorage.getItem(bonusKey)) {
          get().grantBooster(1, 'mission');
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
  spawnGoldenOrb,
  updateGoldenOrb,
  hitGoldenOrb,
};
});
