export interface AmbientDot {
  x: number;
  y: number;
  radius: number;
  depth: number;
  phase: number;
}

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
