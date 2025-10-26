'use client';

import { create } from 'zustand';
import { persistMissions, readPersistedMissions, generateDailyMissions, bonusStorageKey } from '@/lib/missions';
import { deriveDailyTuning, getDailyKeyUTC, isDailyEligible, seedFromDailyKey, type DailyTuning } from '@/lib/daily';
import type {
  BoardKind,
  Bubble,
  BoosterBank,
  BubbleColor,
  EntryMode,
  GamePhase,
  GameSettings,
  Mission,
  TargetState,
  RunStats,
  BurstState,
  GoldenOrbState,
} from '@/types/game';

const COMBO_WINDOW_MS = 5_000;
const BASE_POINTS = 10;
const BASE_TIME_REWARD = 0.5;
const WRONG_TAP_PENALTY = 3;
const DRAIN_PENALTY_TIME = 2;
const DRAIN_PENALTY_SCORE = 15;
const ENERGY_POINTS = 20;
const SLOW_TIME_DURATION_MS = 5_000;
const BURST_MAX_RADIUS = 240;
const BURST_MIN_RADIUS_RATIO = 0.35;
const BURST_OVERCHARGE_MULTIPLIER = 1.3;
const BURST_SCORE_SCALE = 0.7;
const GOLDEN_MIN_INTERVAL_MS = 20_000;
const GOLDEN_MAX_INTERVAL_MS = 30_000;

