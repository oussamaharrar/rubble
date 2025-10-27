import { useGameStore } from '@/lib/store';

export type GameStoreState = ReturnType<typeof useGameStore.getState>;

export type AmbientDot = {
  x: number;
  y: number;
  radius: number;
  depth: number;
  phase: number;
};

export interface Ripple {
  x: number;
  y: number;
  progress: number;
  maxRadius: number;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  vx: number;
  vy: number;
  gravity: number;
}

export interface RenderBackgroundOptions {
  comboIntensity: number;
  playingPhase: boolean;
  themeActive: boolean;
  slowFactor: number;
  allowAmbient: boolean;
  ambientDots: AmbientDot[];
  now: number;
}

export interface RenderWorldOptions {
  prefersReducedMotion: boolean;
}

export interface RenderEffectsOptions {
  dt: number;
  particles: Particle[];
  particlePool: Particle[];
  ripples: Ripple[];
}

export interface RenderEffectsResult {
  particles: Particle[];
  particlePool: Particle[];
  ripples: Ripple[];
}
