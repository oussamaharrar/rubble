import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_CHAIN_ID = 8453;

function resolveDomain(request: Request) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_URL;
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.host) {
        return parsed.host;
      }
    } catch {
      // fall back to request origin
    }
  }
  const url = new URL(request.url);
  const headerHost =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return headerHost;
}

export async function GET(request: Request) {
  const owner = (process.env.PUBLIC_OWNER_ADDRESS ?? process.env.BASE_BUILDER_OWNER_ADDRESS)?.trim();
  const domain = resolveDomain(request);
  const timestamp = new Date().toISOString();

  const body: Record<string, unknown> = {
    ok: Boolean(owner),
    chainId: BASE_CHAIN_ID,
    timestamp,
    domain,
  };

  if (owner && owner.length > 0) {
    body.address = owner;
  } else {
    body.reason = 'PUBLIC_OWNER_ADDRESS_MISSING';
  }

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}