const BOOSTER_KEY = 'rubble:booster-bank';
const SETTINGS_KEY = 'rubble_settings_v1';
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
    sfx: true,
    leftHanded: false,
  };
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
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const defaults = settingsDefaults();
    return {
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : defaults.haptics,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaults.reducedMotion,
      sfx: typeof parsed.sfx === 'boolean' ? parsed.sfx : defaults.sfx,
      leftHanded: typeof parsed.leftHanded === 'boolean' ? parsed.leftHanded : defaults.leftHanded,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function spawnGoldenOrbState(
  rng: () => number,
  width: number,
  height: number,
  now: number,
  previous: GoldenOrbState
): GoldenOrbState {
  const radius = previous.r;
  const padding = Math.max(radius + 28, Math.min(width, height) * 0.1);
  const spanX = Math.max(width - padding * 2, radius * 2);
  const spanY = Math.max(height - padding * 2, radius * 2);
  const x = clamp(padding + rng() * spanX, radius, width - radius);
  const y = clamp(padding + rng() * spanY, radius, height - radius);
  return {
    active: true,
    id: `golden-${now.toFixed(0)}-${Math.floor(rng() * 10_000)}`,
    spawnedAt: now,
    graceMs: previous.graceMs,
    x,
    y,
    r: radius,
    toxic: false,
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
  boardKind: BoardKind;
  stats: RunStats;
  entryMode: EntryMode | null;
  bubbles: Bubble[];
  missions: Mission[];
  boosterBank: BoosterBank;
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
  golden: GoldenOrbState;
  lastGoldenSpawnAt: number;
  nextGoldenDelay: number;
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
  tap: (
    x: number,
    y: number
  ) => {
    hit: boolean;
    energy?: boolean;
    drain?: boolean;
    combo?: number;
    perfect?: boolean;
    targetHit?: boolean;
    radius?: number;
    color?: BubbleColor;
    golden?: boolean;
    toxic?: boolean;
    burst?: boolean;
    timeDelta?: number;
    scoreDelta?: number;
  };
  grantBooster: (count: number, source?: 'energy' | 'paid' | 'mission' | 'other') => void;
  grantOrbOnPaidEntry: () => void;
  consumeBooster: () => boolean;
  loadDaily: (seed?: string | number) => void;
  setBoardKind: (board: BoardKind) => void;
  setSettings: (patch: Partial<GameSettings>) => void;
  setStageSize: (width: number, height: number) => void;
  claimMission: (id: string) => void;
  progressColor: (color: BubbleColor) => void;
  progressCombo: (combo: number) => void;
  progressSurvival: (seconds: number) => void;
  activateSlowTime: (durationMs: number) => void;
  beginBurstCharge: (x: number, y: number) => void;
  cancelBurstCharge: () => void;
  fireBurst: (
    x: number,
    y: number
  ) => {
    fired: boolean;
    radius: number;
    holdMs: number;
    popped: string[];
    energyHits: number;
    drainHits: number;
    targetHit: boolean;
    overcharged: boolean;
    scoreGain: number;
    timeDelta: number;
  };
  toggleBurstOvercharge: () => void;
  spawnGoldenOrb: () => void;
  updateGoldenOrb: (now?: number) => void;
  hitGoldenOrb: (
    x: number,
    y: number
  ) => {
    hit: boolean;
    golden?: boolean;
    toxic?: boolean;
    scoreDelta?: number;
    timeDelta?: number;
  };
};

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'home',
  boardKind: 'normal',
  stats: defaultStats(),
  entryMode: null,
  bubbles: [],
  missions: [],
  boosterBank: initialBoosterBank(),
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
  burst: {
    readyAt: 0,
    charging: false,
    chargeStartAt: 0,
    lastUseAt: 0,
    cooldownMs: 12_000,
    minHoldMs: 600,
    maxHoldMs: 1_500,
    overcharge: false,
  },
  golden: {
    active: false,
    spawnedAt: 0,
    graceMs: 1_500,
    x: 0,
    y: 0,
    r: 22,
    toxic: false,
  },
  lastGoldenSpawnAt: 0,
  nextGoldenDelay: GOLDEN_MIN_INTERVAL_MS,
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

    const nextGoldenDelay = GOLDEN_MIN_INTERVAL_MS + Math.random() * (GOLDEN_MAX_INTERVAL_MS - GOLDEN_MIN_INTERVAL_MS);

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
      burst: {
        ...state.burst,
        readyAt: 0,
        charging: false,
        chargeStartAt: 0,
        lastUseAt: 0,
        overcharge: false,
      },
      golden: {
        ...state.golden,
        active: false,
        spawnedAt: 0,
        toxic: false,
        x: 0,
        y: 0,
      },
      lastGoldenSpawnAt: 0,
      nextGoldenDelay,
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
      burst: {
        ...state.burst,
        readyAt: 0,
        charging: false,
        chargeStartAt: 0,
        lastUseAt: 0,
        overcharge: false,
      },
      golden: {
        ...state.golden,
        active: false,
        spawnedAt: 0,
        toxic: false,
        x: 0,
        y: 0,
      },
      lastGoldenSpawnAt: 0,
      nextGoldenDelay: GOLDEN_MIN_INTERVAL_MS + Math.random() * (GOLDEN_MAX_INTERVAL_MS - GOLDEN_MIN_INTERVAL_MS),
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
    let burstState = state.burst;
    let goldenState = state.golden;
    let lastGoldenSpawnAt = state.lastGoldenSpawnAt;
    let nextGoldenDelay = state.nextGoldenDelay;

    if (targetState.active && now >= targetState.expiresAt) {
      targetState = { ...targetState, active: false, expiresAt: 0 };
    }

    if (!targetState.active && now >= nextTargetAt) {
      const color = randomColor(state.rng, state.palette);
      targetState = { color, active: true, expiresAt: now + 3_000 };
      nextTargetAt = now + 9_000 + state.rng() * 3_000;
    }

    if (goldenState.active) {
      if (!goldenState.toxic && now >= goldenState.spawnedAt + goldenState.graceMs) {
        goldenState = { ...goldenState, toxic: true };
      }
    } else if (
      now - lastGoldenSpawnAt >= nextGoldenDelay &&
      width > 0 &&
      height > 0
    ) {
      goldenState = spawnGoldenOrbState(state.rng, width, height, now, goldenState);
      lastGoldenSpawnAt = now;
      nextGoldenDelay = GOLDEN_MIN_INTERVAL_MS + state.rng() * (GOLDEN_MAX_INTERVAL_MS - GOLDEN_MIN_INTERVAL_MS);
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

    if (phase === 'summary' && goldenState.active) {
      goldenState = { ...goldenState, active: false, toxic: false };
    }

    if (burstState.charging && phase !== 'playing' && phase !== 'storm') {
      burstState = { ...burstState, charging: false, chargeStartAt: 0 };
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
      golden: goldenState,
      lastGoldenSpawnAt,
      nextGoldenDelay,
      burst: burstState,
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
  tap: (x, y) => {
    const state = get();
    const now = state.now;
    if (state.golden.active) {
      const dxGolden = x - state.golden.x;
      const dyGolden = y - state.golden.y;
      if (dxGolden * dxGolden + dyGolden * dyGolden <= state.golden.r * state.golden.r) {
        return get().hitGoldenOrb(x, y);
      }
    }
    let targetState = state.target;
    let nextTargetAt = state.nextTargetAt;
    let celebrationUntil = state.targetCelebrationUntil;
    let perfectUntil = state.perfectUntil;
    if (now - state.lastTapAt < 10 && Math.abs(x - state.lastTapX) < 6 && Math.abs(y - state.lastTapY) < 6) {
      return { hit: false };
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
    const distance = Math.hypot(x - target.x, y - target.y);
    const perfectThreshold = target.r * 0.35;
    const activeTarget = Boolean(targetState.active && targetState.color && now <= targetState.expiresAt);
    const matchesTarget = activeTarget && !isDrainOrb(target) && targetState.color === target.color;
    const perfectCandidate = !isDrainOrb(target) && distance <= perfectThreshold;
    const remaining = [...state.bubbles.slice(0, hitIndex), ...state.bubbles.slice(hitIndex + 1)];
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

    if (now - timeGainWindowStart >= 1000) {
      timeGainWindowStart = now;
      timeGainAccumulated = 0;
    }

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
      const sameColor = stats.lastColor === target.color && now <= state.comboWindowUntil;
      const chainLen = sameColor ? stats.chainLen + 1 : 1;
      stats.chainLen = chainLen;
      stats.lastColor = target.color;
      const baseWindow = now + COMBO_WINDOW_MS;
      comboWindowUntil = baseWindow;

      if (isEnergyOrb(target)) {
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
        const awarded = matchesTarget ? baseAward * 3 : baseAward;
        stats.score += awarded;
        const availableGain = Math.max(0, 1 - timeGainAccumulated);
        const appliedGain = Math.min(BASE_TIME_REWARD, availableGain);
        stats.timeLeft += appliedGain;
        timeGainAccumulated += appliedGain;
        if (matchesTarget) {
          stats.timeLeft += 2;
          targetHit = true;
          celebrationUntil = Math.max(celebrationUntil, now + 1_500);
          nextTargetAt = now + 9_000 + state.rng() * 3_000;
          targetState = { active: false, expiresAt: 0 };
        }
        if (chainLen >= 3 && now - lastComboFrame > 16) {
          stats.bestCombo = Math.max(stats.bestCombo, chainLen);
          get().progressCombo(chainLen);
          lastComboFrame = now;
        }
        get().progressColor(target.color);
      }

      if (perfectCandidate) {
        perfect = true;
        const extendedWindow = Math.min(Math.max(baseWindow, state.comboWindowUntil) + 1_000, now + COMBO_WINDOW_MS + 1_000);
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
      combo: stats.chainLen,
      perfect,
      targetHit,
      radius: target.r,
      color: target.color,
    };
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
  beginBurstCharge: (_x, _y) => {
    const state = get();
    if (state.burst.charging) return;
    if (state.phase !== 'playing' && state.phase !== 'storm') {
      return;
    }
    if (state.now < state.burst.readyAt) {
      return;
    }
    set({ burst: { ...state.burst, charging: true, chargeStartAt: state.now } });
  },
  cancelBurstCharge: () => {
    const state = get();
    if (!state.burst.charging) return;
    set({ burst: { ...state.burst, charging: false, chargeStartAt: 0 } });
  },
  fireBurst: (x, y) => {
    const state = get();
    const burst = state.burst;
    const now = state.now;
    if (!burst.charging) {
      return {
        fired: false,
        radius: 0,
        holdMs: 0,
        popped: [],
        energyHits: 0,
        drainHits: 0,
        targetHit: false,
        overcharged: false,
        scoreGain: 0,
        timeDelta: 0,
      };
    }
    const holdMs = Math.max(0, now - burst.chargeStartAt);
    if (holdMs < burst.minHoldMs || now < burst.readyAt) {
      set({ burst: { ...burst, charging: false, chargeStartAt: 0 } });
      return {
        fired: false,
        radius: 0,
        holdMs,
        popped: [],
        energyHits: 0,
        drainHits: 0,
        targetHit: false,
        overcharged: false,
        scoreGain: 0,
        timeDelta: 0,
      };
    }

    const ratio = clamp(holdMs / burst.maxHoldMs, BURST_MIN_RADIUS_RATIO, 1);
    const baseRadius = BURST_MAX_RADIUS * ratio;
    const overchargeReady = burst.overcharge && state.boosterBank.freeOrbs > 0;
    const radius = overchargeReady ? baseRadius * BURST_OVERCHARGE_MULTIPLIER : baseRadius;

    const popped: Bubble[] = [];
    const survivors: Bubble[] = [];
    const colorOrder: BubbleColor[] = [];
    const colorGroups = new Map<BubbleColor, Bubble[]>();
    let drainHits = 0;

    for (const bubble of state.bubbles) {
      const dx = bubble.x - x;
      const dy = bubble.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        popped.push(bubble);
        if (!isDrainOrb(bubble)) {
          if (!colorGroups.has(bubble.color)) {
            colorGroups.set(bubble.color, []);
            colorOrder.push(bubble.color);
          }
          colorGroups.get(bubble.color)!.push(bubble);
        } else {
          drainHits += 1;
        }
      } else {
        survivors.push(bubble);
      }
    }

    const poppedIds = popped.map((bubble) => bubble.id);
    const consumedOvercharge = overchargeReady && popped.length > 0;
    let boosterBank = state.boosterBank;
    if (consumedOvercharge) {
      boosterBank = { ...boosterBank, freeOrbs: Math.max(0, boosterBank.freeOrbs - 1) };
      persistBooster(boosterBank);
    }

    const stats: RunStats = { ...state.stats };
    let comboWindowUntil = state.comboWindowUntil;
    let currentStreak = state.currentStreak;
    let lastComboFrame = state.lastComboFrame;
    let timeGainWindowStart = state.timeGainWindowStart;
    let timeGainAccumulated = state.timeGainAccumulated;
    let targetState = state.target;
    let nextTargetAt = state.nextTargetAt;
    let celebrationUntil = state.targetCelebrationUntil;
    const perfectUntil = state.perfectUntil;
    let targetHit = false;
    let scoreGain = 0;
    let timeDelta = 0;

    if (now - timeGainWindowStart >= 1000) {
      timeGainWindowStart = now;
      timeGainAccumulated = 0;
    }

    const activeTarget = Boolean(targetState.active && targetState.color && now <= targetState.expiresAt);

    const drainBubbles = popped.filter((bubble) => isDrainOrb(bubble));
    for (const _drain of drainBubbles) {
      const prevTime = stats.timeLeft;
      stats.timeLeft = Math.max(0, stats.timeLeft - DRAIN_PENALTY_TIME);
      timeDelta += stats.timeLeft - prevTime;
      const prevScore = stats.score;
      stats.score = Math.max(0, stats.score - DRAIN_PENALTY_SCORE);
      scoreGain += stats.score - prevScore;
      stats.streak = Math.max(stats.streak, currentStreak);
      currentStreak = 0;
      stats.chainLen = 0;
      stats.lastColor = undefined;
      comboWindowUntil = 0;
    }

    let energyHits = 0;
    let mutableActiveTarget = activeTarget;

    for (const color of colorOrder) {
      const group = colorGroups.get(color)!;
      const sameColor = stats.lastColor === color && now <= comboWindowUntil;
      const chainLen = sameColor ? stats.chainLen + 1 : 1;
      stats.chainLen = chainLen;
      stats.lastColor = color;
      const baseWindow = now + COMBO_WINDOW_MS;
      comboWindowUntil = baseWindow;

      for (const bubble of group) {
        const energy = isEnergyOrb(bubble);
        const matchesTarget = mutableActiveTarget && targetState.color === color && !targetHit;
        if (energy) {
          let awarded = ENERGY_POINTS;
          if (matchesTarget) {
            awarded *= 3;
          }
          const scaled = Math.round(awarded * BURST_SCORE_SCALE);
          stats.score += scaled;
          scoreGain += scaled;
          if (matchesTarget) {
            const prevTime = stats.timeLeft;
            stats.timeLeft += 2;
            timeDelta += stats.timeLeft - prevTime;
            targetHit = true;
            mutableActiveTarget = false;
            celebrationUntil = Math.max(celebrationUntil, now + 1_500);
            nextTargetAt = now + 9_000 + state.rng() * 3_000;
            targetState = { active: false, expiresAt: 0 };
          }
          energyHits += 1;
        } else {
          const multiplier = Math.min(1 + 0.25 * Math.max(chainLen - 2, 0), 4);
          const baseAward = Math.round(BASE_POINTS * multiplier);
          const awarded = matchesTarget ? baseAward * 3 : baseAward;
          const scaled = Math.round(awarded * BURST_SCORE_SCALE);
          stats.score += scaled;
          scoreGain += scaled;
          const availableGain = Math.max(0, 1 - timeGainAccumulated);
          const appliedGain = Math.min(BASE_TIME_REWARD, availableGain);
          if (appliedGain > 0) {
            stats.timeLeft += appliedGain;
            timeGainAccumulated += appliedGain;
            timeDelta += appliedGain;
          }
          if (matchesTarget) {
            const prevTime = stats.timeLeft;
            stats.timeLeft += 2;
            timeDelta += stats.timeLeft - prevTime;
            targetHit = true;
            mutableActiveTarget = false;
            celebrationUntil = Math.max(celebrationUntil, now + 1_500);
            nextTargetAt = now + 9_000 + state.rng() * 3_000;
            targetState = { active: false, expiresAt: 0 };
          }
        }
        currentStreak += 1;
        stats.streak = Math.max(stats.streak, currentStreak);
      }

      if (chainLen >= 3 && now - lastComboFrame > 16) {
        stats.bestCombo = Math.max(stats.bestCombo, chainLen);
        get().progressCombo(chainLen);
        lastComboFrame = now;
      }
      get().progressColor(color);
    }

    stats.timeLeft = Math.max(0, stats.timeLeft);

    set({
      stats,
      bubbles: survivors,
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
      burst: {
        ...burst,
        charging: false,
        chargeStartAt: 0,
        lastUseAt: now,
        readyAt: now + burst.cooldownMs,
        overcharge: false,
      },
      boosterBank,
    });

    if (energyHits > 0) {
      get().grantBooster(energyHits, 'energy');
    }

    return {
      fired: true,
      radius,
      holdMs,
      popped: poppedIds,
      energyHits,
      drainHits,
      targetHit,
      overcharged: consumedOvercharge,
      scoreGain,
      timeDelta,
    };
  },
  toggleBurstOvercharge: () => {
    const state = get();
    if (state.boosterBank.freeOrbs <= 0) {
      if (state.burst.overcharge) {
        set({ burst: { ...state.burst, overcharge: false } });
      }
      return;
    }
    set({ burst: { ...state.burst, overcharge: !state.burst.overcharge } });
  },
  spawnGoldenOrb: () => {
    const state = get();
    if (state.width <= 0 || state.height <= 0) return;
    const now = state.now;
    const next = spawnGoldenOrbState(state.rng, state.width, state.height, now, state.golden);
    set({
      golden: next,
      lastGoldenSpawnAt: now,
      nextGoldenDelay: GOLDEN_MIN_INTERVAL_MS + state.rng() * (GOLDEN_MAX_INTERVAL_MS - GOLDEN_MIN_INTERVAL_MS),
    });
  },
  updateGoldenOrb: (nowInput) => {
    const state = get();
    if (!state.golden.active || state.golden.toxic) {
      return;
    }
    const now = nowInput ?? state.now;
    if (now >= state.golden.spawnedAt + state.golden.graceMs) {
      set({ golden: { ...state.golden, toxic: true } });
    }
  },
  hitGoldenOrb: (x, y) => {
    const state = get();
    if (!state.golden.active) {
      return { hit: false };
    }
    const dx = x - state.golden.x;
    const dy = y - state.golden.y;
    if (dx * dx + dy * dy > state.golden.r * state.golden.r) {
      return { hit: false };
    }
    const now = state.now;
    const golden = state.golden;
    const stats: RunStats = { ...state.stats };
    let comboWindowUntil = state.comboWindowUntil;
    let currentStreak = state.currentStreak;
    const timeGainWindowStart = state.timeGainWindowStart;
    const timeGainAccumulated = state.timeGainAccumulated;
    const targetState = state.target;
    const nextTargetAt = state.nextTargetAt;
    const celebrationUntil = state.targetCelebrationUntil;
    const perfectUntil = state.perfectUntil;
    const prevScore = stats.score;
    const prevTime = stats.timeLeft;

    if (!golden.toxic) {
      const awarded = BASE_POINTS * 5;
      stats.score += awarded;
      stats.timeLeft += 3;
      currentStreak += 1;
      stats.streak = Math.max(stats.streak, currentStreak);
    } else {
      stats.streak = Math.max(stats.streak, currentStreak);
      currentStreak = 0;
      stats.chainLen = 0;
      stats.lastColor = undefined;
      comboWindowUntil = 0;
      stats.timeLeft = Math.max(0, stats.timeLeft - 5);
      stats.score = Math.max(0, stats.score - DRAIN_PENALTY_SCORE);
    }

    stats.timeLeft = Math.max(0, stats.timeLeft);

    const scoreDelta = stats.score - prevScore;
    const timeDelta = stats.timeLeft - prevTime;

    const nextGoldenDelay = GOLDEN_MIN_INTERVAL_MS + state.rng() * (GOLDEN_MAX_INTERVAL_MS - GOLDEN_MIN_INTERVAL_MS);

    set({
      stats,
      golden: { ...golden, active: false, toxic: false, spawnedAt: 0 },
      lastGoldenSpawnAt: now,
      nextGoldenDelay,
      comboWindowUntil,
      currentStreak,
      lastTapAt: now,
      lastTapX: x,
      lastTapY: y,
      timeGainWindowStart,
      timeGainAccumulated,
      target: targetState,
      nextTargetAt,
      targetCelebrationUntil: celebrationUntil,
      perfectUntil,
    });

    return { hit: true, golden: true, toxic: golden.toxic, scoreDelta, timeDelta };
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
        sfx: patch.sfx ?? state.settings.sfx,
        leftHanded: patch.leftHanded ?? state.settings.leftHanded,
      };
      persistSettings(next);
      return { settings: next };
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
}));
