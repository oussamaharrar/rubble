'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GameState, type ActiveBooster, type BoosterType } from '@/lib/game/types';
import './styles.css';

interface GameCanvasProps {
  state: GameState;
  soundEnabled: boolean;
  onSnapshot: (snapshot: {
    score: number;
    combo: number;
    streak: number;
    colorChain: number;
    fever: boolean;
    rush: boolean;
    lives: number;
  }) => void;
  onGameOver: () => void;
  onActiveBoostersChange: (boosters: ActiveBooster[]) => void;
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  hue: number;
  colorIndex: number;
  alive: boolean;
  pulse: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  hue: number;
  size: number;
}

const COLORS = [
  { hue: 200, saturation: 80, lightness: 65 },
  { hue: 320, saturation: 76, lightness: 68 },
  { hue: 160, saturation: 78, lightness: 64 },
  { hue: 42, saturation: 85, lightness: 62 },
  { hue: 260, saturation: 82, lightness: 70 },
];

const BASE_BUBBLE_COUNT = 16;
const PARTICLE_COUNT = 12;
const RUSH_INTERVAL = 15000;
const RUSH_DURATION = 5000;
const FEVER_THRESHOLD = 10;
const FEVER_DURATION = 8000;
const MAGNET_RADIUS = 110;
const MAGNET_PULSE = 240;
const SCORE_CROWN_THRESHOLD = 1000;

