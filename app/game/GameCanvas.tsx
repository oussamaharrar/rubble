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

interface Ripple {
  x: number;
  y: number;
  progress: number;
  maxRadius: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: string;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);
  const dprRef = useRef(1);

  const setStageSize = useGameStore((state) => state.setStageSize);
  const phase = useGameStore((state) => state.phase);
  const settings = useGameStore((state) => state.settings);

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
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      dprRef.current = dpr;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setStageSize(width, height);
    });
    observer.observe(container);

    let frameHandle: number;

    const render = (dt: number) => {
      const state = useGameStore.getState();
      const { bubbles, width: stageWidth, height: stageHeight, stats, slowTimeUntil, now, phase } = state;
      const dpr = dprRef.current;
      const width = stageWidth || canvas.width / dpr;
      const height = stageHeight || canvas.height / dpr;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const comboIntensity = Math.min(stats.chainLen / 10, 1);
      const playingPhase = phase === 'playing' || phase === 'storm';
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const topAlpha = playingPhase ? 0.72 : 0.85;
      const bottomAlpha = playingPhase ? 0.88 : 0.94;
      gradient.addColorStop(0, `rgba(${18 + comboIntensity * 40},${24 + comboIntensity * 20},${43 + comboIntensity * 32},${topAlpha})`);
      gradient.addColorStop(1, `rgba(10,13,23,${bottomAlpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const slowFactor = now < slowTimeUntil ? Math.cos((now / 180) % Math.PI) : 0;
      if (slowFactor > 0) {
        const radius = Math.max(width, height);
        const vignette = ctx.createRadialGradient(width / 2, height / 2, radius * 0.15, width / 2, height / 2, radius * 0.65);
        vignette.addColorStop(0, 'rgba(56,189,248,0.12)');
        vignette.addColorStop(1, 'rgba(15,23,42,0.65)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
      }

      const wobble = prefersReducedMotion.current ? 0 : Math.sin(now / 420) * 4;
      ctx.translate(0, wobble);

      for (const bubble of bubbles) {
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

      const particles = particlesRef.current;
      const remaining: Particle[] = [];
      for (const particle of particles) {
        const alpha = Math.max(0, particle.life);
        if (alpha <= 0) continue;
        ctx.beginPath();
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = alpha;
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        particle.life -= dt * 0.0025;
        particle.radius += dt * 0.04;
        remaining.push(particle);
      }
      particlesRef.current = remaining.slice(0, MAX_PARTICLES);

      const ripples = ripplesRef.current;
      const rippleRemaining: Ripple[] = [];
      for (const ripple of ripples) {
        ripple.progress += dt * 0.0015;
        if (ripple.progress >= 1) {
          continue;
        }
        const radius = Math.max(12, ripple.maxRadius * ripple.progress);
        ctx.beginPath();
        ctx.lineWidth = Math.max(1.2, 3 - ripple.progress * 2.4);
        ctx.strokeStyle = ripple.color;
        ctx.globalAlpha = Math.max(0, 0.35 - ripple.progress * 0.3);
        ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        rippleRemaining.push(ripple);
      }
      ripplesRef.current = rippleRemaining.slice(0, 8);

      ctx.restore();
    };

    const step = (time: number) => {
      if (document.hidden) {
        lastTimeRef.current = time;
        frameHandle = window.requestAnimationFrame(step);
        return;
      }
      const last = lastTimeRef.current ?? time;
      const rawDt = Math.min(time - last, 48);
      lastTimeRef.current = time;
      const state = useGameStore.getState();
      if (state.phase === 'playing' || state.phase === 'storm') {
        let remaining = Math.max(0, rawDt);
        while (remaining > 0) {
          const slice = Math.min(remaining, 10);
          state.tick(slice);
          remaining -= slice;
        }
      }
      render(rawDt);
      frameHandle = window.requestAnimationFrame(step);
    };

    frameHandle = window.requestAnimationFrame(step);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameHandle);
    };
  }, [setStageSize]);

  useEffect(() => {
    if (phase === 'home') {
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
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
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
        } else if (result.energy || (result.combo ?? 0) >= 3) {
          navigator.vibrate([5, 10, 5]);
        } else {
          navigator.vibrate(8);
        }
      }
      if (result.hit) {
        const color = result.energy
          ? 'rgba(56,189,248,0.6)'
          : result.drain
          ? 'rgba(248,113,113,0.6)'
          : result.targetHit
          ? 'rgba(56,189,248,0.65)'
          : 'rgba(255,255,255,0.35)';
        particlesRef.current.unshift({
          x,
          y,
          radius: 12,
          life: 1,
          color,
        });
        particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
        if (result.perfect && !prefersReducedMotion.current) {
          const rippleColor = result.targetHit ? 'rgba(56,189,248,0.45)' : 'rgba(148,232,255,0.4)';
          const maxRadius = Math.max(result.radius ?? 36, 28) * 2.8;
          ripplesRef.current.unshift({ x, y, progress: 0, maxRadius, color: rippleColor });
          ripplesRef.current = ripplesRef.current.slice(0, 8);
        }
      }
    };
    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      if (event.buttons > 0) {
        handlePointer(event);
      }
    };
    canvas.addEventListener('pointerdown', handlePointer, { passive: false });
    canvas.addEventListener('pointermove', handleMove, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', handlePointer);
      canvas.removeEventListener('pointermove', handleMove);
    };
  }, [settings.haptics, settings.reducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block touch-none"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
