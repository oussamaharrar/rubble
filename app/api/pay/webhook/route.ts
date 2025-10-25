import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { isSessionPaid, markSessionPaid, verifyBasePayWebhook } from '@/lib/pay';
const HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,x-basepay-signature,x-base-pay-signature',
};

export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: HEADERS,
  });
}

function pickSignature(request: Request) {
  const headers = request.headers;
  return (
    headers.get('x-basepay-signature') ||
    headers.get('x-base-pay-signature') ||
    headers.get('basepay-signature') ||
    headers.get('base-pay-signature')
  );
}

function normaliseStatus(status: string | undefined) {
  return status?.trim().toLowerCase() ?? '';
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = pickSignature(request);

    verifyBasePayWebhook(rawBody, signature);

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = (payload?.data as Record<string, unknown>) ?? payload;

    const sessionId = String(data.sessionId ?? data.id ?? '').trim();
    const chain = normaliseStatus(String(data.chain ?? data.network ?? ''));
    const recipient = String(data.recipient ?? data.payToAddress ?? data.to ?? '').trim();
    const amountCandidate =
      (data.amount as string | number | bigint | undefined) ??
      (data.amountWei as string | number | bigint | undefined) ??
      (data.value as string | number | bigint | undefined) ??
      '0';
    const amountRaw =
      typeof amountCandidate === 'string'
        ? amountCandidate
        : typeof amountCandidate === 'number'
        ? Math.floor(amountCandidate).toString()
        : typeof amountCandidate === 'bigint'
        ? amountCandidate.toString()
        : '0';
    const status = normaliseStatus(String(data.status ?? data.state ?? ''));

    if (!sessionId) {
      throw new Error('Missing session id');
    }

    if (chain !== 'base-mainnet') {
      throw new Error(`Unsupported chain ${chain}`);
    }

    if (recipient.toLowerCase() !== ENV.PAY_TO_ADDRESS.toLowerCase()) {
      throw new Error('Recipient mismatch');
    }

    const amount = BigInt(amountRaw);
    if (amount < BigInt(ENV.MIN_PRICE_WEI)) {
      throw new Error('Under minimum amount');
    }

    if (!['paid', 'confirmed', 'succeeded'].includes(status)) {
      throw new Error(`Unsupported status ${status}`);
    }

    if (!isSessionPaid(sessionId)) {
      markSessionPaid(sessionId);
    }

    return NextResponse.json({ ok: true }, { headers: HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook failed';
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 400, headers: HEADERS },
    );
  }
}
