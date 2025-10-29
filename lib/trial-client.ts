'use client';

import { getDailyKeyUTC } from '@/lib/daily';

const STORAGE_PREFIX = 'rubble:trial';

type TrialStatus = 'available' | 'used';

export type TrialRecord = {
  status: TrialStatus;
  date: string;
  address: string;
  token?: string;
  issuedAt?: string;
  verifiedAt?: string;
  reason?: string;
};

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getTrialStorageKey(address: string, date = getDailyKeyUTC()): string {
  return `${STORAGE_PREFIX}:${date}:${normalizeAddress(address)}`;
}

export function removeLegacyTrialKeys(address: string) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(`${STORAGE_PREFIX}:${normalizeAddress(address)}`);
    storage.removeItem('trial_used_' + getDailyKeyUTC());
  } catch {
    // ignore storage cleanup failures
  }
}

function parseRecord(raw: string | null): TrialRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TrialRecord>;
    if (parsed && (parsed.status === 'used' || parsed.status === 'available')) {
      return {
        status: parsed.status,
        date: typeof parsed.date === 'string' ? parsed.date : getDailyKeyUTC(),
        address: typeof parsed.address === 'string' ? parsed.address : '',
        token: typeof parsed.token === 'string' ? parsed.token : undefined,
        issuedAt: typeof parsed.issuedAt === 'string' ? parsed.issuedAt : undefined,
        verifiedAt: typeof parsed.verifiedAt === 'string' ? parsed.verifiedAt : undefined,
        reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
      } satisfies TrialRecord;
    }
  } catch {
    // ignore malformed payloads
  }
  return null;
}

export function readTrialRecord(address: string, date = getDailyKeyUTC()): TrialRecord | null {
  const storage = getStorage();
  if (!storage) return null;
  const key = getTrialStorageKey(address, date);
  return parseRecord(storage.getItem(key));
}

function writeTrialRecord(address: string, record: TrialRecord) {
  const storage = getStorage();
  if (!storage) return;
  const key = getTrialStorageKey(address, record.date);
  try {
    storage.setItem(key, JSON.stringify(record));
  } catch {
    // ignore quota errors
  }
}

export function ensureTrialRecord(address: string): TrialRecord {
  const date = getDailyKeyUTC();
  const storage = getStorage();
  const normalized = normalizeAddress(address);
  const key = getTrialStorageKey(normalized, date);
  const existing = parseRecord(storage?.getItem(key) ?? null);
  if (existing) {
    return existing;
  }
  const created: TrialRecord = {
    status: 'available',
    date,
    address: normalized,
    issuedAt: new Date().toISOString(),
  };
  writeTrialRecord(normalized, created);
  return created;
}

export function markTrialStatus(address: string, status: TrialStatus, updates: Partial<TrialRecord> = {}) {
  const normalized = normalizeAddress(address);
  const current = ensureTrialRecord(normalized);
  const next: TrialRecord = {
    ...current,
    ...updates,
    status,
    date: getDailyKeyUTC(),
    address: normalized,
  };
  writeTrialRecord(normalized, next);
  return next;
}

type IssueResult = { token: string | null; reason?: string };

export async function issueTrialToken(address: string): Promise<IssueResult> {
  const normalized = normalizeAddress(address);
  try {
    const response = await fetch('/api/trial/issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: normalized }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { token: null, reason: `HTTP_${response.status}` };
    }

    const payload = (await response.json()) as { token?: unknown; reason?: unknown };
    if (typeof payload.token === 'string' && payload.token.length > 0) {
      const record = ensureTrialRecord(normalized);
      writeTrialRecord(normalized, {
        ...record,
        token: payload.token,
        issuedAt: new Date().toISOString(),
      });
      return { token: payload.token };
    }

    const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
    return { token: null, reason };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'NETWORK_ERROR';
    return { token: null, reason };
  }
}

export async function verifyTrialToken(address: string): Promise<'ok' | 'disabled' | 'invalid' | 'error'> {
  const record = readTrialRecord(address);
  if (!record?.token) {
    return 'ok';
  }

  try {
    const response = await fetch('/api/trial/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: record.token }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return 'error';
    }

    const payload = (await response.json()) as { ok?: unknown; reason?: unknown };
    if (payload.ok === true) {
      writeTrialRecord(address, {
        ...record,
        verifiedAt: new Date().toISOString(),
      });
      return 'ok';
    }

    const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
    if (reason === 'SIGNING_DISABLED') {
      return 'disabled';
    }
    if (reason === 'TOKEN_INVALID' || reason === 'TOKEN_EXPIRED') {
      markTrialStatus(address, 'used', { reason });
      return 'invalid';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

export function getTrialStatus(address: string | null | undefined): TrialStatus {
  if (!address) {
    return 'used';
  }
  const record = readTrialRecord(address);
  return record?.status ?? 'used';
}

