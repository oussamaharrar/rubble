import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { createRunId, isLeaderboardConfigured } from '@/lib/server/leaderboard';
import { issueRunToken } from '@/lib/server/run-token';

export async function POST(request: Request) {
  if (!isLeaderboardConfigured()) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 404 });
  }
  const hmacKey = process.env.LEADER_HMAC_KEY;

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

  const runId = createRunId();

  if (!hmacKey) {
    logEvent('run_start_token_issue', { address, runId, mode: 'id_only' });
    return NextResponse.json({ ok: true, runId });
  }

  try {
    const { token, payload } = issueRunToken(hmacKey, address);
    logEvent('run_start_token_issue', { address, runId, mode: 'token' });
    return NextResponse.json({ ok: true, token, payload, runId });
  } catch (error) {
    console.warn('[run/start] failed to issue token', error);
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 500 });
  }
}
