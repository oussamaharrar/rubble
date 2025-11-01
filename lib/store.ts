'use client';

import { create } from 'zustand';
import { persistMissions, readPersistedMissions, generateDailyMissions, bonusStorageKey } from '@/lib/missions';
import { deriveDailyTuning, getDailyKeyUTC, isDailyEligible, seedFromDailyKey, type DailyTuning } from '@/lib/daily';
import type {
  BoardKind,
  Bubble,
  BubbleKind,
  BoosterBank,
  BubbleColor,
  BurstState,
  DifficultyState,
  EntryMode,
  FirstRunProgress,
  GamePhase,
  GameSettings,
  GoldenOrbState,
  Hazard,
  Mission,
  TargetState,
  RunStats,
  UnlockState,
} from '@/types/game';
import { logEvent } from '@/lib/telemetry';
import { useRewardBoostStore } from '@/lib/stores/reward-boost';
import type { BoostSource } from '@/lib/stores/reward-boost';

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
const RARE_CHANCE = 0.05;
const TREASURE_CHANCE = 0.01;
const BAD_CHANCE = 0.08;

const BOOSTER_KEY = 'rubble:booster-bank';
const SETTINGS_KEY = 'rubble_settings_v2';
const UNLOCKS_KEY = 'rubble_unlocks_v1';
const DAILY_RUN_KEY_PREFIX = 'rubble:daily-runs';

const BASE_MAX_BUBBLES = 40;
const BASE_MAX_STORM_ORBS = 10;
const BASE_STORM_INTERVAL_MS = 30_000;
const BASE_STORM_DURATION_MS = 7_000;
const BASE_SPEED_FACTOR = 1;
const LEVEL_SCORE_STEP = 300;
const LEVEL_SURVIVAL_STEP_MS = 45_000;
const BASE_TRAP_CHANCE = 0.04;
const TRAP_CHANCE_INCREMENT = 0.025;
const EASE_THRESHOLD = 10;
const EASE_WINDOW_MS = 10_000;
const EASE_DURATION_MS = 8_000;
const SPAWN_EXCLUSION_RADIUS = 72;
const SPAWN_MEMORY = 14;
const MAX_ACTIVE_HAZARDS = 6;

const DEFAULT_PALETTE: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];

function settingsDefaults(): GameSettings {
  return {
    haptics: true,
    reducedMotion: false,
    sound: true,
    leftHanded: false,
    theme: 'classic',
    sparkleFx: false,
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
    const parsed = JSON.parse(raw) as Partial<GameSettings> & { sfx?: boolean };
    const defaults = settingsDefaults();
    const legacySound = typeof parsed.sfx === 'boolean' ? parsed.sfx : defaults.sound;
    const theme = parsed.theme === 'soothing-skies' ? 'soothing-skies' : defaults.theme;
    const sparkle = typeof parsed.sparkleFx === 'boolean' ? parsed.sparkleFx : defaults.sparkleFx;
    return {
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : defaults.haptics,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaults.reducedMotion,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : legacySound,
      leftHanded: typeof parsed.leftHanded === 'boolean' ? parsed.leftHanded : defaults.leftHanded,
      theme,
      sparkleFx: sparkle,
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

function unlockDefaults(): UnlockState {
  return {
    themeSkies: false,
    fxSparkle: false,
  };
}

function readUnlocks(): UnlockState {
  if (typeof window === 'undefined') {
    return unlockDefaults();
  }
  try {
    const raw = window.localStorage.getItem(UNLOCKS_KEY);
    if (!raw) return unlockDefaults();
    const parsed = JSON.parse(raw) as Partial<UnlockState>;
    return {
      themeSkies: parsed?.themeSkies === true,
      fxSparkle: parsed?.fxSparkle === true,
    };
  } catch {
    return unlockDefaults();
  }
}

function persistUnlocks(unlocks: UnlockState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks));
  } catch {
    // ignore persistence errors
  }
}

const FIRST_RUN_KEY = 'rubble_first_run_v1';

function firstRunDefaults(): FirstRunProgress {
  return { tapped: false, perfect: false, burst: false };
}

