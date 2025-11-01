export type RunTokenResponse = {
  ok: boolean;
  token?: string;
  nonce?: string;
  issuedAt?: number;
  expiresAt?: number;
  reason?: string;
  error?: string;
};

export type SubmitScoreResponse = {
  ok: boolean;
  bestScore?: number;
  season?: string;
  error?: string;
  reason?: string;
};

export type BestScoreResponse = {
  ok: boolean;
  bestScore?: number;
  season?: string;
  error?: string;
};

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    const data = (await response.json()) as T;
    return data;
  } catch {
    return null;
  }
}

export async function requestRunToken(address: string): Promise<RunTokenResponse> {
  try {
    const response = await fetch('/api/run/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
      cache: 'no-store',
    });
    const payload = (await parseJson<RunTokenResponse>(response)) ?? { ok: false, error: 'invalid_response' };
    return payload;
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function submitLeaderboardScore(input: {
  player: string;
  score: number;
  token?: string | null;
  runId?: string;
}): Promise<SubmitScoreResponse> {
  try {
    const response = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player: input.player,
        score: input.score,
        token: input.token ?? undefined,
        runId: input.runId,
      }),
      cache: 'no-store',
    });
    const payload = (await parseJson<SubmitScoreResponse>(response)) ?? { ok: false, error: 'invalid_response' };
    if (!response.ok && !payload.error) {
      payload.error = `http_${response.status}`;
    }
    return payload;
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function fetchMyBestScore(address: string): Promise<BestScoreResponse> {
  try {
    const response = await fetch(`/api/leaderboard/me?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await parseJson<BestScoreResponse>(response)) ?? { ok: false, error: 'invalid_response' };
    if (!response.ok && !payload.error) {
      payload.error = `http_${response.status}`;
    }
    return payload;
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
