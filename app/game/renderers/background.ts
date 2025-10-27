import type { AmbientDot, GameStoreState, RenderRect } from './types';

interface BackgroundOptions {
  ambientDots: AmbientDot[];
  prefersReducedMotion: boolean;
}

export function renderBackground(
  ctx: CanvasRenderingContext2D,
  rect: RenderRect,
  state: GameStoreState,
  { ambientDots, prefersReducedMotion }: BackgroundOptions
) {
  const { stats, phase, settings, unlocks, slowTimeUntil, now } = state;
  const { width, height } = rect;
  const comboIntensity = Math.min(stats.chainLen / 10, 1);
  const playingPhase = phase === 'playing' || phase === 'storm';
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  const topAlpha = playingPhase ? 0.72 : 0.85;
  const bottomAlpha = playingPhase ? 0.88 : 0.94;
  const themeActive = settings.theme === 'soothing-skies' && unlocks.themeSkies;

  if (themeActive) {
    const skyBase = 120 + comboIntensity * 30;
    gradient.addColorStop(0, `rgba(${skyBase},${178 + comboIntensity * 12},255,${topAlpha})`);
    gradient.addColorStop(1, `rgba(36,68,122,${bottomAlpha})`);
  } else {
    gradient.addColorStop(
      0,
      `rgba(${18 + comboIntensity * 40},${24 + comboIntensity * 20},${43 + comboIntensity * 32},${topAlpha})`
    );
    gradient.addColorStop(1, `rgba(10,13,23,${bottomAlpha})`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const slowFactor = now < slowTimeUntil ? Math.cos((now / 180) % Math.PI) : 0;
  if (slowFactor > 0) {
    const maxDim = Math.max(width, height);
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      maxDim * 0.15,
      width / 2,
      height / 2,
      maxDim * 0.65
    );
    vignette.addColorStop(0, 'rgba(56,189,248,0.12)');
    vignette.addColorStop(1, 'rgba(15,23,42,0.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  const allowAmbient = !prefersReducedMotion && !playingPhase;
  if (!allowAmbient) {
    return;
  }

  const dotColor = themeActive ? 'rgba(148,197,255,0.08)' : 'rgba(56,189,248,0.08)';
  for (const dot of ambientDots) {
    const offsetX = Math.sin(now / 16000 + dot.phase) * dot.depth * 36;
    const offsetY = Math.cos(now / 18000 + dot.phase) * dot.depth * 42;
    const x = dot.x * width + offsetX;
    const y = dot.y * height + offsetY;
    ctx.beginPath();
    ctx.fillStyle = dotColor;
    ctx.globalAlpha = 0.08;
    ctx.arc(x, y, dot.radius * (0.7 + comboIntensity * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