function readFirstRunProgress(): FirstRunProgress {
  if (typeof window === 'undefined') {
    return firstRunDefaults();
  }
  try {
    const raw = window.localStorage.getItem(FIRST_RUN_KEY);
    if (!raw) return firstRunDefaults();
    const parsed = JSON.parse(raw) as Partial<FirstRunProgress>;
    return {
      tapped: parsed?.tapped === true,
      perfect: parsed?.perfect === true,
      burst: parsed?.burst === true,
    };
  } catch {
    return firstRunDefaults();
  }
}

function persistFirstRunProgress(progress: FirstRunProgress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FIRST_RUN_KEY, JSON.stringify(progress));
  } catch {
    // ignore persistence
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
    rareHits: 0,
    totalHits: 0,
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

type RecentSpawn = { x: number; y: number; at: number };

function pickColor(rng: () => number, palette: BubbleColor[], paletteSize: number): BubbleColor {
  const usable = Math.min(Math.max(1, paletteSize), palette.length > 0 ? palette.length : DEFAULT_PALETTE.length);
  const source = palette.length > 0 ? palette : DEFAULT_PALETTE;
  const index = Math.floor(rng() * usable) % usable;
  return source[index];
}

type SpawnEdge = 'top' | 'left' | 'right';

function chooseEdge(rng: () => number): SpawnEdge {
  const roll = rng();
  if (roll < 0.6) return 'top';
  if (roll < 0.8) return 'left';
  return 'right';
}

function spawnFromEdge(
  edge: SpawnEdge,
  radius: number,
  rng: () => number,
  width: number,
  height: number,
  speedFactor: number,
  easingFactor: number
) {
  const jitter = (min: number, max: number) => min + rng() * (max - min);
  let x = width / 2;
  let y = height / 2;
  let vx = 0;
  let vy = 0;
  const baseSpeed = 0.06 + rng() * 0.08;
  const speedMultiplier = Math.max(0.45, Math.min(speedFactor * easingFactor, 1.6));
  switch (edge) {
    case 'top': {
      x = radius + rng() * Math.max(width - radius * 2, radius);
      y = -radius - jitter(8, 32);
      vx = (rng() - 0.5) * 0.18 * width * 0.0015 * speedMultiplier;
      vy = baseSpeed * height * speedMultiplier;
      break;
    }
    case 'left': {
      x = -radius - jitter(8, 24);
      y = radius + rng() * Math.max(height - radius * 2, radius);
      vx = baseSpeed * width * 0.6 * speedMultiplier;
      vy = (rng() - 0.5) * 0.25 * height * 0.001 * speedMultiplier;
      break;
    }
    case 'right':
    default: {
      x = width + radius + jitter(8, 24);
      y = radius + rng() * Math.max(height - radius * 2, radius);
      vx = -baseSpeed * width * 0.6 * speedMultiplier;
      vy = (rng() - 0.5) * 0.25 * height * 0.001 * speedMultiplier;
      break;
    }
  }
  return { x, y, vx, vy };
}

function createBubble(
  rng: () => number,
  width: number,
  height: number,
  now: number,
  palette: BubbleColor[],
  paletteSize: number,
  speedFactor: number,
  recentSpawns: RecentSpawn[],
  easingFactor: number,
  options?: { storm?: boolean; poison?: boolean; energy?: boolean }
): Bubble {
  const radius = (options?.storm ? 20 : 24) + rng() * (options?.storm ? 12 : 18);
  const edge = chooseEdge(rng);
  let spawn = spawnFromEdge(edge, radius, rng, width, height, speedFactor, easingFactor);
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const nearest = recentSpawns.reduce((min, entry) => {
      const dx = entry.x - spawn.x;
      const dy = entry.y - spawn.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return Math.min(min, dist);
    }, Number.POSITIVE_INFINITY);
    if (nearest > SPAWN_EXCLUSION_RADIUS) {
      break;
    }
    spawn = spawnFromEdge(edge, radius, rng, width, height, speedFactor, easingFactor);
  }
  const color = options?.storm
    ? options?.energy
      ? 'blue'
      : 'orange'
    : pickColor(rng, palette, paletteSize);
  const roll = options?.storm ? null : rng();
  let kind: BubbleKind = 'normal';
  if (options?.storm) {
    if (options.poison) {
      kind = 'drain';
    } else if (options.energy) {
      kind = 'energy';
    }
  } else if (roll !== null) {
    if (roll < TREASURE_CHANCE) {
      kind = 'treasure';
    } else if (roll < TREASURE_CHANCE + RARE_CHANCE) {
      kind = 'rare';
    } else if (roll < TREASURE_CHANCE + RARE_CHANCE + BAD_CHANCE) {
      kind = 'bad';
    }
  }
  return {
    id: `${now}-${Math.floor(rng() * 1_000_000)}`,
    x: spawn.x,
    y: spawn.y,
    r: options?.storm ? radius * 0.85 : radius,
    color,
    vx: options?.storm ? spawn.vx * 1.15 : spawn.vx,
    vy: options?.storm ? spawn.vy * 1.25 : spawn.vy,
    storm: options?.storm ?? false,
    poison: options?.poison ?? false,
    createdAt: now,
    kind,
  };
}

