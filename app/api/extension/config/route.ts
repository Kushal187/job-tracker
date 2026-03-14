import { NextResponse } from 'next/server';

function normalizeBaseUrl(value: string | undefined) {
  return (value || '').trim().replace(/\/+$/, '');
}

export async function GET(request: Request) {
  const fallbackOrigin = normalizeBaseUrl(new URL(request.url).origin);
  const appBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) || fallbackOrigin;
  const supabaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        error: 'Extension config is incomplete',
        details: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
      },
      { status: 500 }
    );
  }

  const resumeApiUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_RESUME_API_URL);

  return NextResponse.json(
    {
      appBaseUrl,
      supabaseUrl,
      supabaseAnonKey,
      resumeApiUrl
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300'
      }
    }
  );
}
