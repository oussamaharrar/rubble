export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { verifyCommerceWebhook } from '@/lib/pay';
import { markSessionGranted } from '@/lib/pay-session-store';

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseString(value: string) {
  return value.trim().toLowerCase();
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
        return BigInt(trimmed);
      }
      if (!/^\d+(?:\.\d+)?$/u.test(trimmed)) {
        return null;
      }
      if (trimmed.includes('.')) {
        const [whole, fractional = ''] = trimmed.split('.');
        const padded = `${fractional}${'0'.repeat(18)}`.slice(0, 18);
        return BigInt(`${whole}${padded}`);
      }
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

const AMOUNT_KEYS: readonly string[] = [
  'amountWei',
  'valueWei',
  'amount',
  'value',
  'total',
  'quantity',
  'subtotal',
  'baseAmount',
];

function extractAmount(value: unknown, depth = 0): bigint | null {
  if (depth > 3) {
    return null;
  }
  const parsed = toBigInt(value);
  if (parsed !== null) {
    return parsed;
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of AMOUNT_KEYS) {
    if (key in value) {
      const inner = value[key];
      const amount = extractAmount(inner, depth + 1);
      if (amount !== null) {
        return amount;
      }
    }
  }
  return null;
}

const CHAIN_KEYS: readonly string[] = [
  'chainId',
  'chain',
  'network',
  'assetNetwork',
  'blockchain',
];

function extractChainId(value: unknown, depth = 0): string | null {
  if (depth > 3) {
    return null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of CHAIN_KEYS) {
    if (key in value) {
      const nested = extractChainId(value[key], depth + 1);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

const RECIPIENT_KEYS: readonly string[] = [
  'payToAddress',
  'recipient',
  'recipientAddress',
  'destination',
  'to',
];

function extractRecipient(value: unknown, depth = 0): string | null {
  if (depth > 3) {
    return null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of RECIPIENT_KEYS) {
    if (key in value) {
      const nested = extractRecipient(value[key], depth + 1);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

const SESSION_KEYS: readonly string[] = [
  'sessionId',
  'id',
  'referenceId',
  'paymentIntentId',
  'checkoutId',
];

function extractSessionId(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of SESSION_KEYS) {
    if (key in value) {
      const nested = extractSessionId(value[key], depth + 1);
      if (nested) {
        return nested;
      }
    }
  }
  for (const entry of Object.values(value)) {
    const nested = extractSessionId(entry, depth + 1);
    if (nested) {
      return nested;
    }
  }
  return null;
}

const STATUS_KEYS: readonly string[] = ['status', 'state', 'type', 'event'];

function extractStatus(value: unknown, depth = 0): string | null {
  if (depth > 3) {
    return null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of STATUS_KEYS) {
    if (key in value) {
      const nested = extractStatus(value[key], depth + 1);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function statusIndicatesPaid(status: string | null) {
  if (!status) {
    return false;
  }
  const normalised = status.toLowerCase();
  return (
    normalised === 'paid' ||
    normalised === 'confirmed' ||
    normalised.includes('paid') ||
    normalised.includes('confirm')
  );
}

function isBaseChain(chain: string | null) {
  if (!chain) {
    return false;
  }
  const value = normaliseString(chain);
  return value === '8453' || value === '0x2105' || value === 'base-mainnet' || value === 'base';
}

export async function POST(req: Request) {
  const env = getEnv();
  if (!env.PAYMENTS_MODE_B_ENABLED) {
    return NextResponse.json({ ok: false, reason: 'MODE_B_DISABLED' }, { status: 400 });
  }

  const signature =
    req.headers.get('x-cc-webhook-signature') ??
    req.headers.get('x-webhook-signature') ??
    '';
  const rawBody = await req.text();
  const verification = await verifyCommerceWebhook(rawBody, signature);

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, reason: verification.code },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const event = verification.event;
  const payload = isRecord(event) && isRecord(event.data) ? event.data : event;
  if (!isRecord(payload)) {
    return NextResponse.json(
      { ok: false, reason: 'BAD_EVENT' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const sessionId = extractSessionId(payload);
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, reason: 'MISSING_SESSION_ID' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const chainId = extractChainId(payload);
  if (!isBaseChain(chainId)) {
    return NextResponse.json(
      { ok: false, reason: 'UNSUPPORTED_CHAIN', chainId },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const recipient = extractRecipient(payload)?.toLowerCase();
  const expectedRecipient = env.PAY_TO_ADDRESS.toLowerCase();
  if (!recipient || recipient !== expectedRecipient) {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_RECIPIENT' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const amountWei = extractAmount(payload);
  if (amountWei === null || amountWei < env.MIN_PRICE_WEI) {
    return NextResponse.json(
      { ok: false, reason: 'UNDER_MINIMUM' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const status = extractStatus(payload);
  if (!statusIndicatesPaid(status)) {
    return NextResponse.json(
      { ok: true, pending: true },
      { status: 202, headers: RESPONSE_HEADERS }
    );
  }

  markSessionGranted(sessionId);

  return NextResponse.json({ ok: true }, { headers: RESPONSE_HEADERS });
}
