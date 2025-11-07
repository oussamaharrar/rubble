'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { useWalletStore } from '@/lib/wallet-store';

type UnknownRecord = Record<string, unknown>;

type PayIntent = {
  to: string;
  value: string;
  valueHex?: string;
  chainId: number;
  chainIdHex?: string;
  type?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  memo?: string;
};

type PaySessionResponse =
  | { ok: true; intent: PayIntent }
  | { ok: true; session: UnknownRecord }
  | { ok: false; reason?: string; error?: string };

type PayStatusResponse = { granted?: boolean };

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasIntent(response: PaySessionResponse): response is { ok: true; intent: PayIntent } {
  return response.ok === true && 'intent' in response;
}

function hasSession(response: PaySessionResponse): response is { ok: true; session: UnknownRecord } {
  return response.ok === true && 'session' in response && isRecord(response.session);
}

function decimalToHex(value: string) {
  const trimmed = value.trim();
  const numeric = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? BigInt(trimmed) : BigInt(trimmed);
  return `0x${numeric.toString(16)}`;
}

function getProvider(): EthereumProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet provider detected.');
  }
  return window.ethereum as unknown as EthereumProvider;
}

const SESSION_ID_KEYS: readonly string[] = ['sessionId', 'id', 'referenceId', 'paymentIntentId', 'checkoutId'];
const CHECKOUT_URL_KEYS: readonly string[] = ['redirectUrl', 'hostedCheckoutUrl', 'checkoutUrl', 'url'];

function readStringField(record: UnknownRecord, key: string) {
  const value = record[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function readBooleanField(record: UnknownRecord, key: string) {
  return record[key] === true;
}

function extractSessionId(record: UnknownRecord) {
  for (const key of SESSION_ID_KEYS) {
    const value = readStringField(record, key);
    if (value) {
      return value;
    }
  }
  if (isRecord(record.metadata)) {
    for (const key of SESSION_ID_KEYS) {
      const nested = readStringField(record.metadata, key);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function extractCheckoutUrl(record: UnknownRecord) {
  for (const key of CHECKOUT_URL_KEYS) {
    const value = readStringField(record, key);
    if (value) {
      return value;
    }
  }
  if (isRecord(record.links)) {
    for (const key of CHECKOUT_URL_KEYS) {
      const value = readStringField(record.links, key);
      if (value) {
        return value;
      }
    }
  }
  return null;
}

function mapErrorMessage(payload: PaySessionResponse, status: number) {
  if (payload.ok) {
    return null;
  }
  const detail = payload.error ?? undefined;
  switch (payload.reason) {
    case 'MODE_B_DISABLED':
      return 'Payments mode B is not available. Please try again later.';
    case 'API_NON_2XX':
      return detail ? `Payments API error: ${detail}` : `Payments API returned status ${status}.`;
    case 'FETCH_ERROR':
      return detail ? `Network error: ${detail}` : 'Unable to reach payments API.';
    case 'BAD_REQUEST':
      return detail ?? 'Payment request was invalid. Please try again.';
    default:
      return detail ?? 'Unable to prepare the Base payment session.';
  }
}

async function pollForGrant(sessionId: string, isMounted: () => boolean) {
  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!isMounted()) {
      return false;
    }
    if (attempt > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
    try {
      const response = await fetch(`/api/pay/status?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        continue;
      }
      const payload = (await response.json()) as PayStatusResponse;
      if (payload.granted) {
        return true;
      }
    } catch {
      // ignore network errors during polling
    }
  }
  return false;
}

export function useBoost() {
  const setWallet = useWalletStore((state) => state.setWallet);
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => mountedRef.current, []);

  const handleNativeIntent = useCallback(async (intent: PayIntent, fromAddress: string) => {
    const provider = getProvider();
    const chainIdHex = intent.chainIdHex ?? `0x${intent.chainId.toString(16)}`;
    const tx: Record<string, string> = {
      from: fromAddress,
      to: intent.to,
      value: intent.valueHex ?? decimalToHex(intent.value),
      chainId: chainIdHex,
    };
    if (intent.type) {
      tx.type = intent.type;
    }
    if (intent.maxFeePerGas) {
      tx.maxFeePerGas = intent.maxFeePerGas;
    }
    if (intent.maxPriorityFeePerGas) {
      tx.maxPriorityFeePerGas = intent.maxPriorityFeePerGas;
    }
    await provider.request<string>({
      method: 'eth_sendTransaction',
      params: [tx],
    });
  }, []);

  const handleCommerceSession = useCallback(
    async (session: UnknownRecord) => {
      if (readBooleanField(session, 'mock')) {
        return true;
      }
      const sessionId = extractSessionId(session);
      if (!sessionId) {
        throw new Error('Payment session created without identifier.');
      }
      const checkoutUrl = extractCheckoutUrl(session);
      if (checkoutUrl) {
        window.open(checkoutUrl, '_blank', 'noopener');
      }
      setStatus('Waiting for Coinbase confirmation…');
      const granted = await pollForGrant(sessionId, isMounted);
      setStatus(null);
      if (!granted) {
        throw new Error('Payment timed out. Try again when ready.');
      }
      return true;
    },
    [isMounted]
  );

  const payToPlay = useCallback(
    async (amountWei: bigint) => {
      if (loading) {
        return false;
      }
      try {
        setLoading(true);
        setError(null);
        setStatus('Preparing Base entry…');
        const account = await ensureBaseNetwork();
        setWallet(account, BASE_CHAIN_ID_HEX);
        setStatus('Confirm in your wallet…');
        const response = await fetch('/api/pay/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ sku: 'game_run_entry', amountWei: amountWei.toString() }),
        });
        const payload = (await response.json()) as PaySessionResponse;
        const message = mapErrorMessage(payload, response.status);
        if (!payload.ok) {
          throw new Error(message ?? 'Failed to create payment session.');
        }
        if (hasIntent(payload)) {
          await handleNativeIntent(payload.intent, account);
          setStatus(null);
          return true;
        }
        if (hasSession(payload)) {
          const granted = await handleCommerceSession(payload.session);
          setStatus(null);
          return granted;
        }
        throw new Error('Unexpected payment response.');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment flow failed.';
        setError(message);
        setStatus(null);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [handleCommerceSession, handleNativeIntent, loading, setWallet]
  );

  const resetError = useCallback(() => setError(null), []);

  return { payToPlay, loading, error, status, resetError } as const;
}
