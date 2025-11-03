'use client';

import { useEffect, useState } from 'react';
import { fetchBestScore, fetchTopLeaderboard } from '@/lib/leaderboard-client';

export type LeaderboardSnapshot = {
  topItems: { address: string; bestScore: number }[];
  topUpdatedAt: string | null;
  topLoading: boolean;
  bestScore: number | null;
  bestLoading: boolean;
  disabled: boolean;
};

export function useLeaderboardSnapshot({
  enabled,
  address,
  refreshToken = 0,
}: {
  enabled: boolean;
  address?: string | null;
  refreshToken?: number;
}): LeaderboardSnapshot {
  const [topItems, setTopItems] = useState<LeaderboardSnapshot['topItems']>([]);
  const [topUpdatedAt, setTopUpdatedAt] = useState<string | null>(null);
  const [topLoading, setTopLoading] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [bestLoading, setBestLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setTopItems([]);
      setTopUpdatedAt(null);
      return;
    }
    let cancelled = false;
    setTopLoading(true);
    fetchTopLeaderboard()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setTopItems(result.items);
          setTopUpdatedAt(result.updatedAt);
        } else {
          setTopItems([]);
          setTopUpdatedAt(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTopItems([]);
          setTopUpdatedAt(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTopLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshToken]);

  useEffect(() => {
    if (!enabled) {
      setBestScore(null);
      setBestLoading(false);
      setDisabled(false);
      return;
    }
    if (!address) {
      setBestScore(null);
      setBestLoading(false);
      setDisabled(false);
      return;
    }
    let cancelled = false;
    setBestLoading(true);
    fetchBestScore(address)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setBestScore(result.bestScore);
          setDisabled(false);
        } else if (result.reason === 'disabled') {
          setBestScore(null);
          setDisabled(true);
        } else {
          setBestScore(null);
          setDisabled(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBestScore(null);
          setDisabled(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBestLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, enabled, refreshToken]);

  return { topItems, topUpdatedAt, topLoading, bestScore, bestLoading, disabled };
}
