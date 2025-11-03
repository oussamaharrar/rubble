'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import Modal from './Modal';
import { shareUrl } from '@/lib/leaderboard';
import type { BoardKind } from '@/types/game';
import { useWalletStore } from '@/lib/wallet-store';
import { normalizeAddress, shortenAddress } from '@/lib/address';
import { useLeaderboardSnapshot } from '@/lib/hooks/use-leaderboard-snapshot';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  highlight?: {
    board: BoardKind;
    score: number;
    combo: number;
    streak: number;
    dailyKey?: string;
  } | null;
  refreshToken?: number;
}

function formatUpdatedAt(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Spinner() {
  return (
    <div className="flex justify-center py-6" data-testid="leaderboard-spinner">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
    </div>
  );
}

export default function LeaderboardModal({ open, onClose, highlight, refreshToken = 0 }: LeaderboardModalProps) {
  const walletAddress = useWalletStore((state) => state.address);
  const normalizedWallet = useMemo(() => normalizeAddress(walletAddress ?? undefined), [walletAddress]);
  const walletLabel = useMemo(() => shortenAddress(normalizedWallet ?? ''), [normalizedWallet]);
  const snapshot = useLeaderboardSnapshot({ enabled: open, address: walletAddress, refreshToken });

  const shareTarget = useMemo(() => {
    if (!highlight) return null;
    return highlight;
  }, [highlight]);

  const shareHref = useMemo(() => {
    if (!shareTarget) return '';
    const url = shareUrl({ score: shareTarget.score, board: shareTarget.board, dailyKey: shareTarget.dailyKey });
    const castText = `My Rubble ${shareTarget.board === 'daily' ? 'Daily Challenge' : 'Arcade'} score: ${shareTarget.score}!`;
    const composer = new URL('https://warpcast.com/~/compose');
    composer.searchParams.set('text', `${castText}\n${url}`);
    return composer.toString();
  }, [shareTarget]);

  const bestValue = snapshot.bestLoading ? 'Loading…' : snapshot.bestScore ?? (snapshot.disabled ? 'Disabled' : '—');
  const updatedLabel = formatUpdatedAt(snapshot.topUpdatedAt);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leaderboard"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Top Players</p>
            {updatedLabel ? <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">Updated {updatedLabel}</p> : null}
          </div>
          {snapshot.topLoading ? (
            <Spinner />
          ) : snapshot.topItems.length > 0 ? (
            <div className="mt-3 space-y-2">
              {snapshot.topItems.slice(0, 50).map((entry, index) => {
                const normalizedEntry = normalizeAddress(entry.address);
                const isYou = normalizedWallet && normalizedEntry === normalizedWallet;
                return (
                  <div
                    key={`${entry.address}-${index}`}
                    className={clsx(
                      'flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm',
                      isYou && 'border-sky-400/70 bg-sky-500/10'
                    )}
                  >
                    <div>
                      <p className="text-base font-semibold text-slate-100">{index + 1}. {entry.bestScore}</p>
                      <p className="text-xs text-slate-300">{isYou ? 'You' : shortenAddress(normalizedEntry ?? entry.address)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <p className="font-semibold text-slate-100">Your Rank Only</p>
              <p className="mt-1 text-xs text-slate-300/80">
                Global placements are warming up. Keep chasing your personal best and we’ll sync the full leaderboard soon.
              </p>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-indigo-100/80">Your Best</p>
          <p className="mt-1 text-3xl font-semibold text-white" data-testid="best-score-value">
            {bestValue}
          </p>
          <p className="mt-2 text-xs text-indigo-100/70">
            {normalizedWallet
              ? `Tracking for ${walletLabel}`
              : snapshot.disabled
                ? 'Leaderboard disabled.'
                : 'Connect a wallet to track your rank.'}
          </p>
        </section>
        {shareTarget && shareHref ? (
          <a
            href={shareHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
          >
            Share to Farcaster
          </a>
        ) : null}
      </div>
    </Modal>
  );
}
