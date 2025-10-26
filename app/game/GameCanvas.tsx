'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore, type TapResult } from '@/lib/store';
import { playTapChime } from '@/lib/audio';

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
  maxLife: number;
  color: string;
  vx: number;
  vy: number;
  gravity: number;
}

type AmbientDot = {
  x: number;
  y: number;
  radius: number;
  depth: number;
  phase: number;
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const particlePoolRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);
  const gameSizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const burstShakeRef = useRef(0);
  const pointerRef = useRef({ id: null as number | null, startTime: 0, charging: false, x: 0, y: 0 });
  const ambientDotsRef = useRef<AmbientDot[]>([]);
  const [diagnostics, setDiagnostics] = useState({ width: 0, height: 0, dpr: 1, bubbles: 0 });
  if (ambientDotsRef.current.length === 0) {
    ambientDotsRef.current = Array.from({ length: 18 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 18 + Math.random() * 28,
      depth: 0.25 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  const setStageSize = useGameStore((state) => state.setStageSize);
  const phase = useGameStore((state) => state.phase);
  const settings = useGameStore((state) => state.settings);
  const unlocks = useGameStore((state) => state.unlocks);

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
    const frameEl = frameRef.current;
    const canvas = canvasRef.current;
    if (!frameEl || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let resizeFrame: number | null = null;

    const resizeCanvas = () => {
      const box = frameEl.getBoundingClientRect();
      const cssW = Math.max(1, Math.round(box.width));
      const cssH = Math.max(1, Math.round(box.height));
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gameSizeRef.current = { w: cssW, h: cssH, dpr };
      setDiagnostics((prev) =>
        prev.width === cssW && prev.height === cssH && prev.dpr === dpr
          ? prev
          : { ...prev, width: cssW, height: cssH, dpr }
      );
      setStageSize(cssW, cssH);
    };

    const scheduleResize = () => {
      if (resizeFrame !== null) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        resizeCanvas();
      });
    };

    resizeCanvas();

    const observer = new ResizeObserver(() => scheduleResize());
    observer.observe(frameEl);

    const handleViewportResize = () => scheduleResize();
    window.addEventListener('resize', handleViewportResize, { passive: true });
    window.addEventListener('orientationchange', handleViewportResize, { passive: true });
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', handleViewportResize);

    const root = document.getElementById('rubble-root');
    const mutationObserver = root
      ? new MutationObserver(scheduleResize)
      : null;
    if (mutationObserver && root) {
      mutationObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    let frameHandle: number;

    const render = (dt: number) => {
      const state = useGameStore.getState();
      const { bubbles, stats, slowTimeUntil, now, phase, burst, burstPointer, golden, hazards } = state;
      const size = gameSizeRef.current;
      const measuredWidth = size.w || state.width || canvas.clientWidth || 1;
      const measuredHeight = size.h || state.height || canvas.clientHeight || 1;
      const dpr = size.dpr || 1;
      const bubbleCount = bubbles.length;
      setDiagnostics((prev) => (prev.bubbles === bubbleCount ? prev : { ...prev, bubbles: bubbleCount }));
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, measuredWidth, measuredHeight);

      const comboIntensity = Math.min(stats.chainLen / 10, 1);
      const playingPhase = phase === 'playing' || phase === 'storm';
      const gradient = ctx.createLinearGradient(0, 0, 0, measuredHeight);
      const topAlpha = playingPhase ? 0.72 : 0.85;
      const bottomAlpha = playingPhase ? 0.88 : 0.94;
      const themeActive = state.settings.theme === 'soothing-skies' && state.unlocks.themeSkies;
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

      const allowAmbient = !prefersReducedMotion.current && !playingPhase;
      if (allowAmbient) {
        const dots = ambientDotsRef.current;
        const dotColor = themeActive ? 'rgba(148,197,255,0.08)' : 'rgba(56,189,248,0.08)';
        for (const dot of dots) {
          const offsetX = Math.sin(now / 16000 + dot.phase) * dot.depth * 36;
          const offsetY = Math.cos(now / 18000 + dot.phase) * dot.depth * 42;
          const x = dot.x * measuredWidth + offsetX;
          const y = dot.y * measuredHeight + offsetY;
          ctx.beginPath();
          ctx.fillStyle = dotColor;
          ctx.globalAlpha = 0.08;
          ctx.arc(x, y, dot.radius * (0.7 + comboIntensity * 0.25), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      const wobble = prefersReducedMotion.current ? 0 : Math.sin(now / 420) * 4;
      ctx.translate(0, wobble);

      if (!prefersReducedMotion.current && burstShakeRef.current > 0) {
        const shake = burstShakeRef.current;
        const offsetX = (Math.random() - 0.5) * shake;
        const offsetY = (Math.random() - 0.5) * shake;
        ctx.translate(offsetX, offsetY);
        burstShakeRef.current = Math.max(0, shake - dt * 0.08);
      } else {
        burstShakeRef.current = Math.max(0, burstShakeRef.current - dt * 0.06);
      }

      for (const hazard of hazards) {
        if (hazard.kind === 'poison-cloud') {
          const remaining =
            typeof hazard.expiresAt === 'number' && hazard.expiresAt > 0
              ? Math.max(0, Math.min(1, (hazard.expiresAt - now) / 4_000))
              : 1;
          const inner = ctx.createRadialGradient(hazard.x, hazard.y, hazard.r * 0.1, hazard.x, hazard.y, hazard.r);
          inner.addColorStop(0, `rgba(76,196,255,${0.16 * remaining})`);
          inner.addColorStop(1, `rgba(30,58,138,0)`);
          ctx.beginPath();
          ctx.fillStyle = inner;
          ctx.arc(hazard.x, hazard.y, hazard.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const spin = prefersReducedMotion.current ? 0 : now / 900 + (hazard.createdAt % 2000) / 200;
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
        const progress = Math.min(1, Math.max(0, (now - golden.spawnedAt) / golden.graceMs));
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
          ctx.arc(
            0,
            0,
            ringRadius,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * (1 - progress)
          );
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

      const particles = particlesRef.current;
      const remaining: Particle[] = [];
      for (const particle of particles) {
        particle.life -= dt;
        if (particle.life <= 0) {
          particlePoolRef.current.push(particle);
          continue;
        }
        const progress = Math.max(0, particle.life / particle.maxLife);
        const easedAlpha = Math.pow(progress, 0.7);
        particle.x += particle.vx * (dt / 16);
        particle.y += particle.vy * (dt / 16);
        particle.vy += particle.gravity * (dt / 16);
        ctx.beginPath();
        ctx.globalAlpha = Math.min(1, easedAlpha);
        ctx.fillStyle = particle.color;
        ctx.arc(particle.x, particle.y, Math.max(1.2, particle.radius * (0.75 + (1 - progress) * 0.35)), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        remaining.push(particle);
      }
      particlesRef.current = remaining;

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

      if (burst.charging && burstPointer) {
        const chargeElapsed = Math.max(0, Date.now() - burst.chargeStartAt);
        const progress = Math.min(chargeElapsed / burst.maxHoldMs, 1);
        const readiness = Math.min(chargeElapsed / burst.minHoldMs, 1);
        const ringRadius = 36 + 90 * progress;
        ctx.beginPath();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = burst.overcharge ? 'rgba(96,165,250,0.75)' : 'rgba(148,232,255,0.75)';
        ctx.globalAlpha = 0.95;
        ctx.arc(burstPointer.x, burstPointer.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const innerRadius = Math.max(18, ringRadius * readiness * 0.4);
        ctx.beginPath();
        ctx.fillStyle = burst.overcharge ? 'rgba(56,189,248,0.2)' : 'rgba(148,232,255,0.2)';
        ctx.arc(burstPointer.x, burstPointer.y, innerRadius, 0, Math.PI * 2);
        ctx.fill();
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
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('orientationchange', handleViewportResize);
      viewport?.removeEventListener('resize', handleViewportResize);
      window.cancelAnimationFrame(frameHandle);
    };
  }, [setStageSize]);

  useEffect(() => {
    if (phase === 'home') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;
      const { w, h, dpr } = gameSizeRef.current;
      ctx.setTransform(dpr || 1, 0, 0, dpr || 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w || canvas.clientWidth || canvas.width, h || canvas.clientHeight || canvas.height);
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const allowHaptics = settings.haptics && !settings.reducedMotion;
    const allowSound = settings.sound;
    const sparkleEnabled = unlocks.fxSparkle && settings.sparkleFx && !settings.reducedMotion;

    const vibrate = (pattern: number | number[]) => {
      if (!allowHaptics) return;
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
      navigator.vibrate(pattern);
    };

    const spawnParticle = ({
      x,
      y,
      color,
      radius,
      life,
      vx = 0,
      vy = 0,
      gravity = 0.001,
    }: {
      x: number;
      y: number;
      color: string;
      radius: number;
      life: number;
      vx?: number;
      vy?: number;
      gravity?: number;
    }) => {
      const pool = particlePoolRef.current;
      const particle = pool.pop() ?? {
        x: 0,
        y: 0,
        radius: 0,
        life: 0,
        maxLife: 0,
        color: '',
        vx: 0,
        vy: 0,
        gravity: 0,
      };
      particle.x = x;
      particle.y = y;
      particle.radius = radius;
      particle.life = life;
      particle.maxLife = life;
      particle.color = color;
      particle.vx = vx;
      particle.vy = vy;
      particle.gravity = gravity;
      particlesRef.current.unshift(particle);
      if (particlesRef.current.length > MAX_PARTICLES) {
        const removed = particlesRef.current.pop();
        if (removed) {
          pool.push(removed);
        }
      }
    };

    const pushRipple = (ripple: Ripple) => {
      ripplesRef.current.unshift(ripple);
      if (ripplesRef.current.length > 10) {
        ripplesRef.current.length = 10;
      }
    };

    const resolveResult = (result: TapResult | null, x: number, y: number) => {
      if (!result) return;
      if (result.burst) {
        vibrate([0, 18, 12, 40]);
        if (allowSound) {
          playTapChime({ pitch: result.golden ? 840 : 560 });
        }
        const rippleColor = result.golden
          ? result.goldenToxic
            ? 'rgba(248,113,113,0.45)'
            : 'rgba(253,224,71,0.45)'
          : 'rgba(56,189,248,0.45)';
        const maxRadius = Math.max(result.radius ?? 200, 140);
        pushRipple({ x, y, progress: 0, maxRadius, color: rippleColor });
        if (!prefersReducedMotion.current) {
          burstShakeRef.current = Math.max(burstShakeRef.current, result.hit ? 14 : 8);
        }
        const burstParticles = Math.max(8, Math.min(18, (result.poppedIds?.length ?? 4) + 6));
        for (let index = 0; index < burstParticles; index += 1) {
          const theta = (Math.PI * 2 * index) / burstParticles;
          const speed = 0.18 + Math.random() * 0.08;
          spawnParticle({
            x,
            y,
            radius: 7 + Math.random() * 4,
            life: 420,
            color: rippleColor,
            vx: Math.cos(theta) * speed,
            vy: Math.sin(theta) * speed,
            gravity: 0.0012,
          });
        }
        if (result.golden) {
          spawnParticle({
            x,
            y,
            radius: 18,
            life: 520,
            color: result.goldenToxic ? 'rgba(248,113,113,0.6)' : 'rgba(253,224,71,0.7)',
            vx: 0,
            vy: -0.08,
            gravity: 0.001,
          });
        }
        return;
      }

      if (!result.hit) {
        vibrate(25);
        if (result.drain && allowSound) {
          playTapChime({ pitch: 320 });
        }
        return;
      }

      if (result.golden) {
        vibrate(result.goldenToxic ? 35 : [10, 20, 10]);
        if (allowSound) {
          playTapChime({ perfect: !result.goldenToxic, pitch: result.goldenToxic ? 420 : 920 });
        }
        const color = result.goldenToxic ? 'rgba(248,113,113,0.6)' : 'rgba(253,224,71,0.65)';
        spawnParticle({ x, y, radius: 14, life: 520, color, vy: -0.06, gravity: 0.0012 });
        const rippleColor = result.goldenToxic ? 'rgba(248,113,113,0.45)' : 'rgba(253,224,71,0.45)';
        pushRipple({ x, y, progress: 0, maxRadius: 160, color: rippleColor });
        if (!prefersReducedMotion.current && !result.goldenToxic) {
          burstShakeRef.current = Math.max(burstShakeRef.current, 6);
        }
        return;
      }

      if (allowSound) {
        playTapChime({ perfect: result.perfect, pitch: result.drain ? 360 : undefined });
      }

      if (result.drain) {
        vibrate(25);
      } else if (result.energy || (result.combo ?? 0) >= 3) {
        vibrate([5, 10, 5]);
      } else {
        vibrate(8);
      }

      const color = result.energy
        ? 'rgba(56,189,248,0.6)'
        : result.drain
        ? 'rgba(248,113,113,0.6)'
        : result.targetHit
        ? 'rgba(56,189,248,0.65)'
        : 'rgba(255,255,255,0.35)';
      const baseCount = result.perfect ? 8 : 6;
      for (let index = 0; index < baseCount; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.12 + Math.random() * 0.08;
        spawnParticle({
          x,
          y,
          radius: 6 + Math.random() * 3,
          life: 360,
          color,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.02,
          gravity: 0.001,
        });
      }
      if (allowSound && result.hit && !result.burst) {
        playTapChime({ perfect: result.perfect });
      }

      if (result.perfect && !prefersReducedMotion.current) {
        const rippleColor = result.targetHit ? 'rgba(56,189,248,0.45)' : 'rgba(148,232,255,0.4)';
        const maxRadius = Math.max(result.radius ?? 36, 28) * 2.8;
        pushRipple({ x, y, progress: 0, maxRadius, color: rippleColor });
      }
      if (sparkleEnabled && result.perfect) {
        for (let index = 0; index < 4; index += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.16 + Math.random() * 0.05;
          spawnParticle({
            x,
            y,
            radius: 3,
            life: 300,
            color: 'rgba(255,255,255,0.7)',
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 0.0008,
          });
        }
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const began = useGameStore.getState().beginBurstCharge(x, y);
      pointerRef.current = {
        id: event.pointerId,
        startTime: performance.now(),
        charging: began,
        x,
        y,
      };
      if (began) {
        useGameStore.getState().updateBurstPointer(x, y);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      const pointer = pointerRef.current;
      if (pointer.id !== event.pointerId) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.x = x;
      pointer.y = y;
      if (pointer.charging) {
        useGameStore.getState().updateBurstPointer(x, y);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      const pointer = pointerRef.current;
      if (pointer.id !== event.pointerId) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const store = useGameStore.getState();
      const holdMs = performance.now() - pointer.startTime;
      let handled = false;
      if (pointer.charging) {
        const burstState = store.burst;
        if (holdMs >= burstState.minHoldMs && Date.now() >= burstState.readyAt) {
          const burstResult = store.fireBurst(x, y, holdMs);
          resolveResult(burstResult, x, y);
          handled = true;
        } else {
          store.cancelBurstCharge();
        }
      }
      if (!handled) {
        const tapResult = store.tap(x, y);
        resolveResult(tapResult, x, y);
      }
      pointerRef.current = { id: null, startTime: 0, charging: false, x: 0, y: 0 };
    };

    const handlePointerCancel = () => {
      const pointer = pointerRef.current;
      if (pointer.charging) {
        useGameStore.getState().cancelBurstCharge();
      }
      pointerRef.current = { id: null, startTime: 0, charging: false, x: 0, y: 0 };
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
    canvas.addEventListener('pointercancel', handlePointerCancel);
    canvas.addEventListener('pointerleave', handlePointerCancel);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      canvas.removeEventListener('pointerleave', handlePointerCancel);
    };
  }, [settings.haptics, settings.reducedMotion, settings.sound, settings.sparkleFx, unlocks.fxSparkle]);

  return (
    <div ref={frameRef} className="app-frame__inner overflow-hidden rounded-3xl bg-slate-950/40">
      <canvas ref={canvasRef} className="app-canvas" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 left-2 z-[99] rounded-md bg-black/60 px-2 py-1 text-[10px] font-mono text-emerald-300 shadow-lg shadow-black/40"
      >
        w:{Math.round(diagnostics.width)} h:{Math.round(diagnostics.height)} DPR:{diagnostics.dpr.toFixed(2)} bubbles:{diagnostics.bubbles}
      </div>
    </div>
  );
}
