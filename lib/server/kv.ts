const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

const fallbackStore = new Map<string, { value: string; expiresAt: number | null }>();

function cleanupFallback() {
  const now = Date.now();
  for (const [key, entry] of fallbackStore.entries()) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      fallbackStore.delete(key);
    }
  }
}

async function kvFetch(path: string, init?: RequestInit) {
  if (!kvUrl || !kvToken) {
    return null;
  }
  const url = `${kvUrl.replace(/\/$/, '')}/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${kvToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

export async function kvGet(key: string): Promise<string | null> {
  if (kvUrl && kvToken) {
    try {
      const response = await kvFetch(`get/${encodeURIComponent(key)}`);
      if (!response) return null;
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`KV get failed: ${response.status}`);
      }
      const data = (await response.json()) as { result?: { value?: string } } | undefined;
      return data?.result?.value ?? null;
    } catch (error) {
      console.warn('[kv] remote get failed, falling back to memory', error);
    }
  }

  cleanupFallback();
  const entry = fallbackStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    fallbackStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function kvSet(
  key: string,
  value: string,
  ttlSeconds?: number,
  { onlyIfAbsent = false }: { onlyIfAbsent?: boolean } = {}
): Promise<boolean> {
  if (kvUrl && kvToken) {
    try {
      const body: Record<string, unknown> = { value };
      if (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
        body.expirationTtl = Math.floor(ttlSeconds);
      }
      if (onlyIfAbsent) {
        body.nx = true;
      }
      const response = await kvFetch(`set/${encodeURIComponent(key)}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!response) return false;
      if (response.status === 409 && onlyIfAbsent) {
        return false;
      }
      if (!response.ok) {
        throw new Error(`KV set failed: ${response.status}`);
      }
      return true;
    } catch (error) {
      console.warn('[kv] remote set failed, falling back to memory', error);
    }
  }

  cleanupFallback();
  if (onlyIfAbsent && fallbackStore.has(key)) {
    const existing = fallbackStore.get(key);
    if (existing && (existing.expiresAt === null || existing.expiresAt > Date.now())) {
      return false;
    }
  }
  const expiresAt = typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? Date.now() + ttlSeconds * 1000
    : null;
  fallbackStore.set(key, { value, expiresAt });
  return true;
}

export async function kvSetIfAbsent(key: string, value: string, ttlSeconds?: number) {
  return kvSet(key, value, ttlSeconds, { onlyIfAbsent: true });
}

export function kvReady() {
  return Boolean(kvUrl && kvToken);
}
