import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const body = req.headers.get('fc-request-body');
  if (!body) {
    return NextResponse.json(
      { ok: false, reason: 'no-fc' },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  const data = JSON.parse(body);
  return NextResponse.json(
    {
      ok: true,
      fid: data.fid,
      username: data.username,
      displayName: data.displayName,
      pfpUrl: data.pfp_url,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
