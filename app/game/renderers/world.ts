import type { GameStoreState, RenderWorldOptions } from './types';

const COLOR_MAP = {
  yellow: '#facc15',
  blue: '#38bdf8',
  green: '#4ade80',
  pink: '#f472b6',
  orange: '#fb923c',
} as const;

const GLOW_MAP = {
  yellow: 'rgba(250,204,21,0.45)',
  blue: 'rgba(56,189,248,0.45)',
  green: 'rgba(74,222,128,0.45)',
  pink: 'rgba(244,114,182,0.45)',
  orange: 'rgba(251,146,60,0.45)',
} as const;

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  _rect: DOMRect | { width: number; height: number },
  state: GameStoreState,
  options: RenderWorldOptions
) {
  ctx.save();

  const hazards = state.hazards;
  for (const hazard of hazards) {
    if (hazard.kind === 'poison-cloud') {
      const remaining =
        typeof hazard.expiresAt === 'number' && hazard.expiresAt > 0
          ? Math.max(0, Math.min(1, (hazard.expiresAt - state.now) / 4_000))
          : 1;
      const inner = ctx.createRadialGradient(hazard.x, hazard.y, hazard.r * 0.1, hazard.x, hazard.y, hazard.r);
      inner.addColorStop(0, `rgba(76,196,255,${0.16 * remaining})`);
      inner.addColorStop(1, `rgba(30,58,138,0)`);
      ctx.beginPath();
      ctx.fillStyle = inner;
      ctx.arc(hazard.x, hazard.y, hazard.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const spin = options.prefersReducedMotion ? 0 : state.now / 900 + (hazard.createdAt % 2000) / 200;
      ctx.save();
      ctx.translate(hazard.x, hazard.y);
      ctx.rotate(spin);
      ctx.beginPath();
      const spikes = 8;
      for (let i = 0; i < spikes; i += 1) {
        const angle = (i / spikes) * Math.PI * 2;
        const inner = hazard.r * 0.45;
        const outer = hazard.r;
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.lineTo(Math.cos(angle + Math.PI / spikes) * inner, Math.sin(angle + Math.PI / spikes) * inner);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(248,113,113,0.18)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(248,113,113,0.55)';
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const bubble of state.bubbles) {
    const fill = COLOR_MAP[bubble.color];
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.globalAlpha = bubble.storm ? 0.95 : 0.88;
    ctx.shadowBlur = bubble.storm ? 35 : 16;
    ctx.shadowColor = bubble.storm
      ? bubble.poison
        ? 'rgba(248,113,113,0.55)'
        : 'rgba(59,130,246,0.55)'
      : GLOW_MAP[bubble.color];
    ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.lineWidth = 2;
    ctx.strokeStyle = bubble.storm ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.25)';
    ctx.stroke();

    if (bubble.storm && !bubble.poison) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148,232,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 10]);
      ctx.arc(bubble.x, bubble.y, bubble.r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const golden = state.golden;
  if (golden.active) {
    const progress = Math.min(1, Math.max(0, (state.now - golden.spawnedAt) / golden.graceMs));
    ctx.save();
    ctx.translate(golden.x, golden.y);
    const coreColor = golden.toxic ? 'rgba(248,113,113,0.85)' : 'rgba(253,224,71,0.88)';
    const strokeColor = golden.toxic ? 'rgba(248,113,113,0.95)' : 'rgba(253,224,71,0.95)';
    ctx.beginPath();
    ctx.fillStyle = coreColor;
    ctx.shadowBlur = 18;
    ctx.shadowColor = golden.toxic ? 'rgba(248,113,113,0.55)' : 'rgba(253,224,71,0.55)';
    ctx.arc(0, 0, golden.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    if (!golden.toxic) {
      const ringRadius = golden.r + 10;
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(253,224,71,0.65)';
      ctx.globalAlpha = 0.85;
      ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress));
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(248,113,113,0.6)';
      ctx.lineWidth = 3;
      ctx.arc(0, 0, golden.r + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  ctx.restore();
}
