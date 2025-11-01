import 'server-only';

import { getEnv } from '@/lib/env';

type KvConfig = {
  url: string;
  token: string;
};

type KvResult<T> = { ok: true; value: T } | { ok: false };

const FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

const fallbackStore = new Map<string, number>();

let cachedConfig: KvConfig | null | undefined;

function resolveConfig(): KvConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }
  const env = getEnv();
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    cachedConfig = {
      url: env.KV_REST_API_URL.replace(/\/$/, ''),
      token: env.KV_REST_API_TOKEN,
    };
  } else {
    cachedConfig = null;
  }
  return cachedConfig;
}

async function kvRequest<T>(path: string, init?: RequestInit): Promise<KvResult<T>> {
  const config = resolveConfig();
  if (!config) {
    return { ok: false };
  }
  const target = `${config.url}${path}`;
  const response = await fetch(target, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    return { ok: false };
  }
  try {
    const json = (await response.json()) as T;
    return { ok: true, value: json };
  } catch {
    return { ok: false };
  }
}

export function isKvAvailable() {
  return Boolean(resolveConfig());
}

function purgeFallback(now: number) {
  for (const [key, expiresAt] of fallbackStore.entries()) {
    if (expiresAt <= now) {
      fallbackStore.delete(key);
    }
  }
}

export async function kvGet(key: string): Promise<string | null> {
  const config = resolveConfig();
  if (!config) {
    const now = Date.now();
    purgeFallback(now);
    const expiresAt = fallbackStore.get(key);
    if (!expiresAt || expiresAt <= now) {
      return null;
    }
    return '1';
  }
  const result = await kvRequest<{ result?: { value?: string } }>(`/get/${encodeURIComponent(key)}`);
  if (!result.ok) {
    return null;
  }
  return result.value.result?.value ?? null;
}

export async function kvSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const config = resolveConfig();
  if (!config) {
    const now = Date.now();
    purgeFallback(now);
    fallbackStore.set(key, now + ttlSeconds * 1000);
    return true;
  }
  const expiration = Math.max(1, Math.floor(Date.now() / 1000) + Math.max(1, ttlSeconds));
  const result = await kvRequest(`/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({ value, expiration }),
  });
  return result.ok;
}

export async function kvEnsureAbsentThenSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean> {
  const existing = await kvGet(key);
  if (existing !== null) {
    return false;
  }
  return kvSet(key, value, ttlSeconds);
}

export function markFallbackOnly(key: string) {
  const now = Date.now();
  purgeFallback(now);
  fallbackStore.set(key, now + FALLBACK_TTL_MS);
}
