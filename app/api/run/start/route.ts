import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured } from '@/lib/server/leaderboard';
import { issueRunToken } from '@/lib/server/run-token';

function createRunId() {
  try {
    return randomUUID();
  } catch {
    const bytes = Math.floor(Math.random() * 1_000_000).toString(16).padStart(5, '0');
    return `run-${Date.now().toString(16)}-${bytes}`;
  }
}

export async function POST(request: Request) {
  if (!isLeaderboardConfigured()) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  const addressValue = (body as { address?: unknown })?.address;
  const address = typeof addressValue === 'string' ? normalizeAddress(addressValue) : undefined;
  if (!address) {
    return NextResponse.json({ ok: false, reason: 'invalid_address' }, { status: 400 });
  }

  const hmacKey = process.env.LEADER_HMAC_KEY;
  try {
    if (hmacKey) {
      const { token, payload } = issueRunToken(hmacKey, address);
      const runId = payload?.nonce ?? createRunId();
      logEvent('run_start_token_issue', { address, mode: 'token', runId });
      return NextResponse.json({ ok: true, token, payload, runId });
    }
    const runId = createRunId();
    logEvent('run_start_token_issue', { address, mode: 'id', runId });
    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    console.warn('[run/start] failed to issue token', error);
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 500 });
  }
}
