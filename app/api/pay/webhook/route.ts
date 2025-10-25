import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { verifyBasePayWebhook } from '@/lib/pay';
import { markSessionPaid } from '@/lib/pay-session-store';

export const runtime = 'nodejs';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...RESPONSE_HEADERS,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,x-basepay-signature,basepay-signature',
    },
  });
}

type WebhookAmount = {
  value?: string | number;
  currency?: string;
};

type WebhookPayload = {
  id?: string;
  sessionId?: string;
  chain?: string;
  chainId?: string;
  recipient?: string;
  recipientAddress?: string;
  amount?: WebhookAmount | string | number;
  amountWei?: string | number;
  status?: string;
  data?: WebhookPayload;
};

function toBigInt(value: string | number) {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function extractAmount(payload: WebhookPayload) {
  if (typeof payload.amountWei !== 'undefined') {
    return toBigInt(payload.amountWei as string | number);
  }
  const amount = payload.amount;
  if (!amount) return 0n;
  if (typeof amount === 'string' || typeof amount === 'number') {
    return toBigInt(amount);
  }
  if (typeof amount.value === 'string' || typeof amount.value === 'number') {
    return toBigInt(amount.value);
  }
  return 0n;
}

function normaliseChain(value?: string | null) {
  if (!value) return '';
  return value.toLowerCase();
}

function normaliseRecipient(value?: string | null) {
  return value?.toLowerCase() ?? '';
}

export async function POST(request: Request) {
  const signature =
    request.headers.get('x-basepay-signature') ?? request.headers.get('basepay-signature');
  const rawBody = await request.text();

  const verified = verifyBasePayWebhook(rawBody, signature);
  if (!verified) {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_SIGNATURE' },
      { status: 401, headers: RESPONSE_HEADERS }
    );
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_JSON' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }
  const data = payload.data ?? payload;
  const sessionId = data.sessionId ?? data.id;

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, reason: 'MISSING_SESSION_ID' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const chain = normaliseChain(data.chain ?? data.chainId);
  if (chain !== 'base-mainnet' && chain !== '0x2105' && chain !== '8453') {
    return NextResponse.json(
      { ok: false, reason: 'UNSUPPORTED_CHAIN', chain },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const recipient = normaliseRecipient(data.recipient ?? data.recipientAddress);
  if (!recipient || recipient !== ENV.PAY_TO_ADDRESS.toLowerCase()) {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_RECIPIENT', recipient },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const amountWei = extractAmount(data);
  if (amountWei < ENV.MIN_PRICE_WEI) {
    return NextResponse.json(
      { ok: false, reason: 'UNDER_MINIMUM', amount: amountWei.toString() },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const status = (data.status ?? '').toLowerCase();
  if (status !== 'paid' && status !== 'confirmed') {
    return NextResponse.json(
      { ok: true, pending: true },
      { status: 202, headers: RESPONSE_HEADERS }
    );
  }

  markSessionPaid(sessionId, amountWei);

  return NextResponse.json({ ok: true }, { headers: RESPONSE_HEADERS });
}
