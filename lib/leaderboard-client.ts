'use client';

import { logEvent } from '@/lib/telemetry';

export type RunStartToken = {
  token: string | null;
  issuedAt: number | null;
  nonce: string | null;
  season: string | null;
  disabled?: boolean;
};

export type SubmitResponse = {
  ok: boolean;
  bestScore: number | null;
  season: string | null;
  rank: number | null;
  disabled: boolean;
};

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function requestRunStartToken(address: string): Promise<RunStartToken | null> {
  try {
    const response = await fetch('/api/run/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (response.status === 503) {
      logEvent('run_start_token_issue', { ok: false, status: 503 });
      return { token: null, issuedAt: null, nonce: null, season: null, disabled: true };
    }
    const payload = await parseJson<{ ok: boolean; token: string | null; issuedAt: number; nonce: string | null; season: string }>(
      response
    );
    if (!payload?.ok) {
      return null;
    }
    logEvent('run_start_token_issue', { ok: true, hasToken: Boolean(payload.token) });
    return {
      token: payload.token,
      issuedAt: payload.issuedAt ?? null,
      nonce: payload.nonce ?? null,
      season: payload.season ?? null,
      disabled: false,
    };
  } catch {
    logEvent('run_start_token_issue', { ok: false });
    return null;
  }
}

export async function submitLeaderboardScore(
  address: string,
  score: number,
  token?: string | null,
  runId?: string
): Promise<SubmitResponse> {
  try {
    const response = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, score, token, runId }),
    });
    if (response.status === 503) {
      logEvent('leader_submit', { ok: false, status: 503 });
      return { ok: false, bestScore: null, season: null, rank: null, disabled: true };
    }
    const payload = await parseJson<{
      ok: boolean;
      bestScore?: number;
      season?: string;
      rank?: number | null;
    }>(response);
    if (!payload?.ok) {
      logEvent('leader_submit', { ok: false, status: response.status });
      return { ok: false, bestScore: null, season: null, rank: null, disabled: false };
    }
    logEvent('leader_submit', { ok: true, bestScore: payload.bestScore });
    return {
      ok: true,
      bestScore: payload.bestScore ?? null,
      season: payload.season ?? null,
      rank: payload.rank ?? null,
      disabled: false,
    };
  } catch {
    logEvent('leader_submit', { ok: false, status: 'network_error' });
    return { ok: false, bestScore: null, season: null, rank: null, disabled: false };
  }
}

export async function fetchPersonalBest(address: string): Promise<SubmitResponse> {
  try {
    const response = await fetch(`/api/leaderboard/me?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 503) {
      logEvent('leader_me_fetch', { ok: false, status: 503 });
      return { ok: false, bestScore: null, season: null, rank: null, disabled: true };
    }
    const payload = await parseJson<{
      ok: boolean;
      bestScore?: number;
      season?: string;
      rank?: number | null;
    }>(response);
    if (!payload?.ok) {
      logEvent('leader_me_fetch', { ok: false, status: response.status });
      return { ok: false, bestScore: null, season: null, rank: null, disabled: false };
    }
    logEvent('leader_me_fetch', { ok: true, bestScore: payload.bestScore });
    return {
      ok: true,
      bestScore: payload.bestScore ?? null,
      season: payload.season ?? null,
      rank: payload.rank ?? null,
      disabled: false,
    };
  } catch {
    logEvent('leader_me_fetch', { ok: false, status: 'network_error' });
    return { ok: false, bestScore: null, season: null, rank: null, disabled: false };
  }
}
