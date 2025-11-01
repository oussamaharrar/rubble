export type RunTokenResponse =
  | {
      ok: true;
      runId: string;
      token?: string;
      payload?: { address: string; nonce: string; issuedAt: number };
    }
  | { ok: false; reason: string; status?: number };

export type SubmitScoreResponse =
  | { ok: true; bestScore: number; season: string | null }
  | { ok: false; reason: string; status?: number };

export type BestScoreResponse =
  | { ok: true; bestScore: number; season: string | null }
  | { ok: false; reason: string; status?: number };

function safeJson(response: Response) {
  return response
    .json()
    .catch(() => ({})) as Promise<Record<string, unknown> & { ok?: boolean; bestScore?: number; token?: string; payload?: unknown; reason?: string }>;
}

export async function issueRunTokenRequest(address: string): Promise<RunTokenResponse> {
  try {
    const response = await fetch('/api/run/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, reason: 'disabled', status: response.status };
      }
      return { ok: false, reason: 'http_error', status: response.status };
    }
    const data = await safeJson(response);
    if (data.ok && typeof data.runId === 'string') {
      return {
        ok: true,
        runId: data.runId,
        token: typeof data.token === 'string' ? data.token : undefined,
        payload: (data.payload as { address: string; nonce: string; issuedAt: number }) ?? undefined,
      };
    }
    return { ok: false, reason: typeof data.reason === 'string' ? data.reason : 'unknown' };
  } catch (error) {
    console.warn('[leaderboard] token request failed', error);
    return { ok: false, reason: 'network_error' };
  }
}

export async function submitScoreRequest(input: {
  player: string;
  score: number;
  comboMax: number;
  hits: number;
  rareHits: number;
  season?: string | null;
  token?: string;
  runId?: string;
}): Promise<SubmitScoreResponse> {
  try {
    const response = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, reason: 'disabled', status: response.status };
      }
      const data = await safeJson(response);
      return { ok: false, reason: typeof data.reason === 'string' ? data.reason : 'http_error', status: response.status };
    }
    const data = await safeJson(response);
    if (data.ok && typeof data.bestScore === 'number') {
      return { ok: true, bestScore: data.bestScore, season: (typeof data.season === 'string' ? data.season : null) ?? null };
    }
    return { ok: false, reason: typeof data.reason === 'string' ? data.reason : 'unknown' };
  } catch (error) {
    console.warn('[leaderboard] submit failed', error);
    return { ok: false, reason: 'network_error' };
  }
}

export async function fetchBestScore(address: string): Promise<BestScoreResponse> {
  try {
    const response = await fetch(`/api/leaderboard/me?address=${encodeURIComponent(address)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, reason: 'disabled', status: response.status };
      }
      return { ok: false, reason: 'http_error', status: response.status };
    }
    const data = await safeJson(response);
    if (data.ok && typeof data.bestScore === 'number') {
      return { ok: true, bestScore: data.bestScore, season: (typeof data.season === 'string' ? data.season : null) ?? null };
    }
    return { ok: false, reason: typeof data.reason === 'string' ? data.reason : 'unknown' };
  } catch (error) {
    console.warn('[leaderboard] fetch best score failed', error);
    return { ok: false, reason: 'network_error' };
  }
}
