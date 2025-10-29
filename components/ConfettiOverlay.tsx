'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

const COLORS = ['#fcd34d', '#fbbf24', '#f87171', '#60a5fa', '#a855f7', '#34d399'];

const PIECES = 24;

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotation: number;
  color: string;
  scale: number;
};

export default function ConfettiOverlay() {
  const pieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: PIECES }).map((_, index) => {
      const left = 5 + Math.random() * 90;
      const delay = Math.random() * 0.25;
      const duration = 1.1 + Math.random() * 0.6;
      const rotation = Math.random() * 360;
      const color = COLORS[index % COLORS.length];
      const scale = 0.6 + Math.random() * 0.8;
      return { id: index, left, delay, duration, rotation, color, scale };
    });
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute h-2 w-2 rounded-sm"
          style={{ left: `${piece.left}%`, top: '-10%', backgroundColor: piece.color, transform: `scale(${piece.scale})` }}
          initial={{ y: -140, opacity: 0, rotate: piece.rotation }}
          animate={{ y: 320, opacity: [0, 0.95, 0.8, 0], rotate: piece.rotation + 220 }}
          transition={{ delay: piece.delay, duration: piece.duration, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
