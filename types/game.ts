export type BubbleColor = 'yellow' | 'blue' | 'green' | 'pink' | 'orange';

export type EntryMode = 'trial' | 'paid';

export type BoardKind = 'normal' | 'daily';

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
  theme: 'default' | 'skies';
  particleStyle: 'classic' | 'sparkle';
}

export interface GameUnlocks {
  themeSkies: boolean;
  fxSparkle: boolean;
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
