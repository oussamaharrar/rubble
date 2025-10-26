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
const BURST_MAX_RADIUS = 240;
const BURST_MIN_RADIUS_RATIO = 0.35;
const BURST_OVERCHARGE_MULTIPLIER = 1.3;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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

type StoreState = ReturnType<typeof useGameStore.getState>;
type TapResult = ReturnType<StoreState['tap']>;
type BurstResult = ReturnType<StoreState['fireBurst']>;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);
  const dprRef = useRef(1);
  const sizeRef = useRef({ width: 0, height: 0 });
  const pointerRef = useRef<{ id: number; x: number; y: number; active: boolean }>({
    id: -1,
    x: 0,
    y: 0,
    active: false,
  });
  const burstShakeRef = useRef(0);

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
      let offsetX = 0;
      let offsetY = wobble;
      const currentShake = burstShakeRef.current;
      if (currentShake > 0) {
        const shakeAngle = (now / 120) % (Math.PI * 2);
        offsetX += Math.sin(shakeAngle * 2.4) * currentShake;
        offsetY += Math.cos(shakeAngle * 3.1) * currentShake * 0.65;
        burstShakeRef.current = Math.max(0, currentShake - dt * 0.08);
      }
      ctx.translate(offsetX, offsetY);

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
        const elapsed = now - golden.spawnedAt;
        const graceProgress = golden.graceMs > 0 ? clamp(elapsed / golden.graceMs, 0, 1) : 1;
        const fillColor = golden.toxic ? '#34d399' : '#fde68a';
        const borderColor = golden.toxic ? 'rgba(16,185,129,0.85)' : 'rgba(234,179,8,0.95)';
        const haloColor = golden.toxic ? 'rgba(16,185,129,0.28)' : 'rgba(253,224,71,0.32)';
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = haloColor;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.fillStyle = fillColor;
        ctx.arc(golden.x, golden.y, golden.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = borderColor;
        ctx.stroke();

        const pulse = prefersReducedMotion.current ? 0 : Math.sin(now / 200) * 0.12;
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = haloColor;
        ctx.globalAlpha = golden.toxic ? 0.35 : 0.5;
        ctx.arc(golden.x, golden.y, golden.r * (1.8 + pulse), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (!golden.toxic) {
          ctx.beginPath();
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(253,224,71,0.85)';
          const sweep = Math.PI * 2 * (1 - graceProgress);
          ctx.arc(golden.x, golden.y, golden.r * 1.9, -Math.PI / 2, -Math.PI / 2 + sweep, false);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.setLineDash([8, 6]);
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(16,185,129,0.6)';
          ctx.arc(golden.x, golden.y, golden.r * 1.9, 0, Math.PI * 2);
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

      if (burst.charging && pointerRef.current.active) {
        const holdMs = Math.max(0, now - burst.chargeStartAt);
        const ratio = clamp(holdMs / burst.maxHoldMs, BURST_MIN_RADIUS_RATIO, 1);
        const baseRadius = BURST_MAX_RADIUS * ratio;
        const effectiveRadius = burst.overcharge ? baseRadius * BURST_OVERCHARGE_MULTIPLIER : baseRadius;
        const alpha = clamp(holdMs / burst.minHoldMs, 0.2, 1);
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = burst.overcharge ? 'rgba(56,189,248,0.85)' : 'rgba(255,255,255,0.75)';
        ctx.globalAlpha = alpha;
        ctx.arc(pointerRef.current.x, pointerRef.current.y, Math.max(48, effectiveRadius * 0.45), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = burst.overcharge ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.35)';
        ctx.arc(pointerRef.current.x, pointerRef.current.y, Math.max(28, effectiveRadius * 0.3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
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

    const vibrate = (pattern: number | number[]) => {
      if (!allowHaptics) return;
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    };

    const handleTapVisuals = (result: TapResult, x: number, y: number) => {
      if (!result.hit) {
        vibrate(25);
        return;
      }

      if (result.golden) {
        vibrate(result.toxic ? [25, 40, 25] : [8, 24, 32]);
      } else if (result.drain) {
        vibrate(25);
      } else if (result.energy || (result.combo ?? 0) >= 3) {
        vibrate([5, 12, 5]);
      } else {
        vibrate(8);
      }

      const color = result.golden
        ? result.toxic
          ? 'rgba(248,113,113,0.65)'
          : 'rgba(253,224,71,0.65)'
        : result.energy
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

      const shouldRipple =
        (!result.golden && result.perfect && !prefersReducedMotion.current) ||
        (result.golden && !result.toxic && !prefersReducedMotion.current);

      if (shouldRipple) {
        const rippleColor = result.golden
          ? 'rgba(253,224,71,0.45)'
          : result.targetHit
          ? 'rgba(56,189,248,0.45)'
          : 'rgba(148,232,255,0.4)';
        const baseRadius = result.radius ?? 36;
        const maxRadius = Math.max(baseRadius, 28) * (result.golden ? 3.2 : 2.8);
        ripplesRef.current.unshift({ x, y, progress: 0, maxRadius, color: rippleColor });
        ripplesRef.current = ripplesRef.current.slice(0, 8);
      }
    };

    const handleBurstVisuals = (result: BurstResult, x: number, y: number) => {
      if (!result.fired) return;
      const baseColor = result.drainHits > 0
        ? 'rgba(248,113,113,0.55)'
        : result.targetHit
        ? 'rgba(56,189,248,0.55)'
        : result.overcharged
        ? 'rgba(56,189,248,0.45)'
        : 'rgba(255,255,255,0.4)';

      const rippleRadius = Math.max(result.radius * 1.2, 140);
      ripplesRef.current.unshift({ x, y, progress: 0, maxRadius: rippleRadius, color: baseColor });
      ripplesRef.current = ripplesRef.current.slice(0, 8);

      if (!prefersReducedMotion.current) {
        const particleCount = Math.min(24, Math.max(12, result.popped.length * 3));
        for (let index = 0; index < particleCount; index += 1) {
          const angle = (index / particleCount) * Math.PI * 2;
          const radius = 10 + (index % 4);
          particlesRef.current.unshift({
            x: x + Math.cos(angle) * 18,
            y: y + Math.sin(angle) * 18,
            radius,
            life: 1,
            color: baseColor,
          });
        }
        particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
      }

      burstShakeRef.current = Math.min(18, 8 + result.radius / 30);
      vibrate(result.overcharged ? [15, 45, 15] : [10, 30, 10]);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      if (pointerRef.current.active) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerRef.current = { id: event.pointerId, x, y, active: true };
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture errors
      }
      useGameStore.getState().beginBurstCharge(x, y);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      if (!pointerRef.current.active || pointerRef.current.id !== event.pointerId) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = event.clientX - rect.left;
      pointerRef.current.y = event.clientY - rect.top;
    };

    const finalizePointer = (event: PointerEvent, cancelled: boolean) => {
      if (!pointerRef.current.active || pointerRef.current.id !== event.pointerId) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerRef.current = { id: -1, x, y, active: false };
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore release errors
      }

      const store = useGameStore.getState();
      if (cancelled) {
        store.cancelBurstCharge();
        return;
      }

      const burstState = store.burst;
      if (burstState.charging) {
        const holdMs = Math.max(0, store.now - burstState.chargeStartAt);
        if (holdMs >= burstState.minHoldMs && store.now >= burstState.readyAt) {
          const burstResult = store.fireBurst(x, y);
          if (burstResult.fired) {
            handleBurstVisuals(burstResult, x, y);
            return;
          }
        }
        store.cancelBurstCharge();
      }

      const tapResult = store.tap(x, y);
      handleTapVisuals(tapResult, x, y);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      finalizePointer(event, false);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      finalizePointer(event, true);
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
    };
  }, [settings.haptics, settings.reducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-3xl">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
    </div>
  );
}
