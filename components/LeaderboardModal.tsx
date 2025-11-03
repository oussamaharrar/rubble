'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import Modal from './Modal';
import { fetchBestScore, fetchLeaderboardTop, type LeaderboardTopItem } from '@/lib/leaderboard-client';
import { shortenAddress } from '@/lib/address';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  address: string | null;
  fallbackBest?: number | null;
  refreshToken: number;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function formatRank(index: number) {
  return `#${index + 1}`;
}

function formatUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) return null;
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

export default function LeaderboardModal({ open, onClose, address, fallbackBest = null, refreshToken }: LeaderboardModalProps) {
  const [topItems, setTopItems] = useState<LeaderboardTopItem[]>([]);
  const [topState, setTopState] = useState<LoadState>('idle');
  const [topError, setTopError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selfState, setSelfState] = useState<LoadState>('idle');
  const [selfBest, setSelfBest] = useState<number | null>(fallbackBest ?? null);
  const [selfSeason, setSelfSeason] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setTopState('loading');
    setTopError(null);
    fetchLeaderboardTop()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setTopItems(result.items);
          setUpdatedAt(result.updatedAt ?? null);
          setTopState('ready');
        } else {
          setTopItems([]);
          setTopState('error');
          setTopError('Unable to load leaderboard.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTopItems([]);
        setTopState('error');
        setTopError('Unable to load leaderboard.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, refreshToken]);

  useEffect(() => {
    setSelfBest(fallbackBest ?? null);
  }, [fallbackBest]);

  useEffect(() => {
    if (!open || address) {
      return;
    }
    setSelfState('idle');
    setSelfSeason(null);
  }, [open, address]);

  useEffect(() => {
    if (!open || !address) {
      return;
    }
    let cancelled = false;
    setSelfState('loading');
    fetchBestScore(address)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSelfBest(result.bestScore);
          setSelfSeason(result.season ?? null);
          setSelfState('ready');
        } else if (result.reason === 'disabled') {
          setSelfState('error');
          setSelfBest(null);
        } else {
          setSelfState('error');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSelfState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, address, refreshToken]);

  const showFallback = topState === 'ready' && topItems.length === 0;
  const bestDisplay = useMemo(() => {
    if (selfState === 'loading') {
      return 'Loading…';
    }
    if (typeof selfBest === 'number') {
      return selfBest;
    }
    if (fallbackBest !== null && typeof fallbackBest === 'number') {
      return fallbackBest;
    }
    return '—';
  }, [fallbackBest, selfBest, selfState]);

  const updatedLabel = useMemo(() => formatUpdatedAt(updatedAt), [updatedAt]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leaderboard"
      className="bg-slate-950/95"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Top Players</p>
            {updatedLabel ? <p className="text-xs text-white/50">Updated {updatedLabel}</p> : null}
          </div>
          {topState === 'loading' ? (
            <p className="mt-4 text-sm text-white/70">Loading leaderboard…</p>
          ) : topState === 'error' ? (
            <p className="mt-4 text-sm text-rose-200">{topError ?? 'Leaderboard unavailable right now.'}</p>
          ) : showFallback ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-lg font-semibold text-white">Your Rank Only</h3>
              <p className="text-sm text-white/70">
                Scores are syncing. You can still view your personal best below while the global board refreshes.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2" data-testid="leaderboard-top-list">
              {topItems.map((entry, index) => (
                <li
                  key={`${entry.address}-${index}`}
                  className={clsx(
                    'flex items-center justify-between rounded-2xl border border-white/12 bg-black/30 px-4 py-3 text-sm text-white shadow-sm',
                    index === 0 && 'border-amber-400/60 bg-amber-500/20',
                    index === 1 && 'border-sky-400/60 bg-sky-500/20',
                    index === 2 && 'border-emerald-400/60 bg-emerald-500/20',
                  )}
                  data-testid={`leaderboard-row-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">{formatRank(index)}</span>
                    <span className="text-base font-semibold">{shortenAddress(entry.address)}</span>
                  </div>
                  <span className="text-lg font-bold">{entry.bestScore}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4" data-testid="leaderboard-your-best">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Your Best</p>
          <p className="mt-2 text-3xl font-semibold text-white" data-testid="leaderboard-best-score">
            {bestDisplay}
          </p>
          {selfSeason ? (
            <p className="text-xs text-white/60">Season {selfSeason}</p>
          ) : null}
          {selfState === 'error' && address ? (
            <p className="mt-2 text-xs text-rose-200">Unable to refresh your best score. Try again later.</p>
          ) : null}
          {!address ? (
            <p className="mt-2 text-xs text-white/60">Connect a Base wallet to join the leaderboard.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
