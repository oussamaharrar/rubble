'use client';

import { useEffect, useRef, useState } from 'react';
import './styles.css';

interface Bubble {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  hue: number;
  alive: boolean;
}

const COLORS = [188, 320, 220, 160, 40];
const BASE_BUBBLE_COUNT = 14;

function spawnBubble(canvas: HTMLCanvasElement, speedMultiplier: number): Bubble {
  const radius = 16 + Math.random() * 20;
  return {
    x: Math.random() * canvas.width,
    y: canvas.height + radius + Math.random() * 200,
    radius,
    vx: (Math.random() - 0.5) * 0.18 * speedMultiplier,
    vy: -(0.28 + Math.random() * 0.9) * speedMultiplier,
    hue: COLORS[(Math.random() * COLORS.length) | 0],
    alive: true,
  };
}

export default function BubbleGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const speedRef = useRef(1);
  const comboTimeoutRef = useRef<number | null>(null);
  const comboRef = useRef(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const resize = () => {
      const width = Math.min(424, Math.floor(window.innerWidth));
      const height = Math.min(695, Math.floor(window.innerHeight - 24));
      canvas.width = Math.max(320, width);
      canvas.height = Math.max(480, height);
    };
    resize();

    bubblesRef.current = Array.from({ length: BASE_BUBBLE_COUNT }, () => spawnBubble(canvas, speedRef.current));

    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const ctx = context;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const bubble of bubblesRef.current) {
        if (!bubble.alive) continue;
        bubble.x += bubble.vx * dt * 0.6;
        bubble.y += bubble.vy * dt * 0.6;

        const gradient = ctx.createRadialGradient(
          bubble.x - bubble.radius * 0.35,
          bubble.y - bubble.radius * 0.4,
          1,
          bubble.x,
          bubble.y,
          bubble.radius
        );
        gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
        gradient.addColorStop(1, `hsla(${bubble.hue}, 90%, 65%, 0.95)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        if (bubble.y < -bubble.radius) {
          Object.assign(bubble, spawnBubble(canvas, speedRef.current));
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const updateCombo = (value: number) => {
      comboRef.current = value;
      setCombo(value);
    };

    const handlePointer = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let hits = 0;

      for (const bubble of bubblesRef.current) {
        if (!bubble.alive) continue;
        const dx = bubble.x - x;
        const dy = bubble.y - y;
        if (dx * dx + dy * dy <= bubble.radius * bubble.radius) {
          bubble.alive = false;
          hits += 1;
          setScore((prev) => prev + 15 * comboRef.current);
          window.setTimeout(() => {
            Object.assign(bubble, spawnBubble(canvas, speedRef.current), { alive: true });
          }, 240);
        }
      }

      if (hits > 0) {
        speedRef.current = Math.min(2.75, speedRef.current + 0.03 * hits);
        const nextCombo = Math.min(10, comboRef.current + hits);
        updateCombo(nextCombo);
        setStreak((prev) => prev + hits);
        if (comboTimeoutRef.current !== null) {
          window.clearTimeout(comboTimeoutRef.current);
        }
        comboTimeoutRef.current = window.setTimeout(() => {
          updateCombo(1);
          setStreak(0);
          speedRef.current = Math.max(1, speedRef.current * 0.92);
        }, 1800);
      } else {
        updateCombo(1);
        setStreak(0);
        speedRef.current = Math.max(1, speedRef.current * 0.94);
      }
    };

    const pointerDown = (event: PointerEvent) => {
      handlePointer(event.clientX, event.clientY);
    };

    const touchStart = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        handlePointer(touch.clientX, touch.clientY);
      }
    };

    canvas.addEventListener('pointerdown', pointerDown, { passive: true });
    canvas.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('resize', resize);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (comboTimeoutRef.current !== null) window.clearTimeout(comboTimeoutRef.current);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('touchstart', touchStart);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Bubble Hunt playfield" role="img" />
      <div className="hud" aria-live="polite">
        <span>Score {score}</span>
        <span>Combo ×{combo}</span>
        <span>Streak {streak}</span>
      </div>
    </div>
  );
}
