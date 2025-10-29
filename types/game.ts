export type BubbleColor = 'yellow' | 'blue' | 'green' | 'pink' | 'orange';

export type EntryMode = 'trial' | 'paid';

export type BoardKind = 'normal' | 'daily';

export type BubbleKind = 'normal' | 'bad' | 'rare' | 'treasure';

export type Bubble = {
  id: string;
  x: number;
  y: number;
  r: number;
  color: BubbleColor;
  vx: number;
  vy: number;
  storm?: boolean;
  poison?: boolean;
  createdAt: number;
  kind?: BubbleKind;
};

export type GamePhase = 'home' | 'gate' | 'intro' | 'playing' | 'storm' | 'paused' | 'summary';

export type MissionKind = 'color' | 'combo' | 'survival';

export type Mission = {
  id: string;
  kind: MissionKind;
  target: number;
  progress: number;
  label: string;
  rewardOrbs: number;
  completed: boolean;
  claimed: boolean;
};

export type BoosterBank = {
  freeOrbs: number;
  lastDailyKey: string;
};

export interface GameSettings {
  haptics: boolean;
  reducedMotion: boolean;
  sound: boolean;
  leftHanded: boolean;
  theme: 'classic' | 'soothing-skies';
  sparkleFx: boolean;
}

export type RunStats = {
  score: number;
  bestCombo: number;
  streak: number;
  timeLeft: number;
  lastColor?: BubbleColor;
  chainLen: number;
  energyOrbsCollected: number;
  paidEntryOrbs: number;
  entryMode: EntryMode | null;
};

export type TargetState = {
  color?: BubbleColor;
  expiresAt: number;
  active: boolean;
};

export type BurstState = {
  readyAt: number;
  charging: boolean;
  chargeStartAt: number;
  lastUseAt: number;
  cooldownMs: number;
  minHoldMs: number;
  maxHoldMs: number;
  overcharge: boolean;
};

export type GoldenOrbState = {
  active: boolean;
  id?: string;
  spawnedAt: number;
  graceMs: number;
  x: number;
  y: number;
  r: number;
  toxic: boolean;
};

export type HazardKind = 'spike-mine' | 'poison-cloud';

export interface Hazard {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  createdAt: number;
  expiresAt?: number;
}

export interface UnlockState {
  themeSkies: boolean;
  fxSparkle: boolean;
}

export interface FirstRunProgress {
  tapped: boolean;
  perfect: boolean;
  burst: boolean;
}

export interface DifficultyState {
  tier: number;
  nextScoreThreshold: number;
  nextSurvivalThreshold: number;
  trapChance: number;
  speedMultiplier: number;
  easingUntil: number;
  paletteSize: number;
}
