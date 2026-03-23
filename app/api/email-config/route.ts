import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('email_config')
    .select('gmail_email, gmail_app_password')
    .eq('user_id', auth.user.id)
    .single();

  return NextResponse.json({
    config: data
      ? { gmailEmail: data.gmail_email, hasAppPassword: !!data.gmail_app_password }
      : null
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { gmailEmail, gmailAppPassword } = body as {
    gmailEmail?: string;
    gmailAppPassword?: string;
  };

  if (!gmailEmail || !gmailAppPassword) {
    return NextResponse.json({ error: 'gmailEmail and gmailAppPassword are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('email_config')
    .upsert({
      user_id: auth.user.id,
      gmail_email: gmailEmail,
      gmail_app_password: gmailAppPassword
    }, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json({ error: 'Failed to save config', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
