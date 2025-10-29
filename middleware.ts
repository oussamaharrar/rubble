import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { siteMetadata } from '@/lib/site-info';

const shouldNoIndex = siteMetadata.noindex;

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  if (shouldNoIndex) {
    response.headers.set('X-Robots-Tag', 'noindex');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

