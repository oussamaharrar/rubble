'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import type { BubbleColor } from '@/types/game';

const COLOR_MAP: Record<BubbleColor, { fill: string; glow: string }> = {
  yellow: { fill: '#fef08a', glow: 'rgba(254, 240, 138, 0.45)' },
  blue: { fill: '#bfdbfe', glow: 'rgba(191, 219, 254, 0.4)' },
  green: { fill: '#bbf7d0', glow: 'rgba(187, 247, 208, 0.45)' },
  pink: { fill: '#fbcfe8', glow: 'rgba(251, 207, 232, 0.45)' },
  orange: { fill: '#fed7aa', glow: 'rgba(254, 215, 170, 0.45)' },
};

const STORM_GLOW = 'rgba(129, 140, 248, 0.5)';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

function createBurst(x: number, y: number, color: string, reducedMotion: boolean) {
  const count = reducedMotion ? 6 : 12;
  const particles: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = reducedMotion ? 35 : 80 + Math.random() * 40;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.4,
      color,
      size: reducedMotion ? 2 : 3 + Math.random() * 2,
    });
  }
  return particles;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const store = useGameStore.getState();

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? 360;
      const height = parent?.clientHeight ?? 560;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      store.setViewport(width, height);
      if (store.bubbles.length === 0) {
        for (let i = 0; i < 12; i += 1) {
          store.spawnBubble(false);
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);

    let frameId = 0;
    let last = performance.now();

    const render = (time: number) => {
      if (document.hidden) {
        last = time;
        frameId = window.requestAnimationFrame(render);
        return;
      }
      const dt = Math.min(0.1, (time - last) / 1000);
      last = time;
      useGameStore.getState().tick(dt);

      const state = useGameStore.getState();
      const { bubbles, stormBubbles, comboMultiplier, slowTimeUntil, phase } = state;
      const width = state.viewport.width || canvas.width;
      const height = state.viewport.height || canvas.height;

      ctx.clearRect(0, 0, width, height);

      const comboStrength = Math.min(1, Math.max(0, comboMultiplier - 1) / 3);
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, `rgba(${40 + comboStrength * 60}, 50, 90, 0.9)`);
      bgGradient.addColorStop(1, `rgba(12, 12, 40, 0.95)`);
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      const activeSlow = slowTimeUntil > performance.now();
      if (activeSlow) {
        ctx.fillStyle = 'rgba(96, 165, 250, 0.08)';
        ctx.fillRect(0, 0, width, height);
      }

      const drawBubble = (bubble: typeof bubbles[number], glow: string) => {
        ctx.save();
        ctx.fillStyle = COLOR_MAP[bubble.color].fill;
        ctx.beginPath();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 16;
        ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      for (const bubble of bubbles) {
        if (!bubble.active) continue;
        drawBubble(bubble, COLOR_MAP[bubble.color].glow);
      }
      for (const bubble of stormBubbles) {
        if (!bubble.active) continue;
        drawBubble(bubble, bubble.poison ? 'rgba(248, 113, 113, 0.65)' : STORM_GLOW);
        if (bubble.storm && !bubble.poison) {
          ctx.save();
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.r + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const particles = particlesRef.current;
      const reduced = prefersReducedMotion.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.life -= dt;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life * (reduced ? 2 : 1));
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (phase === 'storm') {
        ctx.save();
        ctx.fillStyle = 'rgba(96, 165, 250, 0.12)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    const handleTap = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const state = useGameStore.getState();
      if (state.phase !== 'playing' && state.phase !== 'storm') return;
      const x = ((event.clientX - rect.left) / width) * state.viewport.width;
      const y = ((event.clientY - rect.top) / height) * state.viewport.height;
      const result = state.tap(x, y);
      if (result.hit && result.color) {
        const palette = COLOR_MAP[result.color] ?? COLOR_MAP.blue;
        const color = result.drain ? 'rgba(248, 113, 113, 0.8)' : palette.fill;
        particlesRef.current.push(
          ...createBurst(x, y, color, prefersReducedMotion.current).slice(0, result.storm ? 8 : undefined),
        );
      }
    };

    canvas.addEventListener('pointerdown', handleTap);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', handleTap);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full touch-none" />;
}
