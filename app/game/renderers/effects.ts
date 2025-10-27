import type { GameStoreState, RenderEffectsOptions, RenderEffectsResult } from './types';

export function renderEffects(
  ctx: CanvasRenderingContext2D,
  _rect: DOMRect | { width: number; height: number },
  state: GameStoreState,
  options: RenderEffectsOptions
): RenderEffectsResult {
  const { dt } = options;
  const particles = options.particles;
  const pool = options.particlePool;
  const remaining: typeof particles = [];

  for (const particle of particles) {
    particle.life -= dt;
    if (particle.life <= 0) {
      pool.push(particle);
      continue;
    }
    const progress = Math.max(0, particle.life / particle.maxLife);
    const easedAlpha = Math.pow(progress, 0.7);
    particle.x += particle.vx * (dt / 16);
    particle.y += particle.vy * (dt / 16);
    particle.vy += particle.gravity * (dt / 16);
    ctx.beginPath();
    ctx.globalAlpha = Math.min(1, easedAlpha);
    ctx.fillStyle = particle.color;
    ctx.arc(particle.x, particle.y, Math.max(1.2, particle.radius * (0.75 + (1 - progress) * 0.35)), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    remaining.push(particle);
  }

  const ripples = options.ripples;
  const rippleRemaining: typeof ripples = [];
  for (const ripple of ripples) {
    ripple.progress += dt * 0.0015;
    if (ripple.progress >= 1) {
      continue;
    }
    const radius = ripple.maxRadius * ripple.progress;
    ctx.beginPath();
    ctx.lineWidth = Math.max(1.2, 3 - ripple.progress * 2.4);
    ctx.strokeStyle = ripple.color;
    ctx.globalAlpha = Math.max(0, 0.35 - ripple.progress * 0.3);
    ctx.arc(ripple.x, ripple.y, Math.max(12, radius), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    rippleRemaining.push(ripple);
  }

  const burst = state.burst;
  if (burst.charging && state.burstPointer) {
    const chargeElapsed = Math.max(0, Date.now() - burst.chargeStartAt);
    const progress = Math.min(chargeElapsed / burst.maxHoldMs, 1);
    const readiness = Math.min(chargeElapsed / burst.minHoldMs, 1);
    const ringRadius = 36 + 90 * progress;
    ctx.beginPath();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = burst.overcharge ? 'rgba(96,165,250,0.75)' : 'rgba(148,232,255,0.75)';
    ctx.globalAlpha = 0.95;
    ctx.arc(state.burstPointer.x, state.burstPointer.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const innerRadius = Math.max(18, ringRadius * readiness * 0.4);
    ctx.beginPath();
    ctx.fillStyle = burst.overcharge ? 'rgba(56,189,248,0.2)' : 'rgba(148,232,255,0.2)';
    ctx.arc(state.burstPointer.x, state.burstPointer.y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    particles: remaining,
    particlePool: pool,
    ripples: rippleRemaining.slice(0, 8),
  };
}
