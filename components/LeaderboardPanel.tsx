'use client';

import { useEffect, useMemo, useState } from 'react';
import { shortenAddress } from '@/lib/address';
import {
  fetchBestScore,
  fetchLeaderboardTop,
  type LeaderboardTopItem,
} from '@/lib/leaderboard-client';

interface LeaderboardPanelProps {
  address?: string | null;
  identityLabel?: string | null;
  refreshToken?: number;
  className?: string;
}

function formatTimestamp(value: string | null) {
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

export default function LeaderboardPanel({
  address,
  identityLabel,
  refreshToken = 0,
  className,
}: LeaderboardPanelProps) {
  const [topItems, setTopItems] = useState<LeaderboardTopItem[]>([]);
  const [topLoading, setTopLoading] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [bestLoading, setBestLoading] = useState(false);
  const [season, setSeason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const displayLabel = useMemo(() => {
    const trimmed = identityLabel?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed;
    }
    if (address) {
      return shortenAddress(address);
    }
    return 'You';
  }, [address, identityLabel]);

  useEffect(() => {
    let cancelled = false;
    setTopLoading(true);
    setError(null);
    fetchLeaderboardTop()
      .then((response) => {
        if (cancelled) return;
        if (response.ok) {
          setTopItems(response.items);
          setUpdatedAt(response.updatedAt ?? null);
        } else {
          setTopItems([]);
          setError((prev) => prev ?? 'Unable to load the top leaderboard.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTopItems([]);
        setError((prev) => prev ?? 'Unable to load the top leaderboard.');
      })
      .finally(() => {
        if (!cancelled) {
          setTopLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!address) {
      setBestScore(null);
      setSeason(null);
      setBestLoading(false);
      return;
    }
    let cancelled = false;
    setBestLoading(true);
    fetchBestScore(address)
      .then((response) => {
        if (cancelled) return;
        if (response.ok) {
          setBestScore(response.bestScore);
          setSeason(response.season ?? null);
        } else {
          setBestScore(null);
          setSeason(null);
          if (response.reason !== 'disabled') {
            setError((prev) => prev ?? 'Unable to load your best score.');
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBestScore(null);
        setSeason(null);
        setError((prev) => prev ?? 'Unable to load your best score.');
      })
      .finally(() => {
        if (!cancelled) {
          setBestLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshToken]);

  const hasTopItems = topItems.length > 0;
  const formattedUpdatedAt = useMemo(() => formatTimestamp(updatedAt), [updatedAt]);
  const containerClass = className ? `${className} space-y-5` : 'space-y-5';

  return (
    <div data-testid="leaderboard-panel" className={containerClass}>
      {error ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Top Players</h3>
          {formattedUpdatedAt ? (
            <span className="text-xs text-white/60">Updated {formattedUpdatedAt}</span>
          ) : null}
        </div>
        {topLoading ? (
          <div
            data-testid="leaderboard-loading"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center text-sm text-slate-200"
          >
            Loading leaderboard…
          </div>
        ) : hasTopItems ? (
          <ul className="space-y-2" data-testid="leaderboard-top-list">
            {topItems.map((item, index) => (
              <li
                key={`${item.address}-${index}`}
                data-testid={`leaderboard-item-${index}`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-[0.32em] text-white/50">#{index + 1}</span>
                  <span className="text-sm font-semibold text-white">{shortenAddress(item.address)}</span>
                </div>
                <span className="text-xl font-semibold text-sky-200">{item.bestScore}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-5 text-center">
            <p className="text-base font-semibold text-white">Your Rank Only</p>
            <p className="mt-1 text-sm text-white/70">
              Top rankings will appear once more runs are verified. In the meantime, keep pushing your personal best below.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/12 bg-slate-900/70 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/60">Your Best</p>
            <p className="mt-1 text-base font-semibold text-white/80">{displayLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] uppercase tracking-[0.32em] text-white/50">Best Score</p>
            <p className="mt-1 text-3xl font-semibold text-white" data-testid="leaderboard-best-value">
              {bestLoading ? '…' : bestScore ?? '—'}
            </p>
          </div>
        </div>
        {season ? (
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-white/50">Season {season}</p>
        ) : null}
        {!address ? (
          <p className="mt-3 text-xs text-white/70">
            Connect your wallet to sync your on-chain best score and compete for the leaderboard.
          </p>
        ) : null}
      </section>
    </div>
  );
}
