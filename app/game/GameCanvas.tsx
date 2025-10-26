'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playTapChime } from '@/lib/audio';
import { useGameStore, type TapResult } from '@/lib/store';

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
  const sizeRef = useRef({ width: 0, height: 0 });
  const burstShakeRef = useRef(0);
  const pointerRef = useRef({ id: null as number | null, startTime: 0, charging: false, x: 0, y: 0 });
  const promptTimerRef = useRef<number | null>(null);
  const tapHintTimerRef = useRef<number | null>(null);
  const microProgressRef = useRef({ tap: false, perfect: false, burst: false });
  const microTargetShownRef = useRef(false);
  const microEnabledRef = useRef(true);
  const [prompt, setPrompt] = useState<{ id: number; message: string } | null>(null);

  const setStageSize = useGameStore((state) => state.setStageSize);
  const phase = useGameStore((state) => state.phase);
  const settings = useGameStore((state) => state.settings);
  const unlocks = useGameStore((state) => state.unlocks);

  const maybePersistMicro = useCallback(() => {
    if (!microEnabledRef.current) return;
    const progress = microProgressRef.current;
    if (progress.tap && progress.perfect && progress.burst) {
      microEnabledRef.current = false;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('rubble:tutorial-micro', '1');
        } catch {
          // ignore storage errors
        }
      }
    }
  }, []);

  const showPrompt = useCallback(
    (message: string, duration = 2200) => {
      if (!microEnabledRef.current) return;
      if (promptTimerRef.current) {
        window.clearTimeout(promptTimerRef.current);
      }
      const id = Date.now();
      setPrompt({ id, message });
      promptTimerRef.current = window.setTimeout(() => {
        setPrompt((current) => (current && current.id === id ? null : current));
      }, duration);
    },
    [setPrompt]
  );

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
      const { bubbles, stats, slowTimeUntil, now, phase, burst, burstPointer, golden, settings: liveSettings, unlocks: liveUnlocks } = state;
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
      const themeSkiesActive = liveUnlocks.themeSkies && liveSettings.theme === 'skies';
      if (themeSkiesActive) {
        const wave = prefersReducedMotion.current ? 0 : Math.sin(now / 1800) * 12;
        gradient.addColorStop(0, `rgba(${42 + wave},${96 + wave * 0.6},${176 + wave * 0.8},${topAlpha})`);
        gradient.addColorStop(1, `rgba(${16 + wave * 0.3},${42 + wave * 0.5},${112 + wave * 0.7},${bottomAlpha})`);
      } else {
        gradient.addColorStop(0, `rgba(${18 + comboIntensity * 40},${24 + comboIntensity * 20},${43 + comboIntensity * 32},${topAlpha})`);
        gradient.addColorStop(1, `rgba(10,13,23,${bottomAlpha})`);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, measuredWidth, measuredHeight);

      if (themeSkiesActive && !prefersReducedMotion.current) {
        const cloudCount = 6;
        for (let index = 0; index < cloudCount; index += 1) {
          const progress = ((now / 1000 + index * 57) % 24) / 24;
          const cloudX = measuredWidth * ((index % 2 === 0 ? progress : 1 - progress) * 1.2 - 0.1);
          const cloudY = measuredHeight * (0.15 + (index / cloudCount) * 0.35);
          const cloudR = 60 + index * 12;
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.arc(cloudX, cloudY, cloudR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

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
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
      navigator.vibrate(pattern);
    };

    const resolveResult = (result: TapResult | null, x: number, y: number) => {
      if (!result) return;
      if (result.burst) {
        vibrate([0, 18, 12, 40]);
        if (settings.sound && result.hit) {
          playTapChime({ pitch: result.golden ? 840 : 520 });
        }
        if (result.hit && microEnabledRef.current && !microProgressRef.current.burst) {
          microProgressRef.current.burst = true;
          showPrompt('Burst ready!', 1600);
          maybePersistMicro();
        }
        const sparkleActive = unlocks.fxSparkle && settings.particleStyle === 'sparkle';
        const rippleColor = result.golden
          ? result.goldenToxic
            ? 'rgba(248,113,113,0.45)'
            : 'rgba(253,224,71,0.45)'
          : 'rgba(56,189,248,0.45)';
        const maxRadius = Math.max(result.radius ?? 200, 140);
        ripplesRef.current.unshift({ x, y, progress: 0, maxRadius, color: rippleColor });
        ripplesRef.current = ripplesRef.current.slice(0, 10);
        if (!prefersReducedMotion.current) {
          burstShakeRef.current = Math.max(burstShakeRef.current, result.hit ? 14 : 8);
        }
        const burstParticles = Math.max(6, Math.min(16, (result.poppedIds?.length ?? 4) + 4));
        for (let index = 0; index < burstParticles; index += 1) {
          const theta = (Math.PI * 2 * index) / burstParticles;
          const distance = (result.radius ?? 160) * 0.35;
          particlesRef.current.unshift({
            x: x + Math.cos(theta) * distance,
            y: y + Math.sin(theta) * distance,
            radius: 10,
            life: 0.9,
            color: rippleColor,
          });
        }
        if (sparkleActive) {
          for (let index = 0; index < 12; index += 1) {
            const theta = (Math.PI * 2 * index) / 12 + Math.random() * 0.2;
            particlesRef.current.unshift({
              x: x + Math.cos(theta) * 24,
              y: y + Math.sin(theta) * 24,
              radius: 5,
              life: 0.7,
              color: 'rgba(255,255,255,0.55)',
            });
          }
        }
        if (result.golden) {
          particlesRef.current.unshift({
            x,
            y,
            radius: 16,
            life: 1,
            color: result.goldenToxic ? 'rgba(248,113,113,0.6)' : 'rgba(253,224,71,0.65)',
          });
        }
        particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
        return;
      }

      if (!result.hit) {
        vibrate(25);
        if (settings.sound) {
          playTapChime({ pitch: 420 });
        }
        return;
      }

      if (microEnabledRef.current && !microProgressRef.current.tap) {
        microProgressRef.current.tap = true;
        if (tapHintTimerRef.current) {
          window.clearTimeout(tapHintTimerRef.current);
          tapHintTimerRef.current = null;
        }
        setPrompt(null);
        maybePersistMicro();
      }

      if (result.golden) {
        vibrate(result.goldenToxic ? 35 : [10, 20, 10]);
        if (settings.sound) {
          playTapChime({ perfect: !result.goldenToxic, pitch: result.goldenToxic ? 480 : 920 });
        }
        const color = result.goldenToxic ? 'rgba(248,113,113,0.6)' : 'rgba(253,224,71,0.65)';
        particlesRef.current.unshift({ x, y, radius: 14, life: 1, color });
        particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
        const rippleColor = result.goldenToxic ? 'rgba(248,113,113,0.45)' : 'rgba(253,224,71,0.45)';
        ripplesRef.current.unshift({ x, y, progress: 0, maxRadius: 160, color: rippleColor });
        ripplesRef.current = ripplesRef.current.slice(0, 8);
        if (!prefersReducedMotion.current && !result.goldenToxic) {
          burstShakeRef.current = Math.max(burstShakeRef.current, 6);
        }
        return;
      }

      if (settings.sound) {
        playTapChime({ perfect: Boolean(result.perfect), pitch: result.targetHit ? 780 : result.energy ? 680 : 560 });
      }

      if (result.drain) {
        vibrate(25);
      } else if (result.energy || (result.combo ?? 0) >= 3) {
        vibrate([5, 10, 5]);
      } else {
        vibrate(8);
      }

      if (microEnabledRef.current) {
        if (result.perfect && !microProgressRef.current.perfect) {
          microProgressRef.current.perfect = true;
          showPrompt('Perfect! Hit the center glow.', 1800);
          maybePersistMicro();
        } else if (result.targetHit && !microTargetShownRef.current) {
          microTargetShownRef.current = true;
          showPrompt('Target hit! Watch the color pill.', 2000);
        }
      }

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
      const sparkleActive = unlocks.fxSparkle && settings.particleStyle === 'sparkle';
      if (result.perfect && !prefersReducedMotion.current) {
        const rippleColor = result.targetHit ? 'rgba(56,189,248,0.45)' : 'rgba(148,232,255,0.4)';
        const maxRadius = Math.max(result.radius ?? 36, 28) * 2.8;
        ripplesRef.current.unshift({ x, y, progress: 0, maxRadius, color: rippleColor });
        ripplesRef.current = ripplesRef.current.slice(0, 8);
        if (sparkleActive) {
          for (let index = 0; index < 6; index += 1) {
            const theta = (Math.PI * 2 * index) / 6 + Math.random() * 0.4;
            particlesRef.current.unshift({
              x: x + Math.cos(theta) * 12,
              y: y + Math.sin(theta) * 12,
              radius: 4,
              life: 0.8,
              color: 'rgba(255,255,255,0.6)',
            });
          }
          particlesRef.current = particlesRef.current.slice(0, MAX_PARTICLES);
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
  }, [
    settings.haptics,
    settings.reducedMotion,
    settings.sound,
    settings.particleStyle,
    unlocks.fxSparkle,
    showPrompt,
    maybePersistMicro,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem('rubble:tutorial-micro') === '1') {
        microEnabledRef.current = false;
      }
    } catch {
      microEnabledRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (promptTimerRef.current) {
        window.clearTimeout(promptTimerRef.current);
      }
      if (tapHintTimerRef.current) {
        window.clearTimeout(tapHintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!microEnabledRef.current) return;
    if (phase === 'playing' && !microProgressRef.current.tap) {
      if (tapHintTimerRef.current) {
        window.clearTimeout(tapHintTimerRef.current);
      }
      tapHintTimerRef.current = window.setTimeout(() => {
        if (!microEnabledRef.current) {
          return;
        }
        if (promptTimerRef.current) {
          window.clearTimeout(promptTimerRef.current);
        }
        const id = Date.now();
        setPrompt({ id, message: 'Tap a bubble' });
        promptTimerRef.current = window.setTimeout(() => {
          setPrompt((current) => (current && current.id === id ? null : current));
        }, 2200);
      }, 3000);
    } else if (tapHintTimerRef.current) {
      window.clearTimeout(tapHintTimerRef.current);
      tapHintTimerRef.current = null;
    }
  }, [phase, setPrompt]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-3xl">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      {prompt ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 shadow-lg shadow-black/40">
            {prompt.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}
