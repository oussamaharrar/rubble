'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';

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

const MAX_PARTICLES = 32;
const MAX_RIPPLES = 12;

interface Particle {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: string;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  life: number;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);

  const setStageSize = useGameStore((state) => state.setStageSize);
  const phase = useGameStore((state) => state.phase);
  const settings = useGameStore((state) => state.settings);
  const activePhase = phase === 'playing' || phase === 'storm';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      prefersReducedMotion.current = settings.reducedMotion || media.matches;
    };
    update();
    const handler = () => update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler);
    } else {
      media.addListener(handler);
    }
    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handler);
      } else {
        media.removeListener(handler);
      }
    };
  }, [settings.reducedMotion]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      setStageSize(canvas.width, canvas.height);
    });
    observer.observe(container);

    let frameHandle: number;

    const render = (dt: number) => {
      const state = useGameStore.getState();
      const { bubbles, width, stats, slowTimeUntil, now, phase } = state;
      const ratio = width > 0 ? canvas.width / width : 1;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const comboIntensity = Math.min(stats.chainLen / 10, 1);
      const playingPhase = phase === 'playing' || phase === 'storm';
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      const topAlpha = playingPhase ? 0.72 : 0.85;
      const bottomAlpha = playingPhase ? 0.88 : 0.94;
      gradient.addColorStop(0, `rgba(${18 + comboIntensity * 40},${24 + comboIntensity * 20},${43 + comboIntensity * 32},${topAlpha})`);
      gradient.addColorStop(1, `rgba(10,13,23,${bottomAlpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const slowFactor = now < slowTimeUntil ? Math.cos((now / 180) % Math.PI) : 0;
      if (slowFactor > 0) {
        const vignette = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          Math.max(canvas.width, canvas.height) * 0.15,
          canvas.width / 2,
          canvas.height / 2,
          Math.max(canvas.width, canvas.height) * 0.65
        );
        vignette.addColorStop(0, 'rgba(56,189,248,0.12)');
        vignette.addColorStop(1, 'rgba(15,23,42,0.65)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const wobble = prefersReducedMotion.current ? 0 : Math.sin(now / 420) * 4;
      ctx.translate(0, wobble);

      for (const bubble of bubbles) {
        const x = bubble.x * ratio;
        const y = bubble.y * ratio;
        const r = bubble.r * ratio;
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
        ctx.arc(x, y, r, 0, Math.PI * 2);
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
          ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      const particles = particlesRef.current;
      const remaining: Particle[] = [];
      for (const particle of particles) {
        const radius = particle.radius * ratio;
        const alpha = Math.max(0, particle.life);
        if (alpha <= 0) continue;
        ctx.beginPath();
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = alpha;
        ctx.arc(particle.x * ratio, particle.y * ratio, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        particle.life -= dt * 0.0025;
        particle.radius += dt * 0.04;
        remaining.push(particle);
      }
      particlesRef.current = remaining.slice(0, MAX_PARTICLES);

      const ripples = ripplesRef.current;
      const rippleNext: Ripple[] = [];
      for (const ripple of ripples) {
        const alpha = Math.max(0, ripple.life);
        if (alpha <= 0) continue;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = Math.max(1.2, ratio * 0.9);
        ctx.arc(ripple.x * ratio, ripple.y * ratio, ripple.radius * ratio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ripple.radius += dt * 0.18;
        ripple.life -= dt * 0.0035;
        rippleNext.push(ripple);
      }
      ripplesRef.current = rippleNext.slice(0, MAX_RIPPLES);

      ctx.restore();
    };

    const step = (time: number) => {
      if (document.hidden) {
        lastTimeRef.current = time;
        frameHandle = window.requestAnimationFrame(step);
        return;
      }
      const last = lastTimeRef.current ?? time;
      const dt = Math.min(time - last, 32);
      lastTimeRef.current = time;
      const state = useGameStore.getState();
      if (state.phase === 'playing' || state.phase === 'storm') {
        state.tick(dt);
      }
      render(dt);
      frameHandle = window.requestAnimationFrame(step);
    };

    frameHandle = window.requestAnimationFrame(step);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameHandle);
    };
  }, [setStageSize]);

  useEffect(() => {
    if (phase === 'start') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const allowHaptics = settings.haptics && !settings.reducedMotion;
    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      const x = (event.clientX - rect.left) * ratio;
      const y = (event.clientY - rect.top) * ratio;
      const result = useGameStore.getState().tap(x, y);
      if (!result.hit) {
        if (allowHaptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(25);
        }
        return;
      }
      if (allowHaptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        if (result.drain) {
          navigator.vibrate(25);
        } else if (result.perfect) {
          navigator.vibrate(8);
        } else if (result.energy || (result.combo ?? 0) >= 3) {
          navigator.vibrate([5, 10, 5]);
        } else {
          navigator.vibrate(8);
        }
      }
      if (result.hit) {
        const baseColor = result.energy
          ? 'rgba(56,189,248,0.6)'
          : result.drain
          ? 'rgba(248,113,113,0.6)'
          : 'rgba(255,255,255,0.35)';
        const color = result.targetHit ? 'rgba(253,224,71,0.75)' : baseColor;
        particlesRef.current.unshift({
          x,
          y,
          radius: 12,
          life: 1,
          color,
        });
        particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
        if (result.perfect) {
          ripplesRef.current.unshift({ x, y, radius: 10, life: 1 });
          ripplesRef.current = ripplesRef.current.slice(0, MAX_RIPPLES);
        }
      }
    };
    const handleMove = (event: PointerEvent) => {
      if (event.buttons > 0) {
        handlePointer(event);
      }
    };
    canvas.addEventListener('pointerdown', handlePointer, { passive: true });
    canvas.addEventListener('pointermove', handleMove, { passive: true });
    return () => {
      canvas.removeEventListener('pointerdown', handlePointer);
      canvas.removeEventListener('pointermove', handleMove);
    };
  }, [settings.haptics, settings.reducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-3xl">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: activePhase ? 1 : 0,
          background: 'radial-gradient(circle at center, rgba(4,7,14,0) 40%, rgba(2,6,14,0.78) 100%)',
        }}
      />
    </div>
  );
}
