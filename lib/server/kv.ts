import { getEnv } from '@/lib/env';

interface KvClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

type FallbackEntry = {
  value: string;
  expiresAt: number | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __rubbleKvFallback?: Map<string, FallbackEntry>;
}

let cached: KvClient | null | undefined;

function getFallbackStore() {
  if (!globalThis.__rubbleKvFallback) {
    globalThis.__rubbleKvFallback = new Map();
  }
  return globalThis.__rubbleKvFallback;
}

function createFallbackClient(): KvClient {
  const store = getFallbackStore();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      const expiresAt = typeof ttlSeconds === 'number' && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
      store.set(key, { value, expiresAt });
    },
  };
}

function createRemoteClient(url: string, token: string): KvClient {
  const base = url.replace(/\/$/, '');
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
  });
  const fallback = createFallbackClient();

  return {
    async get(key) {
      try {
        const response = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error(`KV get failed with status ${response.status}`);
        }
        const data = (await response.json()) as { result?: string; value?: string };
        const value = data.result ?? data.value ?? null;
        if (value !== null) {
          await fallback.set(key, value, undefined);
        }
        return value;
      } catch {
        return fallback.get(key);
      }
    },
    async set(key, value, ttlSeconds) {
      const payload: Record<string, unknown> = { value };
      if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
        payload.expirationTtl = ttlSeconds;
      }
      try {
        const response = await fetch(`${base}/set/${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`KV set failed with status ${response.status}`);
        }
      } catch {
        // swallow error and rely on fallback
      }
      await fallback.set(key, value, ttlSeconds);
    },
  };
}

export function getKvClient(): KvClient {
  if (cached !== undefined) {
    return cached ?? createFallbackClient();
  }
  try {
    const env = getEnv();
    if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
      cached = createRemoteClient(env.KV_REST_API_URL, env.KV_REST_API_TOKEN);
      return cached;
    }
  } catch {
    // ignore env parsing issues, fallback below
  }
  cached = createFallbackClient();
  return cached;
}
