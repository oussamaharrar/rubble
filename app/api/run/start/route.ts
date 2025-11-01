import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured } from '@/lib/server/leaderboard';
import { issueRunToken } from '@/lib/server/run-token';

function createRunId() {
  return randomBytes(12).toString('hex');
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

  const runId = createRunId();
  const hmacKey = process.env.LEADER_HMAC_KEY;

  if (!hmacKey) {
    logEvent('run_start_token_issue', { address, runId, token: false });
    return NextResponse.json({ ok: true, runId });
  }

  try {
    const { token, payload } = issueRunToken(hmacKey, address);
    logEvent('run_start_token_issue', { address, runId, token: true });
    return NextResponse.json({ ok: true, token, payload, runId });
  } catch (error) {
    console.warn('[run/start] failed to issue token', error);
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 500 });
  }
}
