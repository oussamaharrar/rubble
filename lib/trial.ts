const STORAGE_PREFIX = 'rubble:trial';

function getUtcDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

export function getTrialStorageKey(address: string, date = new Date()) {
  const safeAddress = normalizeAddress(address);
  const dateKey = getUtcDateKey(date);
  return `${STORAGE_PREFIX}:${dateKey}:${safeAddress}`;
}

export function readTrialUsage(address: string) {
  if (typeof window === 'undefined') {
    return { used: false, token: null as string | null };
  }
  const key = getTrialStorageKey(address);
  const stored = window.localStorage.getItem(key);
  if (!stored) {
    return { used: false, token: null as string | null };
  }
  if (stored.startsWith('used:')) {
    return { used: true, token: stored.slice(5) || null };
  }
  return { used: stored === 'used', token: null as string | null };
}

export function markTrialUsed(address: string, token?: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const key = getTrialStorageKey(address);
  const value = token ? `used:${token}` : 'used';
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

export function resetTrialUsage(address: string) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(getTrialStorageKey(address));
  } catch {
    // ignore
  }
}

export async function requestTrialToken(address: string) {
  try {
    const response = await fetch('/api/trial/issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { token?: string | null };
    return typeof payload.token === 'string' && payload.token.length > 0 ? payload.token : null;
  } catch {
    return null;
  }
}

export async function verifyTrialToken(token: string) {
  try {
    const response = await fetch('/api/trial/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      reason?: string;
    };
    if (payload.ok === true) {
      return true;
    }
    if (payload.reason === 'TRIAL_SIGN_KEY missing') {
      return true;
    }
    if (
      payload.reason === 'token_invalid' ||
      payload.reason === 'signature_mismatch' ||
      payload.reason === 'token_expired'
    ) {
      return false;
    }
    if (!response.ok) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}
