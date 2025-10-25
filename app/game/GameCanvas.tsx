'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Bubble, BubbleColor } from '@/types/game';
import { useGameStore } from '@/lib/store';
import './styles.css';

const BASE_BUBBLE_COLORS: Record<BubbleColor, string> = {
  yellow: '#facc15',
  blue: '#38bdf8',
  green: '#4ade80',
  pink: '#f472b6',
  orange: '#fb923c',
};

const MAX_PARTICLES = 120;
const PARTICLES_PER_POP = 12;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function createBubbleId(index: number) {
  return `bubble-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const spawnTimerRef = useRef(0);
  const stormSpawnedRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);

  const getState = useGameStore.getState;
  const phase = useGameStore((state) => state.phase);
  const stats = useGameStore((state) => state.stats);

  const spawnBaseBubble = useCallback(
    (width: number, height: number, opts?: Partial<Bubble>) => {
      const colorKeys = Object.keys(BASE_BUBBLE_COLORS) as BubbleColor[];
      const color = opts?.color ?? colorKeys[Math.floor(Math.random() * colorKeys.length)];
      const radius = opts?.r ?? lerp(28, 44, Math.random());
      const x = opts?.x ?? lerp(radius, width - radius, Math.random());
      const y = opts?.y ?? height + radius + Math.random() * height * 0.3;
      const horizontalDrift = (Math.random() - 0.5) * 70;
      const verticalVelocity = 95 + Math.random() * 120;
      const bubble: Bubble = {
        id: createBubbleId(bubblesRef.current.length),
        x,
        y,
        r: radius,
        color,
        vx: opts?.vx ?? horizontalDrift,
        vy: opts?.vy ?? -verticalVelocity,
        storm: opts?.storm,
        poison: opts?.poison,
        createdAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      };
      if (getState().spawnBubble(bubble)) {
        bubblesRef.current.push(bubble);
      }
    },
    [getState]
  );

  const spawnStormOrbs = useCallback(
    (width: number, height: number) => {
      const factory = ({ drain }: { drain: boolean }) => {
        const radius = lerp(32, 52, Math.random());
        const x = lerp(radius, width - radius, Math.random());
        const y = height + radius + Math.random() * radius;
        const horizontalDrift = (Math.random() - 0.5) * (drain ? 120 : 90);
        const verticalVelocity = drain ? 180 + Math.random() * 120 : 150 + Math.random() * 90;
        return {
          id: createBubbleId(bubblesRef.current.length),
          x,
          y,
          r: radius,
          color: drain ? 'pink' : 'blue',
          vx: horizontalDrift,
          vy: -verticalVelocity,
          storm: true,
          poison: drain,
          createdAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        } satisfies Bubble;
      };
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const created = getState().spawnStormOrbs(now, factory);
      if (created.length > 0) {
        bubblesRef.current.push(...created);
      }
    },
    [getState]
  );

  const removeBubble = useCallback((bubble: Bubble) => {
    getState().removeBubble(bubble.id);
    bubblesRef.current = bubblesRef.current.filter((item) => item.id !== bubble.id);
  }, [getState]);

  const addParticles = useCallback((bubble: Bubble) => {
    const hue = BASE_BUBBLE_COLORS[bubble.color as BubbleColor] ?? '#ffffff';
    for (let i = 0; i < PARTICLES_PER_POP; i += 1) {
      if (particlesRef.current.length >= MAX_PARTICLES) {
        particlesRef.current.shift();
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      particlesRef.current.push({
        x: bubble.x,
        y: bubble.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        color: hue,
        size: lerp(2, 6, Math.random()),
      });
    }
  }, []);

  const handleTap = useCallback(
    (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let hit: Bubble | null = null;
      for (let i = bubblesRef.current.length - 1; i >= 0; i -= 1) {
        const bubble = bubblesRef.current[i];
        const dx = x - bubble.x;
        const dy = y - bubble.y;
        if (dx * dx + dy * dy <= bubble.r * bubble.r) {
          hit = bubble;
          break;
        }
      }
      getState().tapBubble(hit, { now, miss: !hit });
      if (hit) {
        addParticles(hit);
        removeBubble(hit);
      }
    },
    [addParticles, getState, removeBubble]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const suppressDefault = (event: Event) => event.preventDefault();
    canvas.addEventListener('pointerdown', handleTap);
    canvas.addEventListener('pointerup', suppressDefault);
    canvas.addEventListener('contextmenu', suppressDefault);
    return () => {
      canvas.removeEventListener('pointerdown', handleTap);
      canvas.removeEventListener('pointerup', suppressDefault);
      canvas.removeEventListener('contextmenu', suppressDefault);
    };
  }, [handleTap]);

  const resizeCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctxRef.current = ctx;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    resizeCanvas(canvas);
    const observer = new ResizeObserver(() => resizeCanvas(canvas));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const next: Particle[] = [];
    particlesRef.current.forEach((particle) => {
      const life = particle.life - dt;
      if (life <= 0) return;
      const progress = life / particle.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, progress));
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * progress, 0, Math.PI * 2);
      ctx.fill();
      next.push({
        ...particle,
        life,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        vy: particle.vy + 120 * dt,
      });
    });
    particlesRef.current = next;
    ctx.globalAlpha = 1;
  }, []);

  const updateBubbles = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number, width: number, height: number, speedFactor: number) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const next: Bubble[] = [];
      for (let i = 0; i < bubblesRef.current.length; i += 1) {
        const bubble = bubblesRef.current[i];
        bubble.x += bubble.vx * dt * speedFactor;
        bubble.y += bubble.vy * dt * speedFactor;
        bubble.vx += Math.sin(now / 600 + bubble.createdAt / 180) * 8 * dt;
        if (bubble.x < bubble.r) {
          bubble.x = bubble.r;
          bubble.vx *= -0.6;
        } else if (bubble.x > width - bubble.r) {
          bubble.x = width - bubble.r;
          bubble.vx *= -0.6;
        }
        if (bubble.y + bubble.r < -40) {
          getState().removeBubble(bubble.id);
          continue;
        }
        next.push(bubble);
        const gradient = ctx.createRadialGradient(bubble.x - bubble.r * 0.4, bubble.y - bubble.r * 0.4, bubble.r * 0.2, bubble.x, bubble.y, bubble.r);
        const baseColor = BASE_BUBBLE_COLORS[bubble.color as BubbleColor] ?? '#38bdf8';
        gradient.addColorStop(0, `${baseColor}dd`);
        gradient.addColorStop(0.5, `${baseColor}bb`);
        gradient.addColorStop(1, `${baseColor}33`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
        ctx.fill();
        if (bubble.storm && !bubble.poison) {
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.r + 6 * Math.sin(now / 200), 0, Math.PI * 2);
          ctx.stroke();
        }
        if (bubble.poison) {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      bubblesRef.current = next;
    },
    [getState]
  );

  const loop = useCallback(
    (timestamp: number) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      if (document.hidden) {
        lastTimeRef.current = timestamp;
        frameRef.current = requestAnimationFrame(loop);
        return;
      }
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = timestamp - (lastTimeRef.current ?? timestamp);
      lastTimeRef.current = timestamp;
      const dt = Math.min(elapsed, 32) / 1000;
      const store = getState();
      store.tick(timestamp);
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const speedFactor = timestamp < store.slowTimeUntil ? 0.5 : 1;
      spawnTimerRef.current += elapsed;
      const spawnInterval = store.phase === 'storm' ? 280 : 420;
      if (spawnTimerRef.current >= spawnInterval) {
        spawnTimerRef.current = 0;
        spawnBaseBubble(width, height);
      }
      if (store.phase === 'storm' && !stormSpawnedRef.current) {
        spawnStormOrbs(width, height);
        stormSpawnedRef.current = true;
      }
      if (store.phase !== 'storm') {
        stormSpawnedRef.current = false;
      }
      ctx.clearRect(0, 0, width, height);
      const comboIntensity = Math.min(1, Math.max(0, (stats.chainLen - 2) / 8));
      if (comboIntensity > 0) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, `rgba(56, 189, 248, ${0.05 + comboIntensity * 0.1})`);
        gradient.addColorStop(1, `rgba(249, 115, 22, ${0.05 + comboIntensity * 0.12})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      updateBubbles(ctx, dt, width, height, speedFactor);
      drawParticles(ctx, dt);
      frameRef.current = requestAnimationFrame(loop);
    },
    [drawParticles, getState, spawnBaseBubble, spawnStormOrbs, stats.chainLen, updateBubbles]
  );

  useEffect(() => {
    if (phase === 'playing' || phase === 'storm') {
      const state = getState();
      state.clearBubbles();
      bubblesRef.current = [];
      particlesRef.current = [];
      lastTimeRef.current = null;
      spawnTimerRef.current = 0;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(loop);
      return () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      };
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    return undefined;
  }, [loop, phase, getState]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        lastTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full touch-none" />;
}
