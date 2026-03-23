import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch templates', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data });
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

  const { name, subject, body: templateBody } = body as {
    name?: string;
    subject?: string;
    body?: string;
  };

  if (!subject || !templateBody) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      user_id: auth.user.id,
      name: name || 'Default',
      subject,
      body: templateBody
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create template', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data }, { status: 201 });
}
