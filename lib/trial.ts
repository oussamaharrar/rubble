import { getDailyKeyUTC } from '@/lib/daily';

const STORAGE_PREFIX = 'rubble:trial';
const LEGACY_ADDRESS_PREFIX = 'rubble:trial:';
const LEGACY_GATE_PREFIX = 'trial_used_';

type TrialStatus = 'available' | 'used' | 'blocked';

export type TrialRecord = {
  status: TrialStatus;
  token?: string;
  requiresServer?: boolean;
  issuedAt?: string;
  verifiedAt?: string;
  reason?: string;
};

function todayStamp() {
  const key = getDailyKeyUTC().replace(/-/g, '');
  return key;
}

function storageKey(address: string) {
  const normalised = address.toLowerCase();
  return `${STORAGE_PREFIX}:${todayStamp()}:${normalised}`;
}

function readRaw(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore persistence errors
  }
}

function parseRecord(raw: string | null): TrialRecord | null {
  if (!raw) return null;
  if (raw === 'used' || raw === 'blocked') {
    return { status: raw } as TrialRecord;
  }
  try {
    const parsed = JSON.parse(raw) as TrialRecord;
    if (parsed && typeof parsed === 'object' && typeof parsed.status === 'string') {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function readLegacy(address: string) {
  if (typeof window === 'undefined') return null;
  const legacyAddressKey = `${LEGACY_ADDRESS_PREFIX}${address.toLowerCase()}`;
  const legacyAddressValue = readRaw(legacyAddressKey);
  if (legacyAddressValue === 'used') {
    return { status: 'used' } as TrialRecord;
  }
  const legacyGateKey = `${LEGACY_GATE_PREFIX}${getDailyKeyUTC()}`;
  if (readRaw(legacyGateKey) === '1') {
    return { status: 'used' } as TrialRecord;
  }
  return null;
}

export function getTrialStorageKey(address: string) {
  return storageKey(address);
}

export function readTrialRecord(address: string): TrialRecord | null {
  if (typeof window === 'undefined') return null;
  const key = storageKey(address);
  const record = parseRecord(readRaw(key));
  if (record) {
    return record;
  }
  return readLegacy(address);
}

function storeRecord(address: string, record: TrialRecord) {
  if (typeof window === 'undefined') return record;
  const key = storageKey(address);
  writeRaw(key, JSON.stringify(record));
  return record;
}

export async function ensureTrialRecord(address: string): Promise<TrialRecord> {
  if (typeof window === 'undefined') {
    return { status: 'blocked' };
  }
  const existing = readTrialRecord(address);
  if (existing) {
    return existing;
  }
  try {
    const response = await fetch('/api/trial/issue', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ address }),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      token?: string | null;
      requiresVerification?: boolean;
      issuedAt?: string;
      date?: string;
    };
    const record: TrialRecord = {
      status: 'available',
      token: typeof payload.token === 'string' ? payload.token : undefined,
      requiresServer: payload.requiresVerification === true && typeof payload.token === 'string',
      issuedAt: payload.issuedAt,
    };
    return storeRecord(address, record);
  } catch {
    const fallback: TrialRecord = { status: 'available', requiresServer: false };
    return storeRecord(address, fallback);
  }
}

export async function verifyTrial(address: string, record: TrialRecord): Promise<{ ok: boolean; reason?: string; record: TrialRecord }> {
  if (!record.requiresServer || !record.token) {
    return { ok: true, record };
  }
  try {
    const response = await fetch('/api/trial/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ token: record.token }),
      cache: 'no-store',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const reason = typeof payload?.reason === 'string' ? payload.reason : `VERIFY_${response.status}`;
      const blocked: TrialRecord = { ...record, status: 'blocked', reason };
      return { ok: false, reason, record: storeRecord(address, blocked) };
    }
    const payload = (await response.json()) as { ok?: boolean; reason?: string };
    if (payload.ok === false) {
      const reason = payload.reason ?? 'VERIFY_REJECTED';
      const blocked: TrialRecord = { ...record, status: 'blocked', reason };
      return { ok: false, reason, record: storeRecord(address, blocked) };
    }
    const verified: TrialRecord = { ...record, verifiedAt: new Date().toISOString() };
    return { ok: true, record: storeRecord(address, verified) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'VERIFY_ERROR';
    return { ok: false, reason, record };
  }
}

export function markTrialUsed(address: string, record?: TrialRecord) {
  const next: TrialRecord = {
    ...(record ?? { status: 'available' }),
    status: 'used',
  };
  return storeRecord(address, next);
}
