import { NextRequest, NextResponse } from 'next/server';
import { getH1bApiBaseUrl } from '@/lib/env';

const ALLOWED_PARAMS = [
  'search',
  'profile',
  'company',
  'freshness',
  'max_experience',
  'active',
  'sort',
  'page',
  'per_page'
] as const;

const EDGE_CACHE_SECONDS = 30;
const STALE_WHILE_REVALIDATE_SECONDS = 120;

export async function GET(request: NextRequest) {
  const baseUrl = getH1bApiBaseUrl();

  if (!baseUrl) {
    return NextResponse.json(
      { error: 'H1B job feed is not configured. Set H1B_API_BASE_URL.' },
      { status: 503 }
    );
  }

  const upstreamParams = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null && value !== '') {
      upstreamParams.set(key, value);
    }
  }

  const upstreamUrl = `${baseUrl}/api/jobs${upstreamParams.toString() ? `?${upstreamParams}` : ''}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Upstream H1B feed error', status: upstream.status },
        { status: 502 }
      );
    }

    const body = await upstream.json();
    return NextResponse.json(body, {
      headers: {
        'Cache-Control': `s-maxage=${EDGE_CACHE_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to reach H1B feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 502 }
    );
  }
}
