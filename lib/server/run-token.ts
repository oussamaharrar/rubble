import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { getLeaderboardConfig } from '@/lib/server/leaderboard';

const RUN_TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes

type RunTokenPayload = {
  address: string;
  nonce: string;
  issuedAt: number;
};

type IssuedToken = {
  token: string;
  payload: RunTokenPayload;
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __rubbleRunTokenNonces?: Map<string, number>;
}

function getNonceStore() {
  if (!globalThis.__rubbleRunTokenNonces) {
    globalThis.__rubbleRunTokenNonces = new Map();
  }
  return globalThis.__rubbleRunTokenNonces;
}

function cleanupNonces(store: Map<string, number>) {
  const now = Date.now();
  for (const [nonce, expiresAt] of store.entries()) {
    if (expiresAt <= now) {
      store.delete(nonce);
    }
  }
}

export function issueRunToken(address: string): IssuedToken | null {
  const config = getLeaderboardConfig();
  if (!config.hmacKey) {
    return null;
  }
  const nonce = randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const payload: RunTokenPayload = {
    address: address.toLowerCase(),
    nonce,
    issuedAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', config.hmacKey).update(encoded).digest('base64url');
  const token = `${encoded}.${signature}`;
  return { token, payload, expiresAt: issuedAt + RUN_TOKEN_TTL_MS };
}

function decodeToken(token: string, secret: string): RunTokenPayload | null {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  try {
    const expected = createHmac('sha256', secret).update(encoded).digest();
    const provided = Buffer.from(sig, 'base64url');
    if (expected.length !== provided.length) {
      return null;
    }
    if (!timingSafeEqual(expected, provided)) {
      return null;
    }
    const raw = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as Partial<RunTokenPayload>;
    if (
      !parsed ||
      typeof parsed.address !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.issuedAt !== 'number'
    ) {
      return null;
    }
    return {
      address: parsed.address.toLowerCase(),
      nonce: parsed.nonce,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

export function consumeRunToken(token: string, expectedAddress?: string): RunTokenPayload | null {
  const config = getLeaderboardConfig();
  if (!config.hmacKey) {
    return null;
  }
  const payload = decodeToken(token, config.hmacKey);
  if (!payload) {
    return null;
  }
  if (expectedAddress && payload.address !== expectedAddress.toLowerCase()) {
    return null;
  }
  const now = Date.now();
  if (now > payload.issuedAt + RUN_TOKEN_TTL_MS) {
    return null;
  }
  const store = getNonceStore();
  cleanupNonces(store);
  const existing = store.get(payload.nonce);
  if (existing && existing > now) {
    return null;
  }
  store.set(payload.nonce, payload.issuedAt + RUN_TOKEN_TTL_MS);
  return payload;
}

export { RUN_TOKEN_TTL_MS, type RunTokenPayload, type IssuedToken };
