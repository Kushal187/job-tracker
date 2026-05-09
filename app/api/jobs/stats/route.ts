import { NextResponse } from 'next/server';
import { getH1bApiBaseUrl } from '@/lib/env';

const REVALIDATE_SECONDS = 1800;

export async function GET() {
  const baseUrl = getH1bApiBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'H1B job feed is not configured. Set H1B_API_BASE_URL.' },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(`${baseUrl}/api/stats?active=true`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS }
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
        'Cache-Control': `s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`
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
