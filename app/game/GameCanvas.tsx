'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import type { BubbleColor } from '@/types/game';

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
const COLOR_EMOJI: Record<BubbleColor, string> = {
  yellow: '🟡',
  blue: '🔵',
  green: '🟢',
  pink: '🌸',
  orange: '🟠',
};

function targetBackground(color: BubbleColor) {
  return GLOW_MAP[color].replace('0.45', '0.18');
}

type Ripple = {
  id: number;
  x: number;
  y: number;
};

type TargetToast = {
  id: number;
  color: BubbleColor;
};

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
  const lastTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [targetToast, setTargetToast] = useState<TargetToast | null>(null);

  const setStageSize = useGameStore((state) => state.setStageSize);
  const phase = useGameStore((state) => state.phase);
  const settings = useGameStore((state) => state.settings);
  const target = useGameStore((state) => state.target);
  const gameNow = useGameStore((state) => state.now);
  const playingPhase = phase === 'playing' || phase === 'storm';
  const targetActive = Boolean(target.active && target.color && target.expiresAt > gameNow && playingPhase);
  const activeTargetColor = targetActive ? (target.color as BubbleColor) : undefined;
  const targetSeconds = targetActive ? Math.max(0, (target.expiresAt - gameNow) / 1000) : 0;
  const targetDisplay = targetActive ? targetSeconds.toFixed(1) : '';
  const targetColorHex = activeTargetColor ? COLOR_MAP[activeTargetColor] : '#f8fafc';
  const targetBg = activeTargetColor ? targetBackground(activeTargetColor) : 'rgba(255,255,255,0.08)';
  const targetEmoji = activeTargetColor ? COLOR_EMOJI[activeTargetColor] : '🎯';

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
    if (!targetToast) return;
    const timeout = window.setTimeout(() => setTargetToast(null), 800);
    return () => window.clearTimeout(timeout);
  }, [targetToast]);

  useEffect(() => {
    if (!playingPhase) {
      setTargetToast(null);
      setRipples([]);
    }
  }, [playingPhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const allowHaptics = settings.haptics && !settings.reducedMotion;
    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      const displayX = event.clientX - rect.left;
      const displayY = event.clientY - rect.top;
      const x = displayX * ratio;
      const y = displayY * ratio;
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
        } else if (result.energy) {
          navigator.vibrate([5, 10, 5]);
        } else if (result.perfect) {
          navigator.vibrate(8);
        } else if ((result.combo ?? 0) >= 3) {
          navigator.vibrate([5, 10, 5]);
        } else {
          navigator.vibrate(8);
        }
      }
      if (result.hit) {
        const color = result.energy ? 'rgba(56,189,248,0.6)' : result.drain ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.35)';
        particlesRef.current.unshift({
          x,
          y,
          radius: 12,
          life: 1,
          color,
        });
        particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
      }
      if (result.perfect) {
        setRipples((current) => [...current.slice(-3), { id: Date.now() + Math.random(), x: displayX, y: displayY }]);
      }
      if (result.target) {
        const nextColor = (result.color ?? 'yellow') as BubbleColor;
        setTargetToast({ id: Date.now() + Math.random(), color: nextColor });
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
      {playingPhase ? (
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,rgba(6,8,15,0)_45%,rgba(6,8,15,0.55)_100%)]" />
      ) : null}
      <AnimatePresence>
        {targetActive ? (
          <motion.div
            key="target-pill"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border px-4 py-1 text-xs font-semibold shadow-lg shadow-black/40"
            style={{
              borderColor: `${targetColorHex}55`,
              backgroundColor: targetBg,
              color: targetColorHex,
            }}
          >
            Target: {targetEmoji} {targetDisplay}s
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {targetToast ? (
          <motion.div
            key={targetToast.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full border px-3 py-1 text-xs font-semibold shadow-lg shadow-black/40"
            style={{
              borderColor: `${COLOR_MAP[targetToast.color]}55`,
              backgroundColor: targetBackground(targetToast.color),
              color: COLOR_MAP[targetToast.color],
            }}
          >
            Target! ×3 +2s
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="pointer-events-none absolute z-20 rounded-full border border-white/50"
            initial={{ opacity: 0.45, scale: 0 }}
            animate={{ opacity: 0, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 24,
              height: 24,
              marginLeft: -12,
              marginTop: -12,
            }}
            onAnimationComplete={() => {
              setRipples((current) => current.filter((item) => item.id !== ripple.id));
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
