import { createHmac, randomBytes } from 'node:crypto';
import { normalizeAddress } from '@/lib/address';

export type RunTokenPayload = {
  address: string;
  nonce: string;
  issuedAt: number;
};

const TOKEN_TTL_MS = 5 * 60 * 1000;

function encodePayload(payload: RunTokenPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded: string): RunTokenPayload | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<RunTokenPayload>;
    if (!parsed || typeof parsed.address !== 'string' || typeof parsed.nonce !== 'string' || typeof parsed.issuedAt !== 'number') {
      return null;
    }
    return {
      address: parsed.address,
      nonce: parsed.nonce,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

export function issueRunToken(key: string, address: string) {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    throw new Error('Invalid address');
  }
  const nonce = randomBytes(16).toString('hex');
  const payload: RunTokenPayload = { address: normalized, nonce, issuedAt: Date.now() };
  const encoded = encodePayload(payload);
  const signature = createHmac('sha256', key).update(encoded).digest('base64url');
  return { token: `${encoded}.${signature}`, payload };
}

export function verifyRunToken(key: string, token: string, expectedAddress?: string) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'malformed' as const };
  }
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    return { valid: false, reason: 'malformed' as const };
  }
  const expectedSig = createHmac('sha256', key).update(encoded).digest('base64url');
  if (expectedSig !== signature) {
    return { valid: false, reason: 'signature' as const };
  }
  const payload = decodePayload(encoded);
  if (!payload) {
    return { valid: false, reason: 'payload' as const };
  }
  const normalizedExpected = expectedAddress ? normalizeAddress(expectedAddress) : undefined;
  if (normalizedExpected && payload.address !== normalizedExpected) {
    return { valid: false, reason: 'address' as const };
  }
  if (Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
    return { valid: false, reason: 'expired' as const };
  }
  return { valid: true, payload } as const;
}
