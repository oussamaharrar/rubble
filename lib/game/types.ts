export enum GameState {
  SPLASH = 'SPLASH',
  MENU = 'MENU',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export type BoosterType = 'time-freeze' | 'score-doubler' | 'bubble-magnet';

export interface BoosterConfig {
  sku: string;
  label: string;
  type: BoosterType;
  durationMs: number;
  description: string;
  priceWei: bigint;
  icon: string;
}

export interface ActiveBooster {
  type: BoosterType;
  expiresAt: number;
}

export interface GameSnapshot {
  score: number;
  combo: number;
  streak: number;
  colorChain: number;
  fever: boolean;
  rush: boolean;
  lives: number;
  activeBoosters: ActiveBooster[];
}