function spawnBubble(canvas: HTMLCanvasElement, speedMultiplier: number): Bubble {
  const radius = 16 + Math.random() * 24;
  const colorIndex = Math.floor(Math.random() * COLORS.length);
  return {
    x: Math.random() * canvas.width,
    y: canvas.height + radius + Math.random() * 260,
    radius,
    vx: (Math.random() - 0.5) * 0.25 * speedMultiplier,
    vy: -(0.35 + Math.random() * 0.8) * speedMultiplier,
    hue: COLORS[colorIndex].hue,
    colorIndex,
    alive: true,
    pulse: Math.random() * Math.PI * 2,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function GameCanvas({ state, soundEnabled, onSnapshot, onGameOver, onActiveBoostersChange }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const gameStateRef = useRef<GameState>(state);
  const scoreRef = useRef(0);
  const comboRef = useRef(1);
  const streakRef = useRef(0);
  const colorChainRef = useRef(1);
  const lastColorRef = useRef<number | null>(null);
  const livesRef = useRef(3);
  const feverUntilRef = useRef(0);
  const rushUntilRef = useRef(0);
  const lastRushRef = useRef(0);
  const magnetUntilRef = useRef(0);
  const magnetPulseRef = useRef(0);
  const scoreDoublerUntilRef = useRef(0);
  const slowMotionUntilRef = useRef(0);
  const lastSnapshotRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const crownUnlockedRef = useRef(false);
  const [showCrown, setShowCrown] = useState(false);
  const [rushFlash, setRushFlash] = useState(false);
  const activeBoostersRef = useRef<Map<BoosterType, number>>(new Map());
  const lastBoosterStateRef = useRef('');

  const playTone = useCallback(
    (frequency: number, duration = 0.12) => {
      if (!soundEnabled) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.05);
      } catch (error) {
        console.error('Audio failed', error);
      }
    },
    [soundEnabled]
  );

  const dispatchSnapshot = useCallback(
    (now: number) => {
      if (now - lastSnapshotRef.current < 80) return;
      lastSnapshotRef.current = now;
      const fever = now < feverUntilRef.current;
      const rush = now < rushUntilRef.current;
      onSnapshot({
        score: scoreRef.current,
        combo: comboRef.current,
        streak: streakRef.current,
        colorChain: colorChainRef.current,
        fever,
        rush,
        lives: livesRef.current,
      });
    },
    [onSnapshot]
  );

  const updateActiveBoosters = useCallback(() => {
    const now = performance.now();
    const map = activeBoostersRef.current;
    const next = new Map<BoosterType, number>();
    map.forEach((value, key) => {
      if (now < value) {
        next.set(key, value);
      }
    });
    activeBoostersRef.current = next;
    const snapshot = Array.from(next.entries()).map(([type, expiresAt]) => ({ type, expiresAt }));
    const signature = JSON.stringify(snapshot);
    if (signature !== lastBoosterStateRef.current) {
      lastBoosterStateRef.current = signature;
      onActiveBoostersChange(snapshot);
    }
  }, [onActiveBoostersChange]);

  const activateBooster = useCallback(
    (type: BoosterType, duration: number) => {
      const now = performance.now();
      const expiresAt = now + duration;
      activeBoostersRef.current.set(type, expiresAt);
      switch (type) {
        case 'time-freeze':
          slowMotionUntilRef.current = expiresAt;
          playTone(280, 0.4);
          break;
        case 'score-doubler':
          scoreDoublerUntilRef.current = expiresAt;
          playTone(520, 0.25);
          break;
        case 'bubble-magnet':
          magnetUntilRef.current = expiresAt;
          magnetPulseRef.current = now;
          playTone(360, 0.28);
          break;
        default:
          break;
      }
      updateActiveBoosters();
    },
    [playTone, updateActiveBoosters]
  );

  useEffect(() => {
    gameStateRef.current = state;
  }, [state]);

  const createParticles = useCallback((x: number, y: number, hue: number) => {
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2.2,
        vy: (Math.random() - 0.5) * 2.2,
        alpha: 1,
        hue: hue + Math.random() * 20 - 10,
        size: 2 + Math.random() * 3,
      });
    }
  }, []);

  const getSpeedMultiplier = useCallback((now: number) => {
    let speed = 1;
    if (now < rushUntilRef.current) speed *= 1.6;
    if (now < slowMotionUntilRef.current) speed *= 0.35;
    return speed;
  }, []);

  const handleBubblePop = useCallback(
    (bubble: Bubble, now: number) => {
      bubble.alive = false;
      const colorIndex = bubble.colorIndex;
      const sameColor = lastColorRef.current === colorIndex;
      colorChainRef.current = sameColor ? colorChainRef.current + 1 : 1;
      lastColorRef.current = colorIndex;
      comboRef.current = clamp(comboRef.current + 1, 1, 99);
      streakRef.current += 1;

      const baseScore = 40;
      const comboMultiplier = 1 + (comboRef.current - 1) * 0.18;
      const colorMultiplier = 1 + (colorChainRef.current - 1) * 0.3;
      const rushBoost = now < rushUntilRef.current ? 1.2 : 1;
      const feverActive = now < feverUntilRef.current;
      const boosterMultiplier = now < scoreDoublerUntilRef.current ? 2 : 1;
      const feverMultiplier = feverActive ? 3 : 1;
      const total = Math.round(baseScore * comboMultiplier * colorMultiplier * rushBoost * boosterMultiplier * feverMultiplier);
      scoreRef.current += total;
      playTone(420 + comboRef.current * 6, 0.12);

      if (!crownUnlockedRef.current && scoreRef.current >= SCORE_CROWN_THRESHOLD) {
        crownUnlockedRef.current = true;
        setShowCrown(true);
        window.setTimeout(() => setShowCrown(false), 2800);
      }

      if (comboRef.current >= FEVER_THRESHOLD) {
        feverUntilRef.current = now + FEVER_DURATION;
      }

      createParticles(bubble.x, bubble.y, bubble.hue);

      window.setTimeout(() => {
        Object.assign(bubble, spawnBubble(canvasRef.current as HTMLCanvasElement, getSpeedMultiplier(now)));
        bubble.alive = true;
      }, 220);
    },
    [createParticles, getSpeedMultiplier, playTone]
  );

  const performTap = useCallback(
    (x: number, y: number, isAuto: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let hits = 0;
      const now = performance.now();
      for (const bubble of bubblesRef.current) {
        if (!bubble.alive) continue;
        const dx = bubble.x - x;
        const dy = bubble.y - y;
        if (dx * dx + dy * dy <= bubble.radius * bubble.radius) {
          hits += 1;
          handleBubblePop(bubble, now);
        }
      }
      if (hits === 0 && !isAuto) {
        comboRef.current = 1;
        colorChainRef.current = 1;
        streakRef.current = 0;
        livesRef.current = Math.max(0, livesRef.current - 1);
        playTone(160, 0.2);
        if (livesRef.current <= 0) {
          onSnapshot({
            score: scoreRef.current,
            combo: comboRef.current,
            streak: streakRef.current,
            colorChain: colorChainRef.current,
            fever: now < feverUntilRef.current,
            rush: now < rushUntilRef.current,
            lives: livesRef.current,
          });
          onGameOver();
        }
      }
    },
    [handleBubblePop, onGameOver, onSnapshot, playTone]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    const resize = () => {
      const width = Math.min(424, Math.floor(window.innerWidth));
      const height = Math.min(708, Math.floor(window.innerHeight - 24));
      canvas.width = Math.max(320, width);
      canvas.height = Math.max(520, height);
    };
    resize();

    bubblesRef.current = Array.from({ length: BASE_BUBBLE_COUNT }, () => spawnBubble(canvas, 1));

    const handlePointer = (clientX: number, clientY: number) => {
      if (gameStateRef.current !== GameState.PLAYING) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      performTap(x, y, false);
    };

    const pointerDown = (event: PointerEvent) => {
      handlePointer(event.clientX, event.clientY);
    };

    const touchStart = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        handlePointer(touch.clientX, touch.clientY);
      }
    };

    const boosterHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: BoosterType; duration?: number }>).detail;
      if (!detail?.type || !detail.duration) return;
      activateBooster(detail.type, clamp(detail.duration, 1000, 20000));
      updateActiveBoosters();
    };

    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', pointerDown, { passive: true });
    canvas.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('rubble:booster', boosterHandler as EventListener);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('touchstart', touchStart);
      window.removeEventListener('rubble:booster', boosterHandler as EventListener);
    };
  }, [activateBooster, performTap, updateActiveBoosters]);

  const renderScene = useCallback(
    (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, now: number, magnetActive: boolean) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
      gradient.addColorStop(1, 'rgba(4, 6, 11, 0.98)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const speedMultiplier = getSpeedMultiplier(now);

      for (const bubble of bubblesRef.current) {
        if (!bubble.alive) continue;
        bubble.x += bubble.vx * speedMultiplier * 0.6;
        bubble.y += bubble.vy * speedMultiplier * 0.6;
        bubble.pulse += 0.03;

        if (now < feverUntilRef.current && Math.random() < 0.002) {
          bubble.colorIndex = Math.floor(Math.random() * COLORS.length);
          bubble.hue = COLORS[bubble.colorIndex].hue + (Math.random() - 0.5) * 20;
        }

        if (bubble.y < -bubble.radius) {
          Object.assign(bubble, spawnBubble(canvas, speedMultiplier));
          continue;
        }

        const color = COLORS[bubble.colorIndex];
        const glow = ctx.createRadialGradient(
          bubble.x - bubble.radius * 0.4,
          bubble.y - bubble.radius * 0.45,
          1,
          bubble.x,
          bubble.y,
          bubble.radius * 1.15
        );
        glow.addColorStop(0, 'rgba(255,255,255,0.9)');
        glow.addColorStop(0.45, `hsla(${color.hue}, ${color.saturation}%, ${color.lightness + 8}%, 0.75)`);
        glow.addColorStop(1, `hsla(${color.hue}, ${color.saturation}%, ${color.lightness}%, 0.15)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        const outline = ctx.createLinearGradient(
          bubble.x - bubble.radius,
          bubble.y - bubble.radius,
          bubble.x + bubble.radius,
          bubble.y + bubble.radius
        );
        outline.addColorStop(0, `hsla(${color.hue + 10}, ${color.saturation}%, ${color.lightness + 18}%, 0.8)`);
        outline.addColorStop(1, `hsla(${color.hue - 10}, ${color.saturation}%, ${color.lightness - 5}%, 0.3)`);
        ctx.strokeStyle = outline;
        ctx.lineWidth = 2 + Math.sin(bubble.pulse) * 0.6;
        ctx.stroke();
      }

      particlesRef.current = particlesRef.current.filter((particle) => particle.alpha > 0.05);
      for (const particle of particlesRef.current) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.alpha *= 0.92;
        ctx.fillStyle = `hsla(${particle.hue}, 80%, 70%, ${particle.alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (magnetActive) {
        ctx.strokeStyle = 'rgba(56,189,248,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height * 0.4, MAGNET_RADIUS * (1 + Math.sin(now / 120) * 0.08), 0, Math.PI * 2);
        ctx.stroke();
      }

      if (rushFlash && now < rushUntilRef.current) {
        ctx.fillStyle = 'rgba(59,130,246,0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    },
    [getSpeedMultiplier, rushFlash]
  );

  const updateGame = useCallback(
    (now: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const magnetActive = now < magnetUntilRef.current;

      if (now - lastRushRef.current > RUSH_INTERVAL) {
        rushUntilRef.current = now + RUSH_DURATION;
        lastRushRef.current = now;
        setRushFlash(true);
        window.setTimeout(() => setRushFlash(false), 800);
        playTone(320, 0.3);
      }

      if (magnetActive && now - magnetPulseRef.current > MAGNET_PULSE) {
        magnetPulseRef.current = now;
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.4;
        performTap(centerX, centerY, true);
      }

      renderScene(canvas, ctx, now, magnetActive);
    },
    [performTap, playTone, renderScene]
  );
  useEffect(() => {
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      if (gameStateRef.current === GameState.PLAYING) {
        updateGame(now, canvas, ctx);
      } else {
        renderScene(canvas, ctx, now, false);
      }
      dispatchSnapshot(now);
      updateActiveBoosters();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dispatchSnapshot, renderScene, updateActiveBoosters, updateGame]);

  return (
    <div className="game-root relative h-full w-full">
      <canvas ref={canvasRef} className="game-canvas canvas-gradient" aria-label="Bubble Hunt playfield" role="img" />
      <AnimatePresence>
        {showCrown && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pointer-events-none absolute inset-x-0 top-1/3 flex flex-col items-center gap-2 text-center text-amber-200"
          >
            <motion.img
              src="/game-icons/crown.png"
              alt="Rubble Crown"
              className="h-20 w-20 drop-shadow-aurora"
              initial={{ scale: 0.6, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            />
            <p className="text-xl font-semibold">👑 You&apos;re the Rubble Champion!</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {rushFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 bg-blue-500/25 mix-blend-screen"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
