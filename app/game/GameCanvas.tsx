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

const MAX_PARTICLES = 42;

type ParticleKind = 'burst' | 'ripple' | 'label';

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  radius: number;
  life: number;
  color: string;
  text?: string;
  velocity?: number;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);

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
      const { bubbles, width, stats, slowTimeUntil, now, phase, target } = state;
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

      const targetActive = target.active && now < target.expiresAt;
      const targetColor = target.color;

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

        if (targetActive && bubble.color === targetColor && !bubble.poison) {
          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.setLineDash([4, 6]);
          ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      const particles = particlesRef.current;
      const remaining: Particle[] = [];
      for (const particle of particles) {
        const alpha = Math.max(0, particle.life);
        if (alpha <= 0) {
          continue;
        }
        if (particle.kind === 'burst') {
          const radius = particle.radius * ratio;
          ctx.beginPath();
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha;
          ctx.arc(particle.x * ratio, particle.y * ratio, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          particle.life -= dt * 0.0025;
          particle.radius += dt * 0.04;
        } else if (particle.kind === 'ripple') {
          ctx.beginPath();
          ctx.globalAlpha = alpha * 0.8;
          ctx.strokeStyle = particle.color;
          ctx.lineWidth = 2;
          ctx.arc(particle.x * ratio, particle.y * ratio, particle.radius * ratio, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          particle.life -= dt * 0.0016;
          particle.radius += dt * 0.22;
        } else if (particle.kind === 'label') {
          ctx.globalAlpha = alpha;
          ctx.font = `600 ${Math.max(14, 18 * alpha)}px 'Inter', sans-serif`;
          ctx.fillStyle = particle.color;
          ctx.textAlign = 'center';
          ctx.fillText(particle.text ?? '', particle.x * ratio, particle.y * ratio);
          ctx.globalAlpha = 1;
          particle.y += (particle.velocity ?? -0.04) * dt;
          particle.life -= dt * 0.0012;
        }
        remaining.push(particle);
      }
      particlesRef.current = remaining.slice(0, MAX_PARTICLES);

      ctx.restore();
    };

    const step = (time: number) => {
      if (document.hidden) {
        lastTimeRef.current = time;
        frameHandle = window.requestAnimationFrame(step);
        return;
      }
      const last = lastTimeRef.current ?? time;
      const dt = Math.min(time - last, 16);
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
      if (event.cancelable) {
        event.preventDefault();
      }
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
        } else if (result.energy || (result.combo ?? 0) >= 3) {
          navigator.vibrate([5, 10, 5]);
        } else if (result.perfect) {
          navigator.vibrate(10);
        } else {
          navigator.vibrate(8);
        }
      }
      if (result.hit) {
        const color = result.energy ? 'rgba(56,189,248,0.6)' : result.drain ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.35)';
        const payload: Particle[] = [
          {
            kind: 'burst',
            x,
            y,
            radius: 12,
            life: 1,
            color,
          },
        ];
        if (result.perfect && !prefersReducedMotion.current) {
          payload.push({
            kind: 'ripple',
            x,
            y,
            radius: 18,
            life: 0.9,
            color: 'rgba(173,216,255,0.7)',
          });
          payload.push({
            kind: 'label',
            x,
            y: y - 26,
            radius: 0,
            life: 1,
            color: 'rgba(255,255,255,0.92)',
            text: 'Perfect',
            velocity: -0.035,
          });
        }
        particlesRef.current = [...payload, ...particlesRef.current].slice(0, MAX_PARTICLES);
      }
    };
    const handleMove = (event: PointerEvent) => {
      if (event.buttons > 0) {
        handlePointer(event);
      }
    };
    const preventTouchScroll = (event: TouchEvent) => {
      event.preventDefault();
    };
    canvas.addEventListener('pointerdown', handlePointer, { passive: false });
    canvas.addEventListener('pointermove', handleMove, { passive: false });
    canvas.addEventListener('touchmove', preventTouchScroll, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', handlePointer);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('touchmove', preventTouchScroll);
    };
  }, [settings.haptics, settings.reducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
