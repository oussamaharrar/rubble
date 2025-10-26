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
const BURST_MIN_RADIUS = 110;
const BURST_MAX_RADIUS = 220;
const OVERCHARGE_RADIUS_SCALE = 1.3;

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
  const sizeRef = useRef({ width: 0, height: 0 });
  const burstPointerRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const chargeActiveRef = useRef(false);
  const shakeRef = useRef(0);

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
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      dprRef.current = dpr;
      sizeRef.current = { width, height };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setStageSize(width, height);
    });
    observer.observe(container);

    let frameHandle: number;

    const render = (dt: number) => {
      const state = useGameStore.getState();
      const { bubbles, stats, slowTimeUntil, now, phase, burst, golden } = state;
      const measuredWidth = sizeRef.current.width || state.width || canvas.clientWidth || 0;
      const measuredHeight = sizeRef.current.height || state.height || canvas.clientHeight || 0;
      const dpr = dprRef.current;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, measuredWidth, measuredHeight);

      const comboIntensity = Math.min(stats.chainLen / 10, 1);
      const playingPhase = phase === 'playing' || phase === 'storm';
      const gradient = ctx.createLinearGradient(0, 0, 0, measuredHeight);
      const topAlpha = playingPhase ? 0.72 : 0.85;
      const bottomAlpha = playingPhase ? 0.88 : 0.94;
      gradient.addColorStop(0, `rgba(${18 + comboIntensity * 40},${24 + comboIntensity * 20},${43 + comboIntensity * 32},${topAlpha})`);
      gradient.addColorStop(1, `rgba(10,13,23,${bottomAlpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, measuredWidth, measuredHeight);

      const slowFactor = now < slowTimeUntil ? Math.cos((now / 180) % Math.PI) : 0;
      if (slowFactor > 0) {
        const maxDim = Math.max(measuredWidth, measuredHeight);
        const vignette = ctx.createRadialGradient(
          measuredWidth / 2,
          measuredHeight / 2,
          maxDim * 0.15,
          measuredWidth / 2,
          measuredHeight / 2,
          maxDim * 0.65
        );
        vignette.addColorStop(0, 'rgba(56,189,248,0.12)');
        vignette.addColorStop(1, 'rgba(15,23,42,0.65)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, measuredWidth, measuredHeight);
      }

      const wobble = prefersReducedMotion.current ? 0 : Math.sin(now / 420) * 4;
      let shakeX = 0;
      let shakeY = 0;
      if (shakeRef.current > 0.05) {
        const shakePower = shakeRef.current;
        const angle = (now / 280) % (Math.PI * 2);
        shakeX = Math.cos(angle) * shakePower;
        shakeY = Math.sin(angle * 1.35) * shakePower;
        shakeRef.current = Math.max(0, shakePower * 0.82);
      } else {
        shakeRef.current = 0;
      }
      ctx.translate(shakeX, wobble + shakeY);

      for (const bubble of bubbles) {
        const x = bubble.x;
        const y = bubble.y;
        const r = bubble.r;
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

      if (golden.active) {
        const elapsed = Math.max(0, now - golden.spawnedAt);
        const graceFraction = golden.graceMs > 0 ? Math.min(1, elapsed / golden.graceMs) : 1;
        const ringRadius = golden.r + 18;
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = golden.toxic ? 'rgba(248,113,113,0.9)' : 'rgba(250,204,21,0.92)';
        ctx.shadowBlur = golden.toxic ? 24 : 18;
        ctx.shadowColor = golden.toxic ? 'rgba(248,113,113,0.6)' : 'rgba(250,204,21,0.6)';
        ctx.arc(golden.x, golden.y, golden.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        if (!golden.toxic) {
          ctx.strokeStyle = 'rgba(250,204,21,0.75)';
          ctx.beginPath();
          const remaining = Math.max(0, 1 - graceFraction);
          ctx.arc(golden.x, golden.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(248,113,113,0.65)';
          ctx.beginPath();
          ctx.setLineDash([6, 6]);
          ctx.arc(golden.x, golden.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      const particles = particlesRef.current;
      const remaining: Particle[] = [];
      for (const particle of particles) {
        const radius = particle.radius;
        const alpha = Math.max(0, particle.life);
        if (alpha <= 0) continue;
        ctx.beginPath();
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = alpha;
        ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
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
      ripplesRef.current = rippleRemaining.slice(0, 8);

      const burstPointer = burstPointerRef.current;
      if (burst.charging && burstPointer) {
        const holdMs = Math.min(Math.max(0, now - burst.chargeStartAt), burst.maxHoldMs);
        const progress = burst.maxHoldMs > 0 ? Math.min(1, holdMs / burst.maxHoldMs) : 1;
        let indicatorRadius = BURST_MIN_RADIUS + (BURST_MAX_RADIUS - BURST_MIN_RADIUS) * progress;
        if (burst.overcharge) {
          indicatorRadius *= OVERCHARGE_RADIUS_SCALE;
        }
        ctx.beginPath();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = burst.overcharge ? 'rgba(56,189,248,0.85)' : 'rgba(248,250,252,0.75)';
        ctx.globalAlpha = 0.9;
        ctx.arc(burstPointer.x, burstPointer.y, indicatorRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.setLineDash([12, 10]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = burst.overcharge ? 'rgba(56,189,248,0.55)' : 'rgba(250,204,21,0.45)';
        ctx.arc(
          burstPointer.x,
          burstPointer.y,
          Math.max(36, indicatorRadius * 0.6),
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * progress
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }

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

    const performTap = (x: number, y: number) => {
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
      const color = result.energy
        ? 'rgba(56,189,248,0.6)'
        : result.drain
        ? 'rgba(248,113,113,0.6)'
        : result.targetHit
        ? 'rgba(56,189,248,0.65)'
        : 'rgba(255,255,255,0.35)';
      particlesRef.current.unshift({ x, y, radius: 12, life: 1, color });
      particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
      if (result.perfect && !prefersReducedMotion.current) {
        const rippleColor = result.targetHit ? 'rgba(56,189,248,0.45)' : 'rgba(148,232,255,0.4)';
        const maxRadius = Math.max(result.radius ?? 36, 28) * 2.8;
        ripplesRef.current.unshift({ x, y, progress: 0, maxRadius, color: rippleColor });
        ripplesRef.current = ripplesRef.current.slice(0, 8);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const started = useGameStore.getState().beginBurstCharge(x, y);
      if (!started) {
        performTap(x, y);
        return;
      }
      activePointerRef.current = event.pointerId;
      burstPointerRef.current = { x, y };
      chargeActiveRef.current = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (chargeActiveRef.current && activePointerRef.current === event.pointerId) {
        if (event.pointerType === 'touch') {
          event.preventDefault();
        }
        const rect = canvas.getBoundingClientRect();
        burstPointerRef.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        return;
      }
      if (event.buttons > 0) {
        if (event.pointerType === 'touch') {
          event.preventDefault();
        }
        const rect = canvas.getBoundingClientRect();
        performTap(event.clientX - rect.left, event.clientY - rect.top);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!chargeActiveRef.current || activePointerRef.current !== event.pointerId) {
        return;
      }
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const result = useGameStore.getState().fireBurst(x, y);
      chargeActiveRef.current = false;
      activePointerRef.current = null;
      burstPointerRef.current = null;
      if (!result.triggered) {
        performTap(x, y);
        return;
      }
      if (allowHaptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([12, 18, 12]);
      }
      const rippleColor = result.golden === 'toxic' ? 'rgba(248,113,113,0.4)' : 'rgba(148,232,255,0.4)';
      const burstRippleRadius = Math.max(result.radius * 1.35, 120);
      ripplesRef.current.unshift({ x, y, progress: 0, maxRadius: burstRippleRadius, color: rippleColor });
      ripplesRef.current = ripplesRef.current.slice(0, 8);
      for (const bubble of result.popped.slice(0, 20)) {
        const bubbleColor = bubble.energy
          ? 'rgba(56,189,248,0.55)'
          : bubble.drain
          ? 'rgba(248,113,113,0.6)'
          : 'rgba(255,255,255,0.32)';
        particlesRef.current.unshift({
          x: bubble.x,
          y: bubble.y,
          radius: Math.max(10, bubble.r * 0.6),
          life: 1,
          color: bubbleColor,
        });
      }
      particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
      shakeRef.current = Math.min(18, 6 + result.radius * 0.08);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (chargeActiveRef.current && activePointerRef.current === event.pointerId) {
        useGameStore.getState().cancelBurstCharge();
        chargeActiveRef.current = false;
        activePointerRef.current = null;
        burstPointerRef.current = null;
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
    canvas.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    canvas.addEventListener('pointerleave', handlePointerCancel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      canvas.removeEventListener('pointerleave', handlePointerCancel);
      if (chargeActiveRef.current) {
        useGameStore.getState().cancelBurstCharge();
        chargeActiveRef.current = false;
        activePointerRef.current = null;
        burstPointerRef.current = null;
      }
    };
  }, [settings.haptics, settings.reducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-3xl">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
    </div>
  );
}
