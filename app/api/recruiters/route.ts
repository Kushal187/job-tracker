import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('recruiters')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('company', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch recruiters', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ recruiters: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, company, title, linkedinUrl, notes } = body as {
    name?: string;
    email?: string;
    company?: string;
    title?: string;
    linkedinUrl?: string;
    notes?: string;
  };

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('recruiters')
    .insert({
      user_id: auth.user.id,
      name,
      email,
      company: company || '',
      title: title || '',
      linkedin_url: linkedinUrl || '',
      notes: notes || ''
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A recruiter with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create recruiter', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ recruiter: data }, { status: 201 });
}
