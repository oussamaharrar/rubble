'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore, type TapResult } from '@/lib/store';
import { playTapChime } from '@/lib/audio';
import { renderBackground } from './renderers/background';
import { renderWorld } from './renderers/world';
import { renderEffects } from './renderers/effects';
import type { AmbientDot, Particle, Ripple } from './renderers/types';

const MAX_PARTICLES = 32;

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
  const [frameStats, setFrameStats] = useState({
    width: 0,
    height: 0,
    dpr: 1,
    bufferWidth: 0,
    bufferHeight: 0,
    fps: 0,
    bubbles: 0,
  });
  const [diagOn, setDiagOn] = useState(false);
  const statsRef = useRef(frameStats);
  if (ambientDotsRef.current.length === 0) {
    ambientDotsRef.current = Array.from({ length: 18 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 18 + Math.random() * 28,
      depth: 0.25 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  useEffect(() => {
    statsRef.current = frameStats;
  }, [frameStats]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const enabled = localStorage.getItem('rubble:diag') === 'true';
    setDiagOn(enabled);
  }, []);

  const setStageSize = useGameStore((state) => state.setStageSize);
  const phase = useGameStore((state) => state.phase);
  const settings = useGameStore((state) => state.settings);
  const unlocks = useGameStore((state) => state.unlocks);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Rubble] RENDER PATHS:', {
        bg: typeof renderBackground === 'function',
        world: typeof renderWorld === 'function',
        fx: typeof renderEffects === 'function',
      });
    }
  }, []);

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
      const cssW = Math.max(1, Math.floor(box.width));
      const cssH = Math.max(1, Math.floor(box.height));
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gameSizeRef.current = { w: cssW, h: cssH, dpr };
      setFrameStats((prev) => {
        const next = {
          ...prev,
          width: cssW,
          height: cssH,
          dpr,
          bufferWidth: canvas.width,
          bufferHeight: canvas.height,
        };
        return prev.width !== next.width ||
          prev.height !== next.height ||
          prev.dpr !== next.dpr ||
          prev.bufferWidth !== next.bufferWidth ||
          prev.bufferHeight !== next.bufferHeight
          ? next
          : prev;
      });
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

    const root = document.getElementById('rubble-root');
    const mutationObserver = root
      ? new MutationObserver(scheduleResize)
      : null;
    if (mutationObserver && root) {
      mutationObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    let frameHandle: number;

    const render = (dt: number) => {
      const prevStats = statsRef.current;
      const prevFps = prevStats.fps;
      const instFps = dt > 0 ? 1000 / Math.max(dt, 1) : 0;
      const smoothFps = prevFps ? prevFps * 0.9 + instFps * 0.1 : instFps;
      prevStats.fps = smoothFps;
      if (diagOn && Math.abs(smoothFps - prevFps) > 0.25) {
        setFrameStats((prev) => (Math.abs(prev.fps - smoothFps) > 0.25 ? { ...prev, fps: smoothFps } : prev));
      }
      const state = useGameStore.getState();
      const { bubbles } = state;
      const bubbleCount = bubbles.length;
      if (statsRef.current.bubbles !== bubbleCount) {
        statsRef.current.bubbles = bubbleCount;
        setFrameStats((prev) =>
          prev.bubbles !== bubbleCount ? { ...prev, bubbles: bubbleCount } : prev
        );
      }
      const rect = canvas.getBoundingClientRect();
      const size = gameSizeRef.current;
      const measuredWidth = Math.max(1, rect.width || size.w || state.width || canvas.clientWidth || 1);
      const measuredHeight = Math.max(1, rect.height || size.h || state.height || canvas.clientHeight || 1);
      const dpr = size.dpr || 1;
      const renderRect = { width: measuredWidth, height: measuredHeight };
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, measuredWidth, measuredHeight);
      renderBackground(ctx, renderRect, state, {
        ambientDots: ambientDotsRef.current,
        prefersReducedMotion: prefersReducedMotion.current,
      });

      const wobble = prefersReducedMotion.current ? 0 : Math.sin(state.now / 420) * 4;
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
      renderWorld(ctx, renderRect, state, {
        prefersReducedMotion: prefersReducedMotion.current,
      });

      const effectsResult = renderEffects(ctx, renderRect, state, {
        dt,
        particles: particlesRef.current,
        particlePool: particlePoolRef.current,
        ripples: ripplesRef.current,
      });
      particlesRef.current = effectsResult.particles;
      ripplesRef.current = effectsResult.ripples;

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
      window.cancelAnimationFrame(frameHandle);
    };
  }, [diagOn, setStageSize]);

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

  const diagText = diagOn
    ? `DPR ${frameStats.dpr.toFixed(2)} | CSS ${Math.round(frameStats.width)}×${Math.round(frameStats.height)}\nBUF ${frameStats.bufferWidth}×${frameStats.bufferHeight} | FPS ${frameStats.fps.toFixed(1)} | BUB ${frameStats.bubbles}`
    : '';

  return (
    <div ref={frameRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} className="app-canvas" />
      <div className={`rbl-diag${diagOn ? ' rbl-diag--on' : ''}`} role="status" aria-live="polite">
        {diagText}
      </div>
    </div>
  );
}
