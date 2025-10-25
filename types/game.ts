export type BubbleColor = 'yellow' | 'blue' | 'green' | 'pink' | 'orange';

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

export type GamePhase = 'start' | 'playing' | 'storm' | 'paused' | 'summary';

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

export type RunStats = {
  score: number;
  bestCombo: number;
  streak: number;
  timeLeft: number;
  lastColor?: BubbleColor;
  chainLen: number;
  energyCollected: number;
};
