import type { GameStoreState, RenderBackgroundOptions } from './types';

const clampRectDimension = (value: number) => Math.max(1, Math.floor(value));

export function renderBackground(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect | { width: number; height: number },
  state: GameStoreState,
  options: RenderBackgroundOptions
) {
  const width = clampRectDimension(rect.width ?? state.width ?? 1);
  const height = clampRectDimension(rect.height ?? state.height ?? 1);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  const topAlpha = options.playingPhase ? 0.72 : 0.85;
  const bottomAlpha = options.playingPhase ? 0.88 : 0.94;

  if (options.themeActive) {
    const skyBase = 120 + options.comboIntensity * 30;
    gradient.addColorStop(0, `rgba(${skyBase},${178 + options.comboIntensity * 12},255,${topAlpha})`);
    gradient.addColorStop(1, `rgba(36,68,122,${bottomAlpha})`);
  } else {
    gradient.addColorStop(
      0,
      `rgba(${18 + options.comboIntensity * 40},${24 + options.comboIntensity * 20},${43 + options.comboIntensity * 32},${topAlpha})`
    );
    gradient.addColorStop(1, `rgba(10,13,23,${bottomAlpha})`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (options.slowFactor > 0) {
    const maxDim = Math.max(width, height);
    const vignette = ctx.createRadialGradient(width / 2, height / 2, maxDim * 0.15, width / 2, height / 2, maxDim * 0.65);
    vignette.addColorStop(0, 'rgba(56,189,248,0.12)');
    vignette.addColorStop(1, 'rgba(15,23,42,0.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  if (!options.allowAmbient) {
    return;
  }

  const dotColor = options.themeActive ? 'rgba(148,197,255,0.08)' : 'rgba(56,189,248,0.08)';
  for (const dot of options.ambientDots) {
    const offsetX = Math.sin(options.now / 16000 + dot.phase) * dot.depth * 36;
    const offsetY = Math.cos(options.now / 18000 + dot.phase) * dot.depth * 42;
    const x = dot.x * width + offsetX;
    const y = dot.y * height + offsetY;
    ctx.beginPath();
    ctx.fillStyle = dotColor;
    ctx.globalAlpha = 0.08;
    ctx.arc(x, y, dot.radius * (0.7 + options.comboIntensity * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