type SafeInterior = { top: number; right: number; bottom: number; left: number };

function computeSafeInterior(
  width: number,
  height: number,
  safeArea: { top: number; right: number; bottom: number; left: number }
): SafeInterior {
  const baseTop = height * 0.12;
  const baseSide = width * 0.08;
  const safeTop = Math.min(height, Math.max(baseTop, safeArea.top * height));
  const safeLeft = Math.min(width - baseSide, Math.max(baseSide, safeArea.left * width));
  const safeRight = Math.max(safeLeft + 40, width - Math.max(baseSide, safeArea.right * width));
  const safeBottom = Math.max(safeTop + 40, height - Math.max(0, safeArea.bottom * height));
  return { top: safeTop, right: safeRight, bottom: safeBottom, left: safeLeft };
}

function bubbleWithinInterior(bubble: Bubble, interior: SafeInterior) {
  const { x, y, r } = bubble;
  if (x + r > interior.right || x - r < interior.left) {
    return false;
  }
  if (y + r > interior.bottom || y - r < interior.top) {
    return false;
  }
  return true;
}

function clampBubbleToInterior(bubble: Bubble, interior: SafeInterior): Bubble {
  const radius = bubble.r;
  const clampedX = Math.min(Math.max(bubble.x, interior.left + radius), interior.right - radius);
  const clampedY = Math.min(Math.max(bubble.y, interior.top + radius), interior.bottom - radius);
  return { ...bubble, x: clampedX, y: clampedY };
}

function createSpikeMine(
  rng: () => number,
  width: number,
  height: number,
  now: number,
  speedFactor: number,
  easingFactor: number
): Hazard {
  const radius = 26 + rng() * 12;
  const edge = chooseEdge(rng);
  const spawn = spawnFromEdge(edge, radius, rng, width, height, speedFactor * 0.7, easingFactor);
  return {
    id: `spike-${now}-${Math.floor(rng() * 1_000_000)}`,
    kind: 'spike-mine',
    x: spawn.x,
    y: spawn.y,
    r: radius,
    vx: spawn.vx * 0.35,
    vy: spawn.vy * 0.35,
    createdAt: now,
  };
}

function createPoisonCloud(
  rng: () => number,
  width: number,
  height: number,
  now: number
): Hazard {
  const radius = 60 + rng() * 22;
  const x = radius + rng() * Math.max(width - radius * 2, radius);
  const y = radius + rng() * Math.max(height - radius * 2, radius);
  const vx = (rng() - 0.5) * 0.02 * width * 0.001;
  const vy = (rng() - 0.5) * 0.02 * height * 0.001;
  return {
    id: `cloud-${now}-${Math.floor(rng() * 1_000_000)}`,
    kind: 'poison-cloud',
    x,
    y,
    r: radius,
    vx,
    vy,
    createdAt: now,
    expiresAt: now + 4_000 + rng() * 1_000,
  };
}

function isEnergyOrb(bubble: Bubble) {
  return bubble.kind === 'energy';
}

function isDrainOrb(bubble: Bubble) {
  return bubble.kind === 'drain';
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
  kind?: BubbleKind;
  scoreDelta?: number;
};

declare global {
  interface Window {
    rubbleLastSpawnSnapshot?: Array<{ x: number; y: number; r: number }>;
  }
}

