import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

const env = getEnv();

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  if (env.SITE_NOINDEX) {
    response.headers.set('X-Robots-Tag', 'noindex');
  }
  return response;
}

export const config = {
  matcher: '/:path*',
};
