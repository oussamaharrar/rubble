'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBoard, shareUrl, type LeaderboardEntry } from '@/lib/leaderboard';
import type { BoardKind } from '@/types/game';

const BOARDS: { label: string; value: BoardKind }[] = [
  { label: 'Arcade', value: 'normal' },
  { label: 'Daily', value: 'daily' },
];

interface LeaderboardViewProps {
  highlight?: {
    board: BoardKind;
    score: number;
    combo: number;
    streak: number;
    dailyKey?: string;
  } | null;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeaderboardView({ highlight }: LeaderboardViewProps) {
  const [activeBoard, setActiveBoard] = useState<BoardKind>('normal');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setEntries(getBoard(activeBoard));
  }, [activeBoard]);

  useEffect(() => {
    if (!highlight) return;
    setActiveBoard(highlight.board);
  }, [highlight]);

  useEffect(() => {
    const handleStorage = () => {
      setEntries(getBoard(activeBoard));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeBoard]);

  const activeHighlight = useMemo(() => {
    if (!highlight) return null;
    if (highlight.board !== activeBoard) return null;
    return highlight;
  }, [activeBoard, highlight]);

  const shareTarget = useMemo(() => {
    if (activeHighlight) {
      return activeHighlight;
    }
    const [first] = entries;
    if (!first) return null;
    return { board: activeBoard, score: first.score, combo: first.combo, streak: first.streak, dailyKey: first.dailyKey };
  }, [activeBoard, activeHighlight, entries]);

  const shareHref = useMemo(() => {
    if (!shareTarget) return '';
    const url = shareUrl({ score: shareTarget.score, board: shareTarget.board, dailyKey: shareTarget.dailyKey });
    const castText = `My Rubble ${shareTarget.board === 'daily' ? 'Daily Challenge' : 'Arcade'} score: ${shareTarget.score}!`;
    const composer = new URL('https://warpcast.com/~/compose');
    composer.searchParams.set('text', `${castText}\n${url}`);
    return composer.toString();
  }, [shareTarget]);

  return (
    <div className="space-y-4 text-left">
      <div className="flex gap-2">
        {BOARDS.map((board) => (
          <button
            key={board.value}
            type="button"
            onClick={() => setActiveBoard(board.value)}
            className={`button-tap flex-1 rounded-2xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              activeBoard === board.value ? 'bg-sky-500/70 text-slate-900' : 'bg-white/5 text-slate-200'
            }`}
          >
            {board.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-300">No scores yet. Play a run to populate this board.</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={`${entry.date}-${entry.score}-${index}`}
              className={`flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm ${
                activeHighlight &&
                entry.score === activeHighlight.score &&
                entry.combo === activeHighlight.combo &&
                entry.streak === activeHighlight.streak
                  ? 'border-sky-400/70 bg-sky-500/10'
                  : ''
              }`}
            >
              <div>
                <p className="text-base font-semibold text-slate-100">{entry.score}</p>
                <p className="text-xs text-slate-300">Combo ×{entry.combo} · Streak {entry.streak}</p>
              </div>
              <p className="text-xs text-slate-400">{formatDate(entry.date)}</p>
            </div>
          ))
        )}
      </div>
      {shareTarget && shareHref ? (
        <a
          href={shareHref}
          target="_blank"
          rel="noreferrer"
          className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
        >
          Share to Farcaster
        </a>
      ) : null}
    </div>
  );
}