type GameStore = {
  phase: GamePhase;
  boardKind: BoardKind;
  stats: RunStats;
  entryMode: EntryMode | null;
  bubbles: Bubble[];
  hazards: Hazard[];
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
  unlocks: UnlockState;
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
  difficulty: DifficultyState;
  recentSpawns: RecentSpawn[];
  timeLossEvents: { at: number; amount: number }[];
  firstRun: FirstRunProgress;
  lastPerfectAt: number;
  lastBurstAt: number;
  burst: BurstState;
  burstPointer: { x: number; y: number } | null;
  golden: GoldenOrbState;
  nextGoldenSpawnAt: number;
  hudSafeArea: { top: number; right: number; bottom: number; left: number };
  rewardBoostUsed: BoostSource | null;
  treasureFound: boolean;
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
  unlockFeature: (key: keyof UnlockState) => void;
  markFirstRun: (patch: Partial<FirstRunProgress>) => void;
  setStageSize: (width: number, height: number) => void;
  setHudSafeArea: (area: { top: number; right: number; bottom: number; left: number }) => void;
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
    useRewardBoostStore.getState().refresh();
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
    const bubbleKind = bubble.kind;
    const targetEligible =
      activeTarget && !isDrainOrb(bubble) && bubbleKind !== 'bad' && targetState.color === bubble.color;
    const allowPerfect = options?.allowPerfect ?? true;
    const perfectCandidate =
      allowPerfect && !isDrainOrb(bubble) && bubbleKind !== 'bad' && distance <= perfectThreshold;

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
    let cloudPenalty = false;
    let scoreDelta = 0;
    const nextTreasureFound = state.treasureFound || bubbleKind === 'treasure';

    if (now - timeGainWindowStart >= 1_000) {
      timeGainWindowStart = now;
      timeGainAccumulated = 0;
    }

    const allowComboContribution = options?.comboContribution !== false;
    const scoreMultiplier = options?.scoreMultiplier ?? 1;
    const timeMultiplier = options?.timeMultiplier ?? scoreMultiplier;
    const source = options?.source ?? 'tap';

    for (const hazard of state.hazards) {
      if (hazard.kind !== 'poison-cloud') continue;
      const expires = typeof hazard.expiresAt === 'number' && now > hazard.expiresAt;
      if (expires) continue;
      const dx = bubble.x - hazard.x;
      const dy = bubble.y - hazard.y;
      if (dx * dx + dy * dy <= hazard.r * hazard.r) {
        cloudPenalty = true;
        break;
      }
    }

    if (isDrainOrb(bubble)) {
      stats.timeLeft = Math.max(0, stats.timeLeft - DRAIN_PENALTY_TIME);
      registerTimeLoss(DRAIN_PENALTY_TIME, now);
      stats.score = Math.max(0, stats.score - DRAIN_PENALTY_SCORE);
      stats.chainLen = 0;
      stats.lastColor = undefined;
      stats.streak = Math.max(stats.streak, state.currentStreak);
      currentStreak = 0;
      comboWindowUntil = 0;
      drain = true;
      scoreDelta = -DRAIN_PENALTY_SCORE;
    } else {
      currentStreak = state.currentStreak + 1;
      stats.streak = Math.max(stats.streak, currentStreak);
      stats.totalHits = (stats.totalHits ?? 0) + 1;

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

      if (bubbleKind === 'bad') {
        const penalty = Math.max(5, Math.round(BASE_POINTS * 1.5));
        stats.score = Math.max(0, stats.score - penalty);
        stats.chainLen = 0;
        stats.lastColor = undefined;
        stats.streak = Math.max(stats.streak, state.currentStreak);
        currentStreak = 0;
        comboWindowUntil = 0;
        scoreDelta = -penalty;
      } else if (isEnergyOrb(bubble)) {
        let awarded = ENERGY_POINTS;
        if (targetEligible) {
          targetHit = true;
          awarded *= 3;
          stats.timeLeft += 2;
          celebrationUntil = Math.max(celebrationUntil, now + 1_500);
          nextTargetAt = now + 9_000 + state.rng() * 3_000;
          targetState = { active: false, expiresAt: 0 };
        }
        stats.score += awarded;
        energy = true;
        scoreDelta = awarded;
      } else {
        const multiplier = Math.min(1 + 0.25 * Math.max(chainLen - 2, 0), 4);
        const baseAward = Math.round(BASE_POINTS * multiplier);
        let awarded = targetEligible ? baseAward * 3 : baseAward;
        if (bubbleKind === 'rare') {
          awarded *= 3;
        }
        const hazardFactor = cloudPenalty ? 0.5 : 1;
        awarded = Math.round(awarded * scoreMultiplier * hazardFactor);
        if (awarded > 0) {
          stats.score += awarded;
        }
        if (bubbleKind === 'treasure') {
          useRewardBoostStore.getState().grant('treasure');
          logEvent('treasure_found', { score: awarded, combo: stats.chainLen });
          logEvent('boost_granted', { reason: 'treasure' });
        } else if (bubbleKind === 'rare') {
          stats.rareHits = (stats.rareHits ?? 0) + 1;
          logEvent('rare_found', { combo: stats.chainLen, score: awarded });
        }
        scoreDelta = awarded;
        const availableGain = Math.max(0, 1 - timeGainAccumulated);
        const appliedGain = Math.min(BASE_TIME_REWARD * timeMultiplier, availableGain);
        stats.timeLeft += appliedGain;
        timeGainAccumulated += appliedGain;
        if (targetEligible) {
          stats.timeLeft += 2;
          targetHit = true;
          celebrationUntil = Math.max(celebrationUntil, now + 1_500);
          nextTargetAt = now + 9_000 + state.rng() * 3_000;
          targetState = { active: false, expiresAt: 0 };
        }
        if (allowComboContribution && chainLen >= 10 && !state.settings.reducedMotion) {
          get().activateSlowTime(240);
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

    const markTap = source === 'tap' && !state.firstRun.tapped;
    const markPerfect = perfect && !state.firstRun.perfect;

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
      lastPerfectAt: perfect ? now : state.lastPerfectAt,
      treasureFound: nextTreasureFound,
    });

    if (energy) {
      get().grantBooster(1, 'energy');
    }

    if (markTap) {
      get().markFirstRun({ tapped: true });
    }
    if (markPerfect) {
      get().markFirstRun({ perfect: true });
    }

    logEvent('bubble_hit', {
      type: bubbleKind,
      scoreDelta,
      combo: get().stats.chainLen,
      source,
    });

    return {
      hit: true,
      energy,
      drain: drain || cloudPenalty,
      combo: get().stats.chainLen,
      perfect,
      targetHit,
      radius: bubble.r,
      color: bubble.color,
      burst: source === 'burst',
      kind: bubbleKind,
      scoreDelta,
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
      registerTimeLoss(5, state.now);
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

  const registerTimeLoss = (amount: number, at: number) => {
    if (amount <= 0) return;
    set((current) => {
      const events = [...current.timeLossEvents, { at, amount }];
      const cutoff = at - EASE_WINDOW_MS;
      const filtered = events.filter((event) => event.at >= cutoff);
      let difficulty = current.difficulty;
      const totalLoss = filtered.reduce((sum, event) => sum + event.amount, 0);
      if (totalLoss >= EASE_THRESHOLD) {
        const easingUntil = Math.max(difficulty.easingUntil, at + EASE_DURATION_MS);
        difficulty = { ...difficulty, easingUntil };
        return { timeLossEvents: filtered, difficulty };
      }
      if (filtered.length !== events.length) {
        return { timeLossEvents: filtered };
      }
      return { timeLossEvents: filtered };
    });
  };

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
  hazards: [],
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
  unlocks: readUnlocks(),
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
  difficulty: {
    tier: 0,
    nextScoreThreshold: LEVEL_SCORE_STEP,
    nextSurvivalThreshold: LEVEL_SURVIVAL_STEP_MS,
    trapChance: BASE_TRAP_CHANCE,
    speedMultiplier: 1,
    easingUntil: 0,
    paletteSize: 3,
  },
  recentSpawns: [],
  timeLossEvents: [],
  firstRun: readFirstRunProgress(),
  lastPerfectAt: 0,
  lastBurstAt: 0,
  burst: defaultBurstState(),
  burstPointer: null,
  golden: defaultGoldenState(),
  nextGoldenSpawnAt: GOLDEN_RESPAWN_MIN_MS,
  hudSafeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  rewardBoostUsed: null,
  treasureFound: false,
  startRun: (mode = 'trial') => {
    const rewardBoostStore = useRewardBoostStore.getState();
    if (mode !== 'trial') {
      rewardBoostStore.refresh();
    }
    const consumedBoost = mode === 'trial' ? null : rewardBoostStore.consumeForRun();
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
      hazards: [],
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
      difficulty: {
        tier: 0,
        nextScoreThreshold: LEVEL_SCORE_STEP,
        nextSurvivalThreshold: LEVEL_SURVIVAL_STEP_MS,
        trapChance: BASE_TRAP_CHANCE,
        speedMultiplier: 1,
        easingUntil: 0,
        paletteSize: Math.min(3, palette.length || DEFAULT_PALETTE.length),
      },
      recentSpawns: [],
      timeLossEvents: [],
      lastRunOfficialDaily: false,
      lastTapAt: 0,
      lastTapX: 0,
      lastTapY: 0,
      lastComboFrame: -Infinity,
      timeGainWindowStart: 0,
      timeGainAccumulated: 0,
      firstRun: get().firstRun,
      lastPerfectAt: 0,
      lastBurstAt: 0,
      burst: burstDefaults,
      burstPointer: null,
      golden: defaultGoldenState(),
      nextGoldenSpawnAt: initialGoldenAt,
      rewardBoostUsed: consumedBoost ? consumedBoost.source : null,
      treasureFound: false,
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
    const earnedBoost = state.stats.energyOrbsCollected > 0;
    const payload = {
      totalScore: state.stats.score,
      earnedBoost,
      board: state.boardKind,
      boostSource: state.rewardBoostUsed,
    };
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
      logEvent('run_completed', payload);
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
    logEvent('run_completed', payload);
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
      hazards: [],
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
      difficulty: {
        tier: 0,
        nextScoreThreshold: LEVEL_SCORE_STEP,
        nextSurvivalThreshold: LEVEL_SURVIVAL_STEP_MS,
        trapChance: BASE_TRAP_CHANCE,
        speedMultiplier: 1,
        easingUntil: 0,
        paletteSize: Math.min(3, palette.length || DEFAULT_PALETTE.length),
      },
      recentSpawns: [],
      timeLossEvents: [],
      firstRun: get().firstRun,
      lastPerfectAt: 0,
      lastBurstAt: 0,
      burst: { ...defaultBurstState(), cooldownMs: state.burst.cooldownMs, minHoldMs: state.burst.minHoldMs, maxHoldMs: state.burst.maxHoldMs },
      burstPointer: null,
      golden: defaultGoldenState(),
      nextGoldenSpawnAt: initialGoldenAt,
      rewardBoostUsed: null,
      treasureFound: false,
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
    let difficulty = state.difficulty;
    const easingFactor = now < difficulty.easingUntil ? 0.85 : 1;

    updateGoldenOrb(now);
    spawnGoldenOrb(now);

    if (targetState.active && now >= targetState.expiresAt) {
      targetState = { ...targetState, active: false, expiresAt: 0 };
    }

    if (!targetState.active && now >= nextTargetAt) {
      const color = pickColor(state.rng, state.palette, difficulty.paletteSize);
      targetState = { color, active: true, expiresAt: now + 3_000 };
      nextTargetAt = now + 9_000 + state.rng() * 3_000;
    }

    const updatedBubbles: Bubble[] = [];
    const dtSeconds = (clampedDt / 1000) * factor * easingFactor;
    for (const bubble of state.bubbles) {
      const nextX = bubble.x + bubble.vx * dtSeconds;
      const nextY = bubble.y + bubble.vy * dtSeconds;
      const outside =
        nextX < -bubble.r * 1.5 ||
        nextX > width + bubble.r * 1.5 ||
        nextY < -bubble.r * 1.5 ||
        nextY > height + bubble.r * 1.5;
      if (outside) {
        continue;
      }
      updatedBubbles.push({ ...bubble, x: nextX, y: nextY });
    }

    const updatedHazards: Hazard[] = [];
    for (const hazard of state.hazards) {
      const nextX = hazard.x + hazard.vx * dtSeconds;
      const nextY = hazard.y + hazard.vy * dtSeconds;
      const expired = typeof hazard.expiresAt === 'number' && now >= hazard.expiresAt;
      const outside =
        nextX < -hazard.r * 1.5 ||
        nextX > width + hazard.r * 1.5 ||
        nextY < -hazard.r * 1.5 ||
        nextY > height + hazard.r * 1.5;
      if (expired || outside) {
        continue;
      }
      updatedHazards.push({ ...hazard, x: nextX, y: nextY });
    }

    const stats = { ...state.stats };
    if (stats.timeLeft > 0) {
      stats.timeLeft = Math.max(0, stats.timeLeft - clampedDt / 1000);
    }

    const runSeconds = (now - state.now) / 1000;
    if (runSeconds > 0) {
      get().progressSurvival(runSeconds);
    }

    let leveled = false;
    if (stats.score >= difficulty.nextScoreThreshold) {
      difficulty = {
        ...difficulty,
        tier: difficulty.tier + 1,
        nextScoreThreshold: difficulty.nextScoreThreshold + LEVEL_SCORE_STEP,
        paletteSize: Math.min(
          (state.palette.length || DEFAULT_PALETTE.length),
          difficulty.paletteSize + 1
        ),
        trapChance: Math.min(0.35, difficulty.trapChance + TRAP_CHANCE_INCREMENT),
        speedMultiplier: Math.min(1.6, difficulty.speedMultiplier + 0.08),
      };
      leveled = true;
    }
    if (now >= difficulty.nextSurvivalThreshold) {
      difficulty = {
        ...difficulty,
        tier: difficulty.tier + (leveled ? 0 : 1),
        nextSurvivalThreshold: difficulty.nextSurvivalThreshold + LEVEL_SURVIVAL_STEP_MS,
        trapChance: Math.min(0.35, difficulty.trapChance + TRAP_CHANCE_INCREMENT * 0.75),
        speedMultiplier: Math.min(1.6, difficulty.speedMultiplier + 0.05),
      };
      leveled = true;
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

    const trimmedSpawns = state.recentSpawns.filter((entry) => now - entry.at < 5_000);

    set({
      bubbles: updatedBubbles,
      hazards: updatedHazards,
      stats,
      now,
      phase,
      target: targetState,
      nextTargetAt,
      targetCelebrationUntil: celebrationUntil,
      perfectUntil,
      difficulty,
      recentSpawns: trimmedSpawns,
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
    const paletteSize = state.difficulty.paletteSize;
    const speedFactor = bubbleSpeedFactor * state.difficulty.speedMultiplier;
    const easingFactor = now < state.difficulty.easingUntil ? 0.85 : 1;
    const recent = [...state.recentSpawns];
    const next: Bubble[] = [];
    const newHazards: Hazard[] = [];
    const interior = computeSafeInterior(width, height, state.hudSafeArea);
    for (let index = 0; index < count; index += 1) {
      let chosen: Bubble | null = null;
      let lastCandidate: Bubble | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const candidate = createBubble(
          rng,
          width,
          height,
          now,
          palette,
          paletteSize,
          speedFactor,
          recent,
          easingFactor
        );
        lastCandidate = candidate;
        if (bubbleWithinInterior(candidate, interior)) {
          chosen = candidate;
          break;
        }
      }
      const bubble = chosen ?? clampBubbleToInterior(lastCandidate ?? createBubble(
        rng,
        width,
        height,
        now,
        palette,
        paletteSize,
        speedFactor,
        recent,
        easingFactor
      ), interior);
      next.push(bubble);
      recent.push({ x: bubble.x, y: bubble.y, at: now });
      if (recent.length > SPAWN_MEMORY) {
        recent.shift();
      }
      const canSpawnTrap = state.phase === 'playing' && state.hazards.length + newHazards.length < MAX_ACTIVE_HAZARDS;
      if (canSpawnTrap && rng() < state.difficulty.trapChance) {
        if (rng() < 0.55) {
          newHazards.push(createSpikeMine(rng, width, height, now, speedFactor, easingFactor));
        } else {
          newHazards.push(createPoisonCloud(rng, width, height, now));
        }
      }
    }
    const trimmedHazards = [...state.hazards, ...newHazards].slice(-MAX_ACTIVE_HAZARDS);
    set({
      bubbles: [...state.bubbles, ...next].slice(0, maxBubbles + maxStormOrbs),
      recentSpawns: recent,
      hazards: trimmedHazards,
    });
    if (typeof window !== 'undefined') {
      window.rubbleLastSpawnSnapshot = next.map((bubble) => ({ x: bubble.x, y: bubble.y, r: bubble.r }));
    }
  },
  spawnStormOrbs: () => {
    const state = get();
    if (state.phase !== 'storm') return;
    const { rng, width, height, now, bubbleSpeedFactor, maxBubbles, maxStormOrbs, palette } = state;
    const payload: Bubble[] = [];
    const interior = computeSafeInterior(width, height, state.hudSafeArea);
    const energyCount = 3 + Math.floor(rng() * 3);
    const drainCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < energyCount; i += 1) {
      payload.push(
        createBubble(
          rng,
          width,
          height,
          now,
          palette,
          state.difficulty.paletteSize,
          bubbleSpeedFactor * state.difficulty.speedMultiplier,
          state.recentSpawns,
          now < state.difficulty.easingUntil ? 0.85 : 1,
          { storm: true, energy: true }
        )
      );
    }
    for (let i = 0; i < drainCount; i += 1) {
      payload.push(
        createBubble(
          rng,
          width,
          height,
          now,
          palette,
          state.difficulty.paletteSize,
          bubbleSpeedFactor * state.difficulty.speedMultiplier,
          state.recentSpawns,
          now < state.difficulty.easingUntil ? 0.85 : 1,
          { storm: true, poison: true }
        )
      );
    }
    const safePayload = payload.map((bubble) =>
      bubbleWithinInterior(bubble, interior) ? bubble : clampBubbleToInterior(bubble, interior)
    );
    const newSpawns = safePayload.map((bubble) => ({ x: bubble.x, y: bubble.y, at: now }));
    const recent = [...state.recentSpawns, ...newSpawns];
    while (recent.length > SPAWN_MEMORY) {
      recent.shift();
    }
    set({
      bubbles: [...state.bubbles, ...safePayload].slice(0, maxBubbles + maxStormOrbs),
      recentSpawns: recent,
    });
    if (typeof window !== 'undefined') {
      window.rubbleLastSpawnSnapshot = safePayload.map((bubble) => ({ x: bubble.x, y: bubble.y, r: bubble.r }));
    }
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

    set({ ...patch, lastBurstAt: state.now });

    if (!state.firstRun.burst) {
      get().markFirstRun({ burst: true });
    }

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

    for (let index = state.hazards.length - 1; index >= 0; index -= 1) {
      const hazard = state.hazards[index];
      const dx = x - hazard.x;
      const dy = y - hazard.y;
      if (dx * dx + dy * dy > hazard.r * hazard.r) continue;
      const bestStreak = Math.max(state.stats.streak, state.currentStreak);
      const stats = { ...state.stats, chainLen: 0, lastColor: undefined, streak: bestStreak };
      let hazards = state.hazards;
      if (hazard.kind === 'spike-mine') {
        stats.timeLeft = Math.max(0, stats.timeLeft - 3);
        registerTimeLoss(3, now);
        hazards = [...state.hazards.slice(0, index), ...state.hazards.slice(index + 1)];
      } else {
        stats.timeLeft = Math.max(0, stats.timeLeft - 2);
        registerTimeLoss(2, now);
      }
      set({
        stats,
        hazards,
        comboWindowUntil: 0,
        currentStreak: 0,
        lastTapAt: now,
        lastTapX: x,
        lastTapY: y,
      });
      return { hit: false, drain: true };
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
      registerTimeLoss(WRONG_TAP_PENALTY, now);
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
        sparkleFx: patch.sparkleFx ?? state.settings.sparkleFx,
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
      const unlocks: UnlockState = { ...state.unlocks, [key]: true };
      persistUnlocks(unlocks);
      return { unlocks };
    });
  },
  markFirstRun: (patch) => {
    set((state) => {
      const next: FirstRunProgress = {
        tapped: patch.tapped ?? state.firstRun.tapped,
        perfect: patch.perfect ?? state.firstRun.perfect,
        burst: patch.burst ?? state.firstRun.burst,
      };
      persistFirstRunProgress(next);
      return { firstRun: next };
    });
  },
  setStageSize: (width, height) => {
    set({ width, height });
  },
  setHudSafeArea: (area) => {
    const clamp = (value: number) => Math.min(Math.max(value, 0), 0.95);
    set({
      hudSafeArea: {
        top: clamp(area.top),
        right: clamp(area.right),
        bottom: clamp(area.bottom),
        left: clamp(area.left),
      },
    });
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

declare global {
  interface Window {
    __rubbleStore?: typeof useGameStore;
  }
}

if (typeof window !== 'undefined') {
  window.__rubbleStore = useGameStore;
}
