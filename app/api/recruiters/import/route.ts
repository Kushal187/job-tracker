import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { recruiters } = body as {
    recruiters?: Array<{
      name: string;
      email: string;
      company?: string;
      title?: string;
      linkedinUrl?: string;
      notes?: string;
    }>;
  };

  if (!recruiters || !Array.isArray(recruiters) || recruiters.length === 0) {
    return NextResponse.json({ error: 'recruiters array is required' }, { status: 400 });
  }

  const rows = recruiters
    .filter((r) => r.name && r.email)
    .map((r) => ({
      user_id: auth.user.id,
      name: r.name,
      email: r.email,
      company: r.company || '',
      title: r.title || '',
      linkedin_url: r.linkedinUrl || '',
      notes: r.notes || ''
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid recruiters to import' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('recruiters')
    .upsert(rows, { onConflict: 'user_id,email', ignoreDuplicates: true })
    .select();

  if (error) {
    return NextResponse.json({ error: 'Failed to import recruiters', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: data?.length ?? 0, total: rows.length }, { status: 201 });
}
